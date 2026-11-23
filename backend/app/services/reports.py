"""Отчёты: агрегаты по журналу денег, яйцу, покупателям и партиям.

Все вычисления — на бэкенде (стандарты §2.4); переиспользуем
money.list_transactions и broiler.compute_metrics.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.broiler import BatchFeeding, BatchSale, BroilerBatch
from app.models.dictionaries import Buyer, Place
from app.models.layers import EggCollection, EggSale, EggSelfUse
from app.models.warehouse import FeedPurchase
from app.schemas.reports import (
    BatchRow,
    BuyerRow,
    CategorySlice,
    EggMonthPoint,
    MonthPoint,
)
from app.services import broiler as broiler_svc
from app.services import money as money_svc


def _month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def _last_months(n: int, today: date | None = None) -> list[str]:
    """Последние n месяцев (включая текущий), по возрастанию."""
    today = today or date.today()
    result = []
    y, m = today.year, today.month
    for _ in range(n):
        result.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(result))


def _period_start(months: int, today: date | None = None) -> date:
    """Первое число первого месяца периода (для фильтра по датам)."""
    today = today or date.today()
    y, m = today.year, today.month
    for _ in range(months - 1):
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return date(y, m, 1)


def monthly(db: Session, months: int = 12, today: date | None = None) -> list[MonthPoint]:
    """Доходы/расходы/баланс по месяцам (журнал денег), непрерывная ось."""
    keys = _last_months(months, today)
    acc: dict[str, dict[str, float]] = {k: {"income": 0.0, "expense": 0.0} for k in keys}
    for t in money_svc.list_transactions(db):
        k = _month_key(t["date"])
        if k in acc:
            acc[k][t["kind"]] += t["amount"]
    return [
        MonthPoint(
            month=k,
            income=round(v["income"], 2),
            expense=round(v["expense"], 2),
            balance=round(v["income"] - v["expense"], 2),
        )
        for k, v in acc.items()
    ]


def categories(db: Session, month: str | None = None, today: date | None = None) -> list[CategorySlice]:
    """Суммы по категориям денег за месяц (по умолчанию — текущий)."""
    month = month or _month_key(today or date.today())
    slices: dict[int, CategorySlice] = {}
    for t in money_svc.list_transactions(db, month):
        s = slices.get(t["money_category_id"])
        if s is None:
            s = CategorySlice(
                category_id=t["money_category_id"], name=t["category_name"],
                kind=t["kind"], total=0.0,
            )
            slices[t["money_category_id"]] = s
        s.total = round(s.total + t["amount"], 2)
    return sorted(slices.values(), key=lambda s: (s.kind, -s.total))


def eggs_by_month(db: Session, months: int = 6, today: date | None = None) -> list[EggMonthPoint]:
    """Яйцо по месяцам: сбор, самопотребление, продажи, выручка."""
    keys = _last_months(months, today)
    start = date.fromisoformat(keys[0] + "-01")

    def _sum(stmt) -> dict[str, float]:
        result: dict[str, float] = {}
        for d, v in db.execute(stmt):
            if d is None:
                continue
            result[_month_key(d)] = result.get(_month_key(d), 0.0) + float(v)
        return result

    collected = _sum(
        select(EggCollection.date, func.sum(EggCollection.pieces))
        .where(EggCollection.date >= start).group_by(EggCollection.date))
    selfused = _sum(
        select(EggSelfUse.date, func.sum(EggSelfUse.pieces))
        .where(EggSelfUse.date >= start).group_by(EggSelfUse.date))
    sold = _sum(
        select(EggSale.date, func.sum(EggSale.dozens))
        .where(EggSale.date >= start).group_by(EggSale.date))
    revenue = _sum(
        select(EggSale.date, func.sum(EggSale.total_amount))
        .where(EggSale.date >= start).group_by(EggSale.date))

    return [
        EggMonthPoint(
            month=k,
            collected=int(collected.get(k, 0.0)),
            selfused=int(selfused.get(k, 0.0)),
            dozens_sold=int(sold.get(k, 0.0)),
            revenue=round(revenue.get(k, 0.0), 2),
        )
        for k in keys
    ]


def buyers(db: Session, months: int = 12, today: date | None = None) -> list[BuyerRow]:
    """Продажи по покупателям за период (бройлер по кг/суммам + яйцо)."""
    start = _period_start(months, today)
    names: dict[int | None, str] = {b.id: b.name for b in db.scalars(select(Buyer))}
    acc: dict[int | None, dict[str, float]] = {}

    def _add(key: int | None, field: str, value: float) -> None:
        row = acc.setdefault(key, {"broiler_kg": 0.0, "broiler_amount": 0.0,
                                   "egg_dozens": 0.0, "egg_amount": 0.0})
        row[field] = row[field] + value

    stmt = select(BatchSale.date, BatchSale.buyer_id, BatchSale.product_kg, BatchSale.total_amount).where(
        BatchSale.date >= start)
    for _, buyer_id, kg, amount in db.execute(stmt):
        _add(buyer_id, "broiler_kg", float(kg))
        _add(buyer_id, "broiler_amount", float(amount))
    for d, buyer_id, dozens, amount in db.execute(
            select(EggSale.date, EggSale.buyer_id, EggSale.dozens, EggSale.total_amount)
            .where(EggSale.date >= start)):
        _add(buyer_id, "egg_dozens", float(dozens))
        _add(buyer_id, "egg_amount", float(amount))

    rows = []
    for key, v in acc.items():
        rows.append(BuyerRow(
            buyer_id=key,
            name=names.get(key, "Без покупателя") if key is not None else "Без покупателя",
            broiler_kg=round(v["broiler_kg"], 3),
            broiler_amount=round(v["broiler_amount"], 2),
            egg_dozens=int(v["egg_dozens"]),
            egg_amount=round(v["egg_amount"], 2),
            total=round(v["broiler_amount"] + v["egg_amount"], 2),
        ))
    return sorted(rows, key=lambda r: -r.total)


def _feed_price_per_kg(db: Session) -> dict[tuple[int, int], float]:
    """Средняя цена кг корма по (категория, производитель): Σcost/Σkg закупок."""
    rows = db.execute(
        select(
            FeedPurchase.feed_category_id,
            FeedPurchase.feed_brand_id,
            func.sum(FeedPurchase.kg),
            func.sum(FeedPurchase.total_cost),
        ).group_by(FeedPurchase.feed_category_id, FeedPurchase.feed_brand_id)
    ).all()
    return {
        (cat_id, brand_id): round(float(cost) / float(kg), 4)
        for cat_id, brand_id, kg, cost in rows if float(kg) > 0
    }


def batches(db: Session, today: date | None = None) -> list[BatchRow]:
    """Сравнение партий: экономика каждой партии + оценка стоимости корма."""
    prices = _feed_price_per_kg(db)
    places = {p.id: p.name for p in db.scalars(select(Place))}
    result: list[BatchRow] = []
    for batch in db.scalars(select(BroilerBatch).order_by(BroilerBatch.start_date.desc())):
        m = broiler_svc.compute_metrics(db, batch.id)

        feedings = db.execute(
            select(BatchFeeding.feed_category_id, BatchFeeding.feed_brand_id, func.sum(BatchFeeding.kg))
            .where(BatchFeeding.batch_id == batch.id)
            .group_by(BatchFeeding.feed_category_id, BatchFeeding.feed_brand_id)
        ).all()
        feed_cost = round(sum(float(kg) * prices.get((c, b), 0.0) for c, b, kg in feedings), 2)

        direct = round(m.direct_costs + feed_cost, 2)
        profit = round(m.revenue - direct - m.shared_costs, 2) if m.revenue > 0 else None
        profit_per_head = round(profit / batch.head_count, 2) if profit is not None and batch.head_count else None

        result.append(BatchRow(
            id=batch.id,
            code=batch.code,
            place_name=places.get(batch.place_id, ""),
            status=batch.status,
            start_date=batch.start_date.isoformat(),
            survival_pct=m.survival_pct,
            fcr=m.fcr,
            feed_kg=m.feed_kg,
            feed_cost=feed_cost,
            direct_costs=direct,
            shared_costs=m.shared_costs,
            revenue=m.revenue,
            profit=profit,
            profit_per_head=profit_per_head,
        ))
    return result
