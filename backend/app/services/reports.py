"""Отчёты: агрегаты по журналу денег, яйцу, покупателям и партиям.

Все вычисления — на бэкенде (стандарты §2.4); переиспользуем
money.list_transactions и broiler.compute_metrics.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.broiler import (
    BatchFeeding,
    BatchMortality,
    BatchSale,
    BatchSlaughter,
    BatchWeighing,
    BroilerBatch,
)
from app.models.dictionaries import Buyer, Place, ProductType
from app.models.layers import EggCollection, EggSale, EggSelfUse
from app.models.orders import Order, OrderItem
from app.models.warehouse import FeedPurchase
from app.schemas.reports import (
    BatchRow,
    BuyerRow,
    CategorySlice,
    DashboardBatch,
    DashboardOrder,
    DashboardOrderItem,
    DashboardOut,
    DashboardWeighing,
    EggMonthPoint,
    MonthPoint,
    ProductRow,
)
from app.services import broiler as broiler_svc
from app.services import feed as feed_svc
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


def products(db: Session, months: int = 12, today: date | None = None) -> list[ProductRow]:
    """Продажи по видам продукции за период (§4.9): бройлерная продукция
    по видам справочника + яйцо отдельной строкой (в дес). Сортировка по сумме.
    """
    start = _period_start(months, today)
    acc: dict[int | None, dict[str, float]] = {}

    def _add(key: int | None, field: str, value: float) -> None:
        row = acc.setdefault(key, {"kg": 0.0, "amount": 0.0, "count": 0.0, "dozen": 0.0})
        row[field] = row[field] + value

    # продажи продукции: вес и сумма по виду
    stmt = select(
        BatchSale.product_type_id, BatchSale.product_kg, BatchSale.total_amount
    ).where(BatchSale.date >= start)
    for pt_id, kg, amount in db.execute(stmt):
        _add(pt_id, "kg", float(kg))
        _add(pt_id, "amount", float(amount))
        _add(pt_id, "count", 1)
    # яйцо: product_type_id = None
    for dozens, amount in db.execute(
            select(EggSale.dozens, EggSale.total_amount).where(EggSale.date >= start)):
        _add(None, "amount", float(amount))
        _add(None, "count", 1)
        _add(None, "dozen", float(dozens))

    type_names = {t.id: t.name for t in db.scalars(select(ProductType))}
    type_units = {t.id: t.unit for t in db.scalars(select(ProductType))}
    rows = []
    for key, v in acc.items():
        if key is None:
            rows.append(ProductRow(
                product_type_id=None, name="Яйцо", unit="dozen",
                kg=0.0, dozen=int(v["dozen"]),
                amount=round(v["amount"], 2), sales_count=int(v["count"]),
            ))
        else:
            rows.append(ProductRow(
                product_type_id=key,
                name=type_names.get(key, f"Вид {key}"),
                unit=type_units.get(key, "kg"),
                kg=round(v["kg"], 3),
                amount=round(v["amount"], 2),
                sales_count=int(v["count"]),
            ))
    return sorted(rows, key=lambda r: -r.amount)


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


def dashboard(db: Session, today: date | None = None) -> DashboardOut:
    """Сводка для дашборда: KPI за месяц + последние партии и заказы.

    Агрегаты — запросами; возраст партий и живое поголовье считает бэкенд
    (стандарты §2.4). Последние партии — 5 последних по дате поступления
    (активные и закрытые, статус отдаём как есть), последние заказы — 5
    последних по дате.
    """
    today = today or date.today()
    month_key = _month_key(today)

    # --- деньги за текущий месяц ---
    income = expense = 0.0
    for t in money_svc.list_transactions(db, month_key):
        if t["kind"] == "income":
            income += t["amount"]
        else:
            expense += t["amount"]

    # --- яйцо за текущий месяц ---
    start = date.fromisoformat(month_key + "-01")
    collected = int(db.scalar(
        select(func.coalesce(func.sum(EggCollection.pieces), 0))
        .where(EggCollection.date >= start)
    ) or 0)
    dozens_sold = float(db.scalar(
        select(func.coalesce(func.sum(EggSale.dozens), 0))
        .where(EggSale.date >= start)
    ) or 0)

    # --- активные партии: количество и живые головы ---
    active = list(db.scalars(
        select(BroilerBatch).where(BroilerBatch.status == "active")
    ))
    active_ids = [b.id for b in active]
    dead_by_batch: dict[int, int] = {}
    slaught_by_batch: dict[int, int] = {}
    if active_ids:
        for bid, n in db.execute(
            select(BatchMortality.batch_id, func.coalesce(func.sum(BatchMortality.head_count), 0))
            .where(BatchMortality.batch_id.in_(active_ids)).group_by(BatchMortality.batch_id)
        ).all():
            dead_by_batch[bid] = int(n)
        for bid, n in db.execute(
            select(BatchSlaughter.batch_id, func.coalesce(func.sum(BatchSlaughter.head_count), 0))
            .where(BatchSlaughter.batch_id.in_(active_ids)).group_by(BatchSlaughter.batch_id)
        ).all():
            slaught_by_batch[bid] = int(n)

    def _alive(batch: BroilerBatch) -> int:
        return batch.head_count - dead_by_batch.get(batch.id, 0) - slaught_by_batch.get(batch.id, 0)

    # --- последние партии (5, по дате поступления) ---
    recent = list(db.scalars(
        select(BroilerBatch).order_by(BroilerBatch.start_date.desc(), BroilerBatch.id.desc()).limit(5)
    ))
    recent_ids = [b.id for b in recent]
    # падёж/забой/взвешивания для выбранных партий
    dead_r: dict[int, int] = {}
    slaught_r: dict[int, int] = {}
    last_weighing: dict[int, BatchWeighing] = {}
    if recent_ids:
        for bid, n in db.execute(
            select(BatchMortality.batch_id, func.coalesce(func.sum(BatchMortality.head_count), 0))
            .where(BatchMortality.batch_id.in_(recent_ids)).group_by(BatchMortality.batch_id)
        ).all():
            dead_r[bid] = int(n)
        for bid, n in db.execute(
            select(BatchSlaughter.batch_id, func.coalesce(func.sum(BatchSlaughter.head_count), 0))
            .where(BatchSlaughter.batch_id.in_(recent_ids)).group_by(BatchSlaughter.batch_id)
        ).all():
            slaught_r[bid] = int(n)
        # последнее взвешивание: максимальная дата, при равенстве — больший id
        rows = db.execute(
            select(BatchWeighing.batch_id, func.max(BatchWeighing.date))
            .where(BatchWeighing.batch_id.in_(recent_ids)).group_by(BatchWeighing.batch_id)
        ).all()
        for bid, max_date in rows:
            w = db.scalar(
                select(BatchWeighing)
                .where(BatchWeighing.batch_id == bid, BatchWeighing.date == max_date)
                .order_by(BatchWeighing.id.desc()).limit(1)
            )
            if w is not None:
                last_weighing[bid] = w

    places = {p.id: p.name for p in db.scalars(select(Place))}
    recent_batches = []
    for b in recent:
        w = last_weighing.get(b.id)
        recent_batches.append(DashboardBatch(
            id=b.id,
            code=b.code,
            place_name=places.get(b.place_id, ""),
            start_date=b.start_date.isoformat(),
            status=b.status,
            heads_alive=b.head_count - dead_r.get(b.id, 0) - slaught_r.get(b.id, 0),
            age_days=broiler_svc.batch_age_days(b, today) if b.status == "active" else None,
            last_weighing=DashboardWeighing(
                date=w.date.isoformat(), avg_weight_kg=float(w.avg_weight_kg),
            ) if w else None,
        ))

    # --- последние заказы (5) ---
    orders = list(db.scalars(
        select(Order).order_by(Order.date.desc(), Order.id.desc()).limit(5)
    ))
    buyer_names = {b.id: b.name for b in db.scalars(select(Buyer))}
    recent_orders = []
    for o in orders:
        items = list(db.scalars(select(OrderItem).where(OrderItem.order_id == o.id)))
        recent_orders.append(DashboardOrder(
            id=o.id,
            date=o.date.isoformat(),
            buyer_name=buyer_names.get(o.buyer_id, ""),
            status=o.status,
            items=[
                DashboardOrderItem(kind=i.kind, qty=float(i.qty), unit=i.unit) for i in items
            ],
        ))

    # --- открытые заказы (все, не только последние) ---
    orders_open = int(db.scalar(
        select(func.count(Order.id)).where(Order.status == "new")
    ) or 0)

    # --- корм на складе ---
    stock_kg = feed_svc.total_stock_kg(db)

    return DashboardOut(
        month_income=round(income, 2),
        month_expense=round(expense, 2),
        month_balance=round(income - expense, 2),
        egg_collected=collected,
        egg_dozens_sold=round(dozens_sold),
        active_batches=len(active),
        active_heads=sum(_alive(b) for b in active),
        orders_open=orders_open,
        feed_stock_kg=stock_kg,
        recent_batches=recent_batches,
        recent_orders=recent_orders,
    )
