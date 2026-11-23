"""Журнал денег: ручные записи, авто-записи событий, распределение общих расходов.

Авто-записи (закупка цыплят, корм, лечение, продажи) создаются сервисами событий
и не редактируются вручную — правятся через исходное событие.
Общие расходы (категория с is_general, без привязки к партии/стаду) распределяются
по кура-дням за месяц (концепция §4.4).
"""

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.broiler import BatchMortality, BatchSlaughter, BroilerBatch
from app.models.dictionaries import MoneyCategory
from app.models.layers import EggCollection, LayFlock, LayFlockChange
from app.models.user import User  # noqa: F401
from app.models.warehouse import MoneyTransaction


# --- Категории по имени (для авто-записей событий) ---


def find_category(db: Session, kind: str, names: list[str]) -> MoneyCategory | None:
    """Активная категория по виду и списку имён (первое совпадение)."""
    for name in names:
        cat = db.scalar(select(MoneyCategory).where(
            MoneyCategory.kind == kind, MoneyCategory.name == name, MoneyCategory.is_active == True))  # noqa: E712
        if cat is not None:
            return cat
    return None


def create_auto_transaction(
    db: Session,
    *,
    date_: date,
    category: MoneyCategory,
    amount: float,
    description: str,
    source_type: str,
    source_id: int,
    batch_id: int | None = None,
    flock_id: int | None = None,
) -> None:
    """Авто-запись события (без commit — вызывается внутри транзакции события)."""
    db.add(MoneyTransaction(
        date=date_, money_category_id=category.id, amount=round(amount, 2),
        description=description, batch_id=batch_id, flock_id=flock_id,
        is_auto=True, source_type=source_type, source_id=source_id,
    ))


def sync_auto_transaction(
    db: Session,
    *,
    source_type: str,
    source_id: int,
    date_: date,
    category: MoneyCategory | None,
    amount: float,
    description: str,
    batch_id: int | None = None,
) -> None:
    """Синхронизация авто-записи при редактировании события; category=None → удалить."""
    tx = db.scalar(select(MoneyTransaction).where(
        MoneyTransaction.source_type == source_type, MoneyTransaction.source_id == source_id))
    if tx is not None and category is None:
        db.delete(tx)
        return
    if tx is None:
        if category is None:
            return
        create_auto_transaction(
            db, date_=date_, category=category, amount=amount, description=description,
            source_type=source_type, source_id=source_id, batch_id=batch_id)
        return
    tx.date = date_
    tx.money_category_id = category.id
    tx.amount = round(amount, 2)
    tx.description = description
    tx.batch_id = batch_id


# --- Ручные записи ---


def _row(db: Session, tx_id: int) -> dict:
    """Запись журнала одним словарём (для response_model)."""
    rows = [r for r in list_transactions(db) if r["id"] == tx_id]
    return rows[0]


def list_transactions(db: Session, month: str | None = None) -> list[dict]:
    """Записи журнала (свежие сверху); month=YYYY-MM фильтрует по месяцу."""
    stmt = (
        select(
            MoneyTransaction,
            MoneyCategory.name.label("category_name"),
            MoneyCategory.kind.label("category_kind"),
        )
        .join(MoneyCategory, MoneyTransaction.money_category_id == MoneyCategory.id)
        .order_by(MoneyTransaction.date.desc(), MoneyTransaction.id.desc())
    )
    rows = db.execute(stmt).all()
    result = []
    for tx, category_name, category_kind in rows:
        if month is not None:
            m = f"{tx.date.year:04d}-{tx.date.month:02d}"
            if m != month:
                continue
        result.append({
            "id": tx.id,
            "date": tx.date,
            "money_category_id": tx.money_category_id,
            "category_name": category_name,
            "kind": category_kind,
            "amount": float(tx.amount),
            "description": tx.description,
            "batch_id": tx.batch_id,
            "flock_id": tx.flock_id,
            "is_auto": tx.is_auto,
            "source_type": tx.source_type,
        })
    return result


def summary(db: Session, month: str | None = None) -> dict:
    """Итоги: доходы, расходы, баланс (за месяц или за всё время)."""
    txs = list_transactions(db, month)
    income = round(sum(t["amount"] for t in txs if t["kind"] == "income"), 2)
    expense = round(sum(t["amount"] for t in txs if t["kind"] == "expense"), 2)
    return {"income": income, "expense": expense, "balance": round(income - expense, 2)}


def create_transaction(
    db: Session, *, date_: date, money_category_id: int, amount: float,
    description: str | None, batch_id: int | None,
) -> MoneyTransaction:
    cat = db.get(MoneyCategory, money_category_id)
    if cat is None or not cat.is_active:
        raise ValueError("Категория не найдена или выключена")
    if amount <= 0:
        raise ValueError("Сумма должна быть больше 0")
    obj = MoneyTransaction(
        date=date_, money_category_id=money_category_id, amount=round(amount, 2),
        description=description, batch_id=batch_id, is_auto=False,
    )
    db.add(obj)
    db.commit()
    return _row(db, obj.id)


def update_transaction(
    db: Session, tx_id: int, *, date_: date, money_category_id: int, amount: float,
    description: str | None, batch_id: int | None,
) -> MoneyTransaction:
    tx = db.get(MoneyTransaction, tx_id)
    if tx is None:
        raise ValueError("Запись не найдена")
    if tx.is_auto:
        raise ValueError("Автоматическую запись нельзя изменить — правьте исходное событие")
    cat = db.get(MoneyCategory, money_category_id)
    if cat is None or not cat.is_active:
        raise ValueError("Категория не найдена или выключена")
    if amount <= 0:
        raise ValueError("Сумма должна быть больше 0")
    tx.date = date_
    tx.money_category_id = money_category_id
    tx.amount = round(amount, 2)
    tx.description = description
    tx.batch_id = batch_id
    db.commit()
    return _row(db, tx.id)


def delete_transaction(db: Session, tx_id: int) -> None:
    tx = db.get(MoneyTransaction, tx_id)
    if tx is None:
        raise ValueError("Запись не найдена")
    if tx.is_auto:
        raise ValueError("Автоматическую запись нельзя удалить — удалите исходное событие")
    db.delete(tx)
    db.commit()


# --- Кура-дни и распределение общих расходов ---


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _days_by_month(start: date, end: date, heads: int, result: dict[str, int]) -> None:
    """Прибавить в result головы×дни по месяцам (включительно)."""
    if end < start:
        return
    cur = start
    while cur <= end:
        mk = _month_key(cur)
        last_of_month = date(cur.year, cur.month, monthrange(cur.year, cur.month)[1])
        seg_end = min(end, last_of_month)
        result[mk] = result.get(mk, 0) + heads * ((seg_end - cur).days + 1)
        cur = seg_end + timedelta(days=1)


def _batch_days_by_month(db: Session, batch, today: date, result: dict[str, int]) -> None:
    """Кура-дни партии по месяцам с учётом убывания голов (падёж/забой)."""
    end = today
    if batch.status == "closed" and batch.closed_at is not None:
        end = batch.closed_at.date()
    events = sorted(
        [(m.date, m.head_count) for m in db.scalars(select(BatchMortality).where(BatchMortality.batch_id == batch.id))]
        + [(s.date, s.head_count) for s in db.scalars(select(BatchSlaughter).where(BatchSlaughter.batch_id == batch.id))]
    )
    heads = batch.head_count
    cur = batch.start_date
    for ev_date, n in events:
        if ev_date > end:
            break
        # день события считается за головами до события (жили этот день)
        _days_by_month(max(cur, batch.start_date), min(ev_date, end), heads, result)
        heads = max(heads - n, 0)
        cur = ev_date + timedelta(days=1)
    _days_by_month(max(cur, batch.start_date), end, heads, result)


def _flock_days_by_month(db: Session, flock, today: date, result: dict[str, int]) -> None:
    """Кура-дни стада несушек по месяцам (изменения поголовья — по датам событий)."""
    changes = sorted(list(db.scalars(
        select(LayFlockChange).where(LayFlockChange.flock_id == flock.id))))
    # конец содержания: закрытое стадо — дата последнего события (изменение/сбор яйца)
    end = today
    if flock.status == "closed":
        last_change = changes[-1].date if changes else flock.start_date
        last_egg = db.scalar(
            select(func.max(EggCollection.date)).where(EggCollection.flock_id == flock.id))
        candidates = [d for d in (last_change, last_egg) if d is not None]
        end = max(candidates) if candidates else flock.start_date
    heads = 0
    cur = flock.start_date
    for ch in changes:
        if ch.date > end:
            break
        # день изменения считается за поголовьем до изменения
        if cur <= ch.date:
            _days_by_month(max(cur, flock.start_date), min(ch.date, end), heads, result)
        heads = max(heads + ch.head_delta, 0)
        cur = ch.date + timedelta(days=1)
    _days_by_month(max(cur, flock.start_date), end, heads, result)


def chicken_days_by_month(db: Session, today: date | None = None) -> dict[str, int]:
    """Общие кура-дни по месяцам: все партии бройлеров + стада несушек."""
    today = today or date.today()
    result: dict[str, int] = {}
    for batch in db.scalars(select(BroilerBatch)):
        _batch_days_by_month(db, batch, today, result)
    for flock in db.scalars(select(LayFlock)):
        _flock_days_by_month(db, flock, today, result)
    return result


def general_expense_share(db: Session, batch, today: date | None = None) -> float:
    """Доля партии в общих расходах (категории is_general без привязки) по кура-дням."""
    today = today or date.today()

    # месячные корзины общих расходов
    stmt = (
        select(MoneyTransaction.date, MoneyTransaction.amount)
        .join(MoneyCategory, MoneyTransaction.money_category_id == MoneyCategory.id)
        .where(MoneyCategory.is_general == True, MoneyCategory.kind == "expense",  # noqa: E712
               MoneyTransaction.batch_id.is_(None), MoneyTransaction.flock_id.is_(None))
    )
    general: dict[str, float] = {}
    for d, amount in db.execute(stmt).all():
        general[_month_key(d)] = general.get(_month_key(d), 0.0) + float(amount)

    if not general:
        return 0.0

    total_days = chicken_days_by_month(db, today)
    batch_days: dict[str, int] = {}
    _batch_days_by_month(db, batch, today, batch_days)

    share = 0.0
    for mk, days in batch_days.items():
        pool = general.get(mk, 0.0)
        all_days = total_days.get(mk, 0)
        if pool > 0 and all_days > 0 and days > 0:
            share += pool * days / all_days
    return round(share, 2)
