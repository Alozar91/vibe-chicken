"""Бизнес-логика несушек и яйца.

Стадо — долгоживущая сущность; принцип event-sourcing тот же, что у партий:
хранятся факты (изменения поголовья, сборы, продажи, списания), агрегаты — SQL.
Продажа яйца не привязана к стаду (EggSale без flock_id по модели);
доход от продажи пишется в журнал денег (source_type='egg_sale').
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.dictionaries import Buyer, FeedBrand, FeedCategory, Place
from app.models.layers import (
    EggCollection,
    EggSale,
    EggSelfUse,
    LayFlock,
    LayFlockChange,
    LayFeeding,
)
from app.models.warehouse import MoneyTransaction
from app.schemas.layers import (
    EggCollectionIn,
    EggSaleIn,
    EggSelfUseIn,
    LayFlockChangeIn,
    LayFlockIn,
    LayFeedingIn,
    FlockMetrics,
)
from app.services import money as money_svc


def _get_flock(db: Session, flock_id: int) -> LayFlock:
    obj = db.get(LayFlock, flock_id)
    if obj is None:
        raise ValueError("Стадо не найдено")
    return obj


def _check_flock_date(db: Session, flock: LayFlock, d: date) -> None:
    """События стада не раньше даты закладки; у закрытых — только до закрытия."""
    if d < flock.start_date:
        raise ValueError("Дата события не может быть раньше даты создания стада")


# --- Стада ---


def list_flocks(db: Session) -> list[LayFlock]:
    return list(db.scalars(select(LayFlock).order_by(LayFlock.status, LayFlock.start_date.desc())))


def create_flock(db: Session, data: LayFlockIn) -> LayFlock:
    if db.get(Place, data.place_id) is None:
        raise ValueError("Место не найдено")
    dup = db.scalar(select(LayFlock).where(LayFlock.name == data.name.strip()))
    if dup is not None:
        raise ValueError(f"Стадо с названием «{data.name.strip()}» уже есть")
    obj = LayFlock(name=data.name.strip(), place_id=data.place_id, start_date=data.start_date)
    db.add(obj)
    db.commit()
    return obj


def update_flock(db: Session, flock_id: int, data: LayFlockIn) -> LayFlock:
    flock = _get_flock(db, flock_id)
    dup = db.scalar(select(LayFlock).where(LayFlock.name == data.name.strip(), LayFlock.id != flock_id))
    if dup is not None:
        raise ValueError(f"Стадо с названием «{data.name.strip()}» уже есть")
    if db.get(Place, data.place_id) is None:
        raise ValueError("Место не найдено")
    if data.start_date > flock.start_date:
        first_event = db.scalar(
            select(func.min(LayFlockChange.date)).where(LayFlockChange.flock_id == flock_id))
        first_event = min(
            first_event or flock.start_date,
            db.scalar(select(func.min(EggCollection.date)).where(EggCollection.flock_id == flock_id))
            or flock.start_date,
        )
        if data.start_date > first_event:
            raise ValueError("Дата создания не может быть позже первого события стада")
    flock.name = data.name.strip()
    flock.place_id = data.place_id
    flock.start_date = data.start_date
    db.commit()
    return flock


def close_flock(db: Session, flock_id: int) -> LayFlock:
    flock = _get_flock(db, flock_id)
    flock.status = "closed"
    db.commit()
    return flock


# --- Изменения поголовья ---


def list_changes(db: Session, flock_id: int) -> list[LayFlockChange]:
    _get_flock(db, flock_id)
    return list(db.scalars(
        select(LayFlockChange).where(LayFlockChange.flock_id == flock_id).order_by(LayFlockChange.date)))


def current_head(db: Session, flock_id: int) -> int:
    return int(db.scalar(
        select(func.coalesce(func.sum(LayFlockChange.head_delta), 0))
        .where(LayFlockChange.flock_id == flock_id)) or 0)


def create_change(db: Session, flock_id: int, data: LayFlockChangeIn) -> LayFlockChange:
    flock = _get_flock(db, flock_id)
    if flock.status == "closed":
        raise ValueError("Стадо закрыто — события недоступны")
    _check_flock_date(db, flock, data.date)
    if data.head_delta == 0:
        raise ValueError("Изменение поголовья не может быть нулевым")
    if data.head_delta < 0 and current_head(db, flock_id) + data.head_delta < 0:
        raise ValueError(f"Нельзя списать больше, чем есть в стаде ({current_head(db, flock_id)} гол.)")
    obj = LayFlockChange(flock_id=flock_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_change(db: Session, flock_id: int, obj_id: int, data: LayFlockChangeIn) -> LayFlockChange:
    _get_flock(db, flock_id)
    obj = db.get(LayFlockChange, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    flock = _get_flock(db, flock_id)
    _check_flock_date(db, flock, data.date)
    if data.head_delta == 0:
        raise ValueError("Изменение поголовья не может быть нулевым")
    others = current_head(db, flock_id) - obj.head_delta
    if others + data.head_delta < 0:
        raise ValueError(f"Нельзя списать больше, чем есть в стаде ({others} гол. без этой записи)")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_change(db: Session, flock_id: int, obj_id: int) -> None:
    _get_flock(db, flock_id)
    obj = db.get(LayFlockChange, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    if current_head(db, flock_id) - obj.head_delta < 0:
        raise ValueError("Нельзя удалить: поголовье после удаления уйдёт в минус")
    db.delete(obj)
    db.commit()


# --- Сбор яйца ---


def list_collections(db: Session, flock_id: int) -> list[EggCollection]:
    _get_flock(db, flock_id)
    return list(db.scalars(
        select(EggCollection).where(EggCollection.flock_id == flock_id)
        .order_by(EggCollection.date.desc(), EggCollection.id.desc())))


def create_collection(db: Session, flock_id: int, data: EggCollectionIn) -> EggCollection:
    flock = _get_flock(db, flock_id)
    if flock.status == "closed":
        raise ValueError("Стадо закрыто — события недоступны")
    _check_flock_date(db, flock, data.date)
    obj = EggCollection(flock_id=flock_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_collection(db: Session, flock_id: int, obj_id: int, data: EggCollectionIn) -> EggCollection:
    flock = _get_flock(db, flock_id)
    obj = db.get(EggCollection, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    _check_flock_date(db, flock, data.date)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_collection(db: Session, flock_id: int, obj_id: int) -> None:
    _get_flock(db, flock_id)
    obj = db.get(EggCollection, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    db.delete(obj)
    db.commit()


# --- Самопотребление ---


def list_selfuse(db: Session, flock_id: int) -> list[EggSelfUse]:
    _get_flock(db, flock_id)
    return list(db.scalars(
        select(EggSelfUse).where(EggSelfUse.flock_id == flock_id)
        .order_by(EggSelfUse.date.desc(), EggSelfUse.id.desc())))


def create_selfuse(db: Session, flock_id: int, data: EggSelfUseIn) -> EggSelfUse:
    flock = _get_flock(db, flock_id)
    if flock.status == "closed":
        raise ValueError("Стадо закрыто — события недоступны")
    _check_flock_date(db, flock, data.date)
    laid = int(db.scalar(
        select(func.coalesce(func.sum(EggCollection.pieces), 0))
        .where(EggCollection.flock_id == flock_id, EggCollection.date <= data.date)) or 0)
    used = int(db.scalar(
        select(func.coalesce(func.sum(EggSelfUse.pieces), 0))
        .where(EggSelfUse.flock_id == flock_id, EggSelfUse.date <= data.date)) or 0)
    if used + data.pieces > laid:
        raise ValueError(f"Нельзя списать больше, чем собрано к этой дате (собрано {laid} шт.)")
    obj = EggSelfUse(flock_id=flock_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_selfuse(db: Session, flock_id: int, obj_id: int, data: EggSelfUseIn) -> EggSelfUse:
    flock = _get_flock(db, flock_id)
    obj = db.get(EggSelfUse, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    _check_flock_date(db, flock, data.date)
    laid = int(db.scalar(
        select(func.coalesce(func.sum(EggCollection.pieces), 0))
        .where(EggCollection.flock_id == flock_id, EggCollection.date <= data.date)) or 0)
    used = int(db.scalar(
        select(func.coalesce(func.sum(EggSelfUse.pieces), 0))
        .where(EggSelfUse.flock_id == flock_id, EggSelfUse.date <= data.date, EggSelfUse.id != obj_id)) or 0)
    if used + data.pieces > laid:
        raise ValueError(f"Нельзя списать больше, чем собрано к этой дате (собрано {laid} шт.)")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_selfuse(db: Session, flock_id: int, obj_id: int) -> None:
    _get_flock(db, flock_id)
    obj = db.get(EggSelfUse, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    db.delete(obj)
    db.commit()


# --- Кормление (списание со склада, как у партии) ---


def list_feedings(db: Session, flock_id: int) -> list[LayFeeding]:
    _get_flock(db, flock_id)
    return list(db.scalars(
        select(LayFeeding).where(LayFeeding.flock_id == flock_id)
        .order_by(LayFeeding.date.desc(), LayFeeding.id.desc())))


def create_feeding(db: Session, flock_id: int, data: LayFeedingIn) -> LayFeeding:
    flock = _get_flock(db, flock_id)
    if flock.status == "closed":
        raise ValueError("Стадо закрыто — события недоступны")
    _check_flock_date(db, flock, data.date)
    if db.get(FeedCategory, data.feed_category_id) is None:
        raise ValueError("Категория корма не найдена")
    if db.get(FeedBrand, data.feed_brand_id) is None:
        raise ValueError("Производитель корма не найден")
    obj = LayFeeding(flock_id=flock_id, **data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_feeding(db: Session, flock_id: int, obj_id: int, data: LayFeedingIn) -> LayFeeding:
    flock = _get_flock(db, flock_id)
    obj = db.get(LayFeeding, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    _check_flock_date(db, flock, data.date)
    if db.get(FeedCategory, data.feed_category_id) is None:
        raise ValueError("Категория корма не найдена")
    if db.get(FeedBrand, data.feed_brand_id) is None:
        raise ValueError("Производитель корма не найден")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_feeding(db: Session, flock_id: int, obj_id: int) -> None:
    _get_flock(db, flock_id)
    obj = db.get(LayFeeding, obj_id)
    if obj is None or obj.flock_id != flock_id:
        raise ValueError("Запись не найдена")
    db.delete(obj)
    db.commit()


# --- Продажи яйца (глобальные, без привязки к стаду) ---


def _sync_sale_money(db: Session, obj: EggSale) -> None:
    money_cat = money_svc.find_category(db, "income", ["Продажа продукции", "Продажа"])
    money_svc.sync_auto_transaction(
        db, source_type="egg_sale", source_id=obj.id,
        date_=obj.date, category=money_cat, amount=float(obj.total_amount),
        description="Продажа яйца",
    )


def list_sales(db: Session) -> list[EggSale]:
    return list(db.scalars(select(EggSale).order_by(EggSale.date.desc(), EggSale.id.desc())))


def create_sale(db: Session, data: EggSaleIn) -> EggSale:
    if data.buyer_id is not None and db.get(Buyer, data.buyer_id) is None:
        raise ValueError("Покупатель не найден")
    amount = data.total_amount if data.total_amount is not None else data.dozens * data.price_per_ten
    obj = EggSale(
        date=data.date, dozens=data.dozens, price_per_ten=data.price_per_ten,
        buyer_id=data.buyer_id, total_amount=round(amount, 2),
    )
    db.add(obj)
    db.flush()
    _sync_sale_money(db, obj)
    db.commit()
    return obj


def update_sale(db: Session, obj_id: int, data: EggSaleIn) -> EggSale:
    obj = db.get(EggSale, obj_id)
    if obj is None:
        raise ValueError("Запись не найдена")
    if data.buyer_id is not None and db.get(Buyer, data.buyer_id) is None:
        raise ValueError("Покупатель не найден")
    amount = data.total_amount if data.total_amount is not None else data.dozens * data.price_per_ten
    obj.date = data.date
    obj.dozens = data.dozens
    obj.price_per_ten = data.price_per_ten
    obj.buyer_id = data.buyer_id
    obj.total_amount = round(amount, 2)
    _sync_sale_money(db, obj)
    db.commit()
    return obj


def delete_sale(db: Session, obj_id: int) -> None:
    obj = db.get(EggSale, obj_id)
    if obj is None:
        raise ValueError("Запись не найдена")
    money_svc.sync_auto_transaction(
        db, source_type="egg_sale", source_id=obj.id,
        date_=obj.date, category=None, amount=0, description=None,
    )
    db.delete(obj)
    db.commit()


# --- Метрики стада ---


def compute_flock_metrics(db: Session, flock_id: int) -> FlockMetrics:
    _get_flock(db, flock_id)

    eggs_total = int(db.scalar(
        select(func.coalesce(func.sum(EggCollection.pieces), 0))
        .where(EggCollection.flock_id == flock_id)) or 0)

    dozens_sold = int(db.scalar(select(func.coalesce(func.sum(EggSale.dozens), 0))) or 0)
    revenue = round(float(db.scalar(select(func.coalesce(func.sum(EggSale.total_amount), 0))) or 0), 2)

    selfuse_total = int(db.scalar(
        select(func.coalesce(func.sum(EggSelfUse.pieces), 0))
        .where(EggSelfUse.flock_id == flock_id)) or 0)

    feed_kg = float(db.scalar(
        select(func.coalesce(func.sum(LayFeeding.kg), 0))
        .where(LayFeeding.flock_id == flock_id)) or 0)

    # яйценоскость: яйца за последние 7 дней (по датам сборов) / (поголовье × 7) × 100
    heads = current_head(db, flock_id)
    week_ago = date.today() - timedelta(days=7)
    eggs_week = int(db.scalar(
        select(func.coalesce(func.sum(EggCollection.pieces), 0))
        .where(EggCollection.flock_id == flock_id, EggCollection.date >= week_ago)) or 0)
    lay_rate = round(eggs_week / (heads * 7) * 100, 1) if heads > 0 else None

    return FlockMetrics(
        current_head=heads,
        eggs_total=eggs_total,
        dozens_sold=dozens_sold,
        egg_revenue=revenue,
        selfuse_total=selfuse_total,
        feed_kg=round(feed_kg, 3),
        lay_rate_pct=lay_rate,
    )
