"""Бизнес-логика партий бройлеров: CRUD, события, метрики.

Все агрегаты считаются запросами (event-sourcing). Ошибки домена — ValueError
с русским текстом; роутер переводит в HTTP-статусы.
"""

from datetime import date as Date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.broiler import (
    BatchFeeding,
    BatchMortality,
    BatchSale,
    BatchSlaughter,
    BatchTreatment,
    BatchWeighing,
    BroilerBatch,
    SlaughterOutput,
)
from app.models.dictionaries import Buyer, FeedBrand, FeedCategory, Place, ProductType, Vendor
from app.models.dictionaries import MoneyCategory
from app.models.warehouse import MoneyTransaction
from app.services import money as money_svc
from app.schemas.broiler import (
    BatchIn,
    BatchMetrics,
    FeedingIn,
    MortalityIn,
    SaleIn,
    SlaughterIn,
    TreatmentIn,
    WeighingIn,
)
from app.services import settings as settings_svc
from app.services import money as money_svc

# константы — русский текст для вывода «нет данных» решает UI; тут только None


def _get_batch(db: Session, batch_id: int) -> BroilerBatch:
    batch = db.get(BroilerBatch, batch_id)
    if batch is None:
        raise ValueError(f"Партия не найдена (id={batch_id})")
    return batch


def _check_vendor_chicks_tag(db: Session, vendor_id: int) -> Vendor:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise ValueError("Продавец не найден")
    if "chicks" not in vendor.types:
        raise ValueError(f"«{vendor.name}» не продаёт цыплят — нужен тег «Цыплята»")
    return vendor


def _check_refs(db: Session, place_id: int) -> None:
    if db.get(Place, place_id) is None:
        raise ValueError("Место содержания не найдено")


def _check_event_date(db: Session, batch: BroilerBatch, date: Date) -> None:
    """Даты событий партии ≥ даты закупки (концепция, ограничения целостности)."""
    if date < batch.start_date:
        raise ValueError("Дата события не может быть раньше даты закупки партии")


# --- CRUD партии ---


def list_batches(db: Session) -> list[BroilerBatch]:
    return list(db.scalars(select(BroilerBatch).order_by(BroilerBatch.status, BroilerBatch.start_date.desc())))


def get_batch(db: Session, batch_id: int) -> BroilerBatch:
    """Одна партия по id; ValueError при отсутствии (роутер → 404)."""
    return _get_batch(db, batch_id)


def next_code(db: Session, prefix: str | None = None) -> str:
    """Подсказка номера новой партии: префикс (по умолчанию B-ГГГГММ) + порядковый
    номер в рамках префикса. Если есть B-202611-1 и B-202611-2 → B-202611-3;
    если партий с префиксом нет → B-202611-1. Пользователь может исправить.
    """
    if not prefix:
        prefix = f"B-{Date.today().strftime('%Y%m')}"
    rows = db.scalars(
        select(BroilerBatch.code).where(BroilerBatch.code.like(f"{prefix}-%"))
    ).all()
    max_n = 0
    for code in rows:
        suffix = code[len(prefix) + 1:]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return f"{prefix}-{max_n + 1}"


def create_batch(db: Session, data: BatchIn) -> BroilerBatch:
    _check_vendor_chicks_tag(db, data.vendor_id)
    _check_refs(db, data.place_id)
    if db.scalar(select(BroilerBatch.id).where(BroilerBatch.code == data.code)) is not None:
        raise ValueError(f"Партия с номером «{data.code}» уже есть")

    # предупреждение о второй активной партии на месте — не запрет (концепция §4.1);
    # UI получает информацию через active_on_place, тут не блокируем.

    batch = BroilerBatch(**data.model_dump())
    db.add(batch)
    db.flush()

    # Деньги: закупка цыплят → расход в журнал (привязка к партии)
    chick_cost = data.chick_price_per_head * data.head_count
    money_cat = db.scalar(
        select(MoneyCategory).where(MoneyCategory.kind == "expense", MoneyCategory.name == "Цыплята")
    )
    if money_cat is not None and chick_cost > 0:
        money_svc.create_auto_transaction(
            db, date_=data.start_date, category=money_cat, amount=chick_cost,
            description=f"Закупка цыплят, партия {data.code}",
            source_type="chicks", source_id=batch.id, batch_id=batch.id,
        )
    db.commit()
    return batch


def update_batch(db: Session, batch_id: int, data: BatchIn) -> BroilerBatch:
    """Редактирование паспорта партии (закупка).

    Правила:
    - номер уникален (кроме самой себя), продавец с тегом «цыплята», место существует;
    - голов не меньше, чем уже выбыло (падёж + забой);
    - дата закупки не позже самой ранней даты события партии;
    - транзакция денег «Цыплята» синхронизируется с ценой/головами/датой/номером.
    """
    batch = _get_batch(db, batch_id)
    _check_vendor_chicks_tag(db, data.vendor_id)
    _check_refs(db, data.place_id)

    dup = db.scalar(select(BroilerBatch.id).where(BroilerBatch.code == data.code, BroilerBatch.id != batch_id))
    if dup is not None:
        raise ValueError(f"Партия с номером «{data.code}» уже есть")

    dead_sl = int(db.scalar(select(func.coalesce(func.sum(BatchMortality.head_count), 0))
                            .where(BatchMortality.batch_id == batch_id)) or 0)
    slaughtered = int(db.scalar(select(func.coalesce(func.sum(BatchSlaughter.head_count), 0))
                                .where(BatchSlaughter.batch_id == batch_id)) or 0)
    if data.head_count < dead_sl + slaughtered:
        raise ValueError(
            f"Голов не может быть меньше выбывших ({dead_sl + slaughtered}: падёж + забой)"
        )

    # минимальная дата события: по каждой таблице отдельным запросом
    event_dates = []
    for model in (BatchMortality, BatchFeeding, BatchWeighing, BatchTreatment, BatchSlaughter, BatchSale):
        d = db.scalar(select(func.min(model.date)).where(model.batch_id == batch_id))
        if d is not None:
            event_dates.append(d)
    if event_dates and data.start_date > min(event_dates):
        raise ValueError(
            f"Дата закупки не может быть позже первого события партии ({min(event_dates)})"
        )

    for k, v in data.model_dump().items():
        setattr(batch, k, v)

    # синхронизация автотранзакции закупки цыплят
    chick_cost = round(data.chick_price_per_head * data.head_count, 2)
    money_cat = db.scalar(
        select(MoneyCategory).where(MoneyCategory.kind == "expense", MoneyCategory.name == "Цыплята")
    )
    tx = None
    if money_cat is not None:
        tx = db.scalar(select(MoneyTransaction).where(
            MoneyTransaction.batch_id == batch_id,
            MoneyTransaction.money_category_id == money_cat.id))
    if chick_cost > 0 and money_cat is None:
        money_cat = db.scalar(
            select(MoneyCategory).where(MoneyCategory.kind == "expense", MoneyCategory.name == "Цыплята"))
    money_svc.sync_auto_transaction(
        db, source_type="chicks", source_id=batch_id,
        date_=data.start_date, category=money_cat if chick_cost > 0 else None,
        amount=chick_cost, description=f"Закупка цыплят, партия {data.code}",
        batch_id=batch_id,
    )
    db.commit()
    return batch


def close_batch(db: Session, batch_id: int) -> BroilerBatch:
    batch = _get_batch(db, batch_id)
    batch.status = "closed"
    from datetime import datetime, timezone
    batch.closed_at = datetime.now(timezone.utc)
    db.commit()
    return batch


def active_on_place(db: Session, place_id: int) -> int:
    """Сколько активных партий на месте (для предупреждения UI)."""
    return int(db.scalar(
        select(func.count()).select_from(BroilerBatch).where(
            BroilerBatch.place_id == place_id, BroilerBatch.status == "active")
    ) or 0)


# --- Падёж ---


def list_mortalities(db: Session, batch_id: int) -> list[BatchMortality]:
    _get_batch(db, batch_id)
    return list(db.scalars(
        select(BatchMortality).where(BatchMortality.batch_id == batch_id).order_by(BatchMortality.date)))


def create_mortality(db: Session, batch_id: int, data: MortalityIn) -> BatchMortality:
    batch = _get_batch(db, batch_id)
    _check_event_date(db, batch, data.date)
    obj = BatchMortality(batch_id=batch_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_mortality(db: Session, batch_id: int, obj_id: int, data: MortalityIn) -> BatchMortality:
    batch = _get_batch(db, batch_id)
    obj = db.get(BatchMortality, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    _check_event_date(db, batch, data.date)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_mortality(db: Session, batch_id: int, obj_id: int) -> None:
    _get_batch(db, batch_id)
    obj = db.get(BatchMortality, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    db.delete(obj)
    db.commit()


# --- Кормление (списание со склада) ---


def list_feedings(db: Session, batch_id: int) -> list[BatchFeeding]:
    _get_batch(db, batch_id)
    return list(db.scalars(
        select(BatchFeeding).where(BatchFeeding.batch_id == batch_id).order_by(BatchFeeding.date)))


def create_feeding(db: Session, batch_id: int, data: FeedingIn) -> BatchFeeding:
    batch = _get_batch(db, batch_id)
    _check_event_date(db, batch, data.date)
    if db.get(FeedCategory, data.feed_category_id) is None:
        raise ValueError("Категория корма не найдена")
    if db.get(FeedBrand, data.feed_brand_id) is None:
        raise ValueError("Производитель корма не найден")
    obj = BatchFeeding(batch_id=batch_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_feeding(db: Session, batch_id: int, obj_id: int, data: FeedingIn) -> BatchFeeding:
    _get_batch(db, batch_id)
    obj = db.get(BatchFeeding, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    _check_event_date(db, batch, data.date)
    if db.get(FeedCategory, data.feed_category_id) is None:
        raise ValueError("Категория корма не найдена")
    if db.get(FeedBrand, data.feed_brand_id) is None:
        raise ValueError("Производитель корма не найден")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_feeding(db: Session, batch_id: int, obj_id: int) -> None:
    _get_batch(db, batch_id)
    obj = db.get(BatchFeeding, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    db.delete(obj)
    db.commit()


# --- Взвешивания ---


def list_weighings(db: Session, batch_id: int) -> list[BatchWeighing]:
    _get_batch(db, batch_id)
    return list(db.scalars(
        select(BatchWeighing).where(BatchWeighing.batch_id == batch_id).order_by(BatchWeighing.date)))


def create_weighing(db: Session, batch_id: int, data: WeighingIn) -> BatchWeighing:
    batch = _get_batch(db, batch_id)
    _check_event_date(db, batch, data.date)
    obj = BatchWeighing(batch_id=batch_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_weighing(db: Session, batch_id: int, obj_id: int, data: WeighingIn) -> BatchWeighing:
    batch = _get_batch(db, batch_id)
    obj = db.get(BatchWeighing, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    _check_event_date(db, batch, data.date)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_weighing(db: Session, batch_id: int, obj_id: int) -> None:
    _get_batch(db, batch_id)
    obj = db.get(BatchWeighing, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    db.delete(obj)
    db.commit()


# --- Лечение ---


def list_treatments(db: Session, batch_id: int) -> list[BatchTreatment]:
    _get_batch(db, batch_id)
    return list(db.scalars(
        select(BatchTreatment).where(BatchTreatment.batch_id == batch_id).order_by(BatchTreatment.date)))


def create_treatment(db: Session, batch_id: int, data: TreatmentIn) -> BatchTreatment:
    batch = _get_batch(db, batch_id)
    _check_event_date(db, batch, data.date)
    obj = BatchTreatment(batch_id=batch_id, **data.model_dump())
    db.add(obj)
    db.flush()
    money_cat = money_svc.find_category(db, "expense", ["Лечение", "Медикаменты", "Ветпрепараты"])
    if money_cat is not None and data.cost > 0:
        money_svc.create_auto_transaction(
            db, date_=data.date, category=money_cat, amount=data.cost,
            description=f"Лечение: {data.description}",
            source_type="treatment", source_id=obj.id, batch_id=batch_id,
        )
    db.commit()
    return obj


def update_treatment(db: Session, batch_id: int, obj_id: int, data: TreatmentIn) -> BatchTreatment:
    batch = _get_batch(db, batch_id)
    obj = db.get(BatchTreatment, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    _check_event_date(db, batch, data.date)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    money_cat = money_svc.find_category(db, "expense", ["Лечение", "Медикаменты", "Ветпрепараты"])
    money_svc.sync_auto_transaction(
        db, source_type="treatment", source_id=obj.id,
        date_=data.date, category=money_cat if data.cost > 0 else None,
        amount=data.cost, description=f"Лечение: {data.description}", batch_id=batch_id,
    )
    db.commit()
    return obj


def delete_treatment(db: Session, batch_id: int, obj_id: int) -> None:
    _get_batch(db, batch_id)
    obj = db.get(BatchTreatment, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    money_svc.sync_auto_transaction(
        db, source_type="treatment", source_id=obj.id,
        date_=obj.date, category=None, amount=0, description=None, batch_id=batch_id,
    )
    db.delete(obj)
    db.commit()


# --- Забой (+ выходы по видам) ---


def list_slaughters(db: Session, batch_id: int) -> list[dict]:
    _get_batch(db, batch_id)
    slaughters = list(db.scalars(
        select(BatchSlaughter).where(BatchSlaughter.batch_id == batch_id).order_by(BatchSlaughter.date)))
    type_names = {t.id: t.name for t in db.scalars(select(ProductType))}
    result = []
    for s in slaughters:
        outputs = list(db.scalars(
            select(SlaughterOutput).where(SlaughterOutput.slaughter_id == s.id)))
        result.append({
            "id": s.id,
            "batch_id": s.batch_id,
            "date": s.date,
            "head_count": s.head_count,
            "live_weight_kg": float(s.live_weight_kg),
            "outputs": [
                {
                    "id": o.id,
                    "product_type_id": o.product_type_id,
                    "kg": float(o.kg),
                    "product_type_name": type_names.get(o.product_type_id),
                }
                for o in outputs
            ],
        })
    return result


def create_slaughter(db: Session, batch_id: int, data: SlaughterIn) -> dict:
    batch = _get_batch(db, batch_id)
    _check_event_date(db, batch, data.date)

    # валидация видов продукции
    for o in data.outputs:
        if db.get(ProductType, o.product_type_id) is None:
            raise ValueError("Вид продукции не найден")

    # голов на забое не больше текущего поголовья
    metrics = compute_metrics(db, batch_id)
    if data.head_count > metrics.current_head:
        raise ValueError(
            f"Нельзя забить {data.head_count} гол.: в партии осталось {metrics.current_head}"
        )

    # Живой вес считается из выхода продукции через коэффициент (настройка системы):
    # живой вес = Σкг продукции / коэффициент выхода (концепция §4.1, пересчёт)
    output_kg = sum(o.kg for o in data.outputs)
    ratio = settings_svc.get_float(db, "output_ratio_tushka")
    if ratio <= 0:
        raise ValueError("Коэффициент выхода в настройках должен быть больше 0")
    live_weight = round(output_kg / ratio, 3)

    obj = BatchSlaughter(
        batch_id=batch_id, date=data.date, head_count=data.head_count,
        live_weight_kg=live_weight,
    )
    db.add(obj)
    db.flush()
    for o in data.outputs:
        db.add(SlaughterOutput(slaughter_id=obj.id, **o.model_dump()))
    db.commit()
    return {
        "id": obj.id, "batch_id": batch_id, "date": obj.date,
        "head_count": obj.head_count, "live_weight_kg": float(obj.live_weight_kg),
        "output_kg": round(output_kg, 3), "output_ratio": ratio,
    }


def update_slaughter(db: Session, batch_id: int, obj_id: int, data: SlaughterIn) -> dict:
    """Редактирование забоя: дата, голов, выходы (живой вес пересчитывается).

    При изменении дат/голов проверяем, что продажи этого забоя остаются
    валидными: дата каждой продажи ≥ новой даты забоя.
    """
    batch = _get_batch(db, batch_id)
    obj = db.get(BatchSlaughter, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    _check_event_date(db, batch, data.date)

    for o in data.outputs:
        if db.get(ProductType, o.product_type_id) is None:
            raise ValueError("Вид продукции не найден")

    # голов: то, что уже было забито этим событием, освобождается;
    # новое значение не должно превышать текущее поголовье + старое значение
    metrics = compute_metrics(db, batch_id)
    if data.head_count > metrics.current_head + obj.head_count:
        raise ValueError(
            f"Нельзя забить {data.head_count} гол.: доступно "
            f"{metrics.current_head + obj.head_count} (с учётом перезаписи этого события)"
        )

    # продажи не могут оказаться раньше новой даты забоя
    later_sale = db.scalar(
        select(BatchSale.id).where(
            BatchSale.batch_id == batch_id, BatchSale.date < data.date
        ).limit(1)
    )
    if later_sale is not None:
        raise ValueError("Есть продажи раньше новой даты забоя — измените или удалите их сначала")

    output_kg = sum(o.kg for o in data.outputs)
    ratio = settings_svc.get_float(db, "output_ratio_tushka")
    if ratio <= 0:
        raise ValueError("Коэффициент выхода в настройках должен быть больше 0")

    obj.date = data.date
    obj.head_count = data.head_count
    obj.live_weight_kg = round(output_kg / ratio, 3)

    # перезаписываем выходы целиком
    for o in db.scalars(select(SlaughterOutput).where(SlaughterOutput.slaughter_id == obj_id)):
        db.delete(o)
    db.flush()
    for o in data.outputs:
        db.add(SlaughterOutput(slaughter_id=obj_id, **o.model_dump()))
    db.commit()
    return {
        "id": obj.id, "batch_id": batch_id, "date": obj.date,
        "head_count": obj.head_count, "live_weight_kg": float(obj.live_weight_kg),
        "output_kg": round(output_kg, 3), "output_ratio": ratio,
    }


def delete_slaughter(db: Session, batch_id: int, obj_id: int) -> None:
    _get_batch(db, batch_id)
    obj = db.get(BatchSlaughter, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    # каскадное удаление выходов
    for o in db.scalars(select(SlaughterOutput).where(SlaughterOutput.slaughter_id == obj_id)):
        db.delete(o)
    db.delete(obj)
    db.commit()


# --- Продажи ---


def list_sales(db: Session, batch_id: int) -> list[BatchSale]:
    _get_batch(db, batch_id)
    return list(db.scalars(
        select(BatchSale).where(BatchSale.batch_id == batch_id).order_by(BatchSale.date)))


def _sync_sale_money(db: Session, batch_id: int, obj: BatchSale) -> None:
    """Доход по продаже: категория «Продажа продукции»/«Продажа» (если есть)."""
    money_cat = money_svc.find_category(db, "income", ["Продажа продукции", "Продажа"])
    money_svc.sync_auto_transaction(
        db, source_type="sale", source_id=obj.id,
        date_=obj.date, category=money_cat, amount=float(obj.total_amount),
        description=f"Продажа продукции",
        batch_id=batch_id,
    )


def create_sale(db: Session, batch_id: int, data: SaleIn, commit: bool = True) -> BatchSale:
    """Создать продажу продукции партии. commit=False — когда вызов внутри
    продажи из заказа (§4.7): коммит делает вызывающий код одним транзактом."""
    batch = _get_batch(db, batch_id)
    if db.get(ProductType, data.product_type_id) is None:
        raise ValueError("Вид продукции не найден")
    if data.buyer_id is not None and db.get(Buyer, data.buyer_id) is None:
        raise ValueError("Покупатель не найден")

    # дата продажи ≥ первой даты забоя партии; продажа без забоя невозможна —
    # продукция появляется только после разделки (концепция §4.1)
    first_slaughter = db.scalar(
        select(BatchSlaughter.date).where(BatchSlaughter.batch_id == batch_id).order_by(BatchSlaughter.date).limit(1)
    )
    if first_slaughter is None:
        raise ValueError("Сначала зафиксируйте забой — продавать можно только продукцию после разделки")
    if data.date < first_slaughter:
        raise ValueError("Дата продажи не может быть раньше даты забоя")

    # правило total_amount: если введено ≠ кг×цена — храним введённое (факт чека)
    amount = data.total_amount if data.total_amount is not None else data.product_kg * data.price_per_kg

    obj = BatchSale(
        batch_id=batch_id, date=data.date, product_type_id=data.product_type_id,
        product_kg=data.product_kg, price_per_kg=data.price_per_kg,
        buyer_id=data.buyer_id, total_amount=round(amount, 2),
    )
    db.add(obj)
    db.flush()
    _sync_sale_money(db, batch_id, obj)
    if commit:
        db.commit()
    return obj


def update_sale(db: Session, batch_id: int, obj_id: int, data: SaleIn) -> BatchSale:
    _get_batch(db, batch_id)
    obj = db.get(BatchSale, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    if db.get(ProductType, data.product_type_id) is None:
        raise ValueError("Вид продукции не найден")
    if data.buyer_id is not None and db.get(Buyer, data.buyer_id) is None:
        raise ValueError("Покупатель не найден")

    # дата продажи ≥ первой даты забоя партии
    first_slaughter = db.scalar(
        select(BatchSlaughter.date).where(BatchSlaughter.batch_id == batch_id).order_by(BatchSlaughter.date).limit(1)
    )
    if first_slaughter is None:
        raise ValueError("Сначала зафиксируйте забой — продавать можно только продукцию после разделки")
    if data.date < first_slaughter:
        raise ValueError("Дата продажи не может быть раньше даты забоя")

    amount = data.total_amount if data.total_amount is not None else data.product_kg * data.price_per_kg
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    obj.total_amount = round(amount, 2)
    _sync_sale_money(db, batch_id, obj)
    db.commit()
    return obj


def delete_sale(db: Session, batch_id: int, obj_id: int, commit: bool = True) -> None:
    """Удалить продажу вместе с авто-записью денег. commit=False — из
    delete_fulfillment (§4.7): удаление связи и продажи — один транзакт."""
    _get_batch(db, batch_id)
    obj = db.get(BatchSale, obj_id)
    if obj is None or obj.batch_id != batch_id:
        raise ValueError("Запись не найдена")
    money_svc.sync_auto_transaction(
        db, source_type="sale", source_id=obj.id,
        date_=obj.date, category=None, amount=0, description=None, batch_id=batch_id,
    )
    db.delete(obj)
    if commit:
        db.commit()


# --- Метрики (все — запросами, стандарты §2.4) ---


def batch_age_days(batch: BroilerBatch, on_date: Date | None = None) -> int:
    """Возраст партии на дату (по умолчанию — сегодня).

    Возраст при поступлении + число дней с поступления: суточные (1 день)
    считаются как обычно, подрощенные — со своим стартом (§4.1).
    """
    d = on_date or Date.today()
    return (d - batch.start_date).days + batch.arrival_age_days


def compute_metrics(db: Session, batch_id: int) -> BatchMetrics:
    batch = _get_batch(db, batch_id)

    dead = int(db.scalar(select(func.coalesce(func.sum(BatchMortality.head_count), 0))
                         .where(BatchMortality.batch_id == batch_id)) or 0)
    slaughtered = int(db.scalar(select(func.coalesce(func.sum(BatchSlaughter.head_count), 0))
                                .where(BatchSlaughter.batch_id == batch_id)) or 0)
    live_weight = float(db.scalar(select(func.coalesce(func.sum(BatchSlaughter.live_weight_kg), 0))
                                  .where(BatchSlaughter.batch_id == batch_id)) or 0)
    feed_kg = float(db.scalar(select(func.coalesce(func.sum(BatchFeeding.kg), 0))
                              .where(BatchFeeding.batch_id == batch_id)) or 0)
    treatment_cost = float(db.scalar(select(func.coalesce(func.sum(BatchTreatment.cost), 0))
                                     .where(BatchTreatment.batch_id == batch_id)) or 0)

    sales = list(db.scalars(select(BatchSale).where(BatchSale.batch_id == batch_id)))
    revenue = round(sum(float(s.total_amount) for s in sales), 2)

    # выход продукции — по событиям забоя (концепция §4.1), не по продажам
    output_kg = float(db.scalar(select(func.coalesce(func.sum(SlaughterOutput.kg), 0))
                                .join(BatchSlaughter)
                                .where(BatchSlaughter.batch_id == batch_id)) or 0)
    output_kg = round(output_kg, 3)

    current_head = batch.head_count - dead - slaughtered
    survival = round((slaughtered + dead) / batch.head_count * 100, 1) if batch.head_count else None

    # FCR: каскад — вес цыплёнка → привес = живой вес − вес закупленных голов на забое;
    # иначе контрольные взвешивания; иначе None («нет данных»)
    fcr: float | None = None
    if batch.chick_avg_weight_kg is not None and live_weight > 0:
        gain = live_weight - float(batch.chick_avg_weight_kg) * slaughtered
        if gain > 0 and feed_kg > 0:
            fcr = round(feed_kg / gain, 3)
    else:
        # по взвешиваниям: привес = (последний средний вес − первый) × голов... упрощённо:
        # средний вес последнего взвешивания × текущее поголовье на момент — точная модель
        # уточняется с накоплением данных; пока FCR по взвешиваниям считаем только при ≥2 взвешиваниях
        weighings = list(db.scalars(
            select(BatchWeighing).where(BatchWeighing.batch_id == batch_id).order_by(BatchWeighing.date)))
        if len(weighings) >= 2:
            first, last = weighings[0], weighings[-1]
            # приближение: средний вес на конец − на начало, × забитые и оставшиеся головы
            heads_now = max(current_head + slaughtered, 1)
            gain_per_head = float(last.avg_weight_kg) - float(first.avg_weight_kg)
            gain = gain_per_head * heads_now
            if gain > 0 and feed_kg > 0:
                fcr = round(feed_kg / gain, 3)

    output_pct = round(output_kg / live_weight * 100, 1) if live_weight > 0 else None

    # прямые: цыплята + лечение + расходы, привязанные к партии напрямую (§4.4)
    linked_cost = float(db.scalar(
        select(func.coalesce(func.sum(MoneyTransaction.amount), 0))
        .join(MoneyCategory, MoneyTransaction.money_category_id == MoneyCategory.id)
        .where(MoneyTransaction.batch_id == batch_id, MoneyCategory.kind == "expense",
               MoneyCategory.is_general == True)) or 0)  # noqa: E712
    direct_costs = round(
        float(batch.chick_price_per_head) * batch.head_count + treatment_cost + linked_cost, 2)
    # стоимость корма списывается со склада по партиям; при наличии закупок средняя
    # цена кг корма вычисляется на уровне отчётов (позже); в прямые затраты партии
    # пока включаем цыплят и лечение — корм добавим в отчёте экономики.

    shared_costs = money_svc.general_expense_share(db, batch)
    profit = round(revenue - direct_costs - shared_costs, 2) if sales else None

    return BatchMetrics(
        current_head=current_head,
        slaughtered_head=slaughtered,
        dead_head=dead,
        survival_pct=survival,
        fcr=fcr,
        feed_kg=round(feed_kg, 3),
        live_weight_kg=round(live_weight, 3),
        output_kg=output_kg,
        output_pct=output_pct,
        direct_costs=direct_costs,
        shared_costs=shared_costs,
        revenue=revenue,
        profit=profit,
    )
