"""Схемы отчётов. Агрегаты считаются на бэкенде (стандарты §2.4)."""

from pydantic import BaseModel


class MonthPoint(BaseModel):
    """Доходы/расходы/баланс за один месяц."""

    month: str  # YYYY-MM
    income: float
    expense: float
    balance: float


class CategorySlice(BaseModel):
    """Срез по категории денег за период."""

    category_id: int
    name: str
    kind: str  # income | expense
    total: float


class EggMonthPoint(BaseModel):
    """Яйцо за месяц: сбор, самопотребление, продажи, выручка."""

    month: str  # YYYY-MM
    collected: int  # шт
    selfused: int  # шт
    dozens_sold: int
    revenue: float


class BuyerRow(BaseModel):
    """Продажи по покупателю за период (бройлер + яйцо)."""

    buyer_id: int | None
    name: str
    broiler_kg: float
    broiler_amount: float
    egg_dozens: int
    egg_amount: float
    total: float


class ProductRow(BaseModel):
    """Продажи по виду продукции за период (яйцо — отдельной строкой)."""

    product_type_id: int | None  # None — яйцо (у него нет вида)
    name: str
    unit: str  # kg | pieces | dozen (яйцо)
    kg: float  # вес продаж (для pieces — вес тушек)
    dozen: int | None = None  # только для яйца, дес
    amount: float
    sales_count: int


class BatchRow(BaseModel):
    """Строка сравнения партий (экономика партии)."""

    id: int
    code: str
    place_name: str
    status: str
    start_date: str
    survival_pct: float | None
    fcr: float | None
    feed_kg: float
    feed_cost: float
    direct_costs: float
    shared_costs: float
    revenue: float
    profit: float | None
    profit_per_head: float | None


class DashboardWeighing(BaseModel):
    """Последнее контрольное взвешивание партии."""

    date: str
    avg_weight_kg: float


class DashboardBatch(BaseModel):
    """Партия для дашборда: живое поголовье, возраст, последнее взвешивание."""

    id: int
    code: str
    place_name: str
    start_date: str
    status: str
    heads_alive: int
    age_days: int | None = None  # только для активных (закрытым возраст не показываем)
    last_weighing: DashboardWeighing | None = None


class DashboardOrderItem(BaseModel):
    """Позиция заказа для дашборда."""

    kind: str  # egg | product
    qty: float
    unit: str  # dozens | pieces | kg


class DashboardOrder(BaseModel):
    """Заказ для дашборда (кратко)."""

    id: int
    date: str
    buyer_name: str
    status: str
    items: list[DashboardOrderItem]


class DashboardOut(BaseModel):
    """Данные дашборда: KPI-карточки + последние партии и заказы."""

    # деньги за текущий месяц
    month_income: float
    month_expense: float
    month_balance: float

    # яйцо за текущий месяц
    egg_collected: int
    egg_dozens_sold: int

    # активные партии
    active_batches: int
    active_heads: int

    # открытые заказы
    orders_open: int

    # корм на складе, кг (суммарный остаток)
    feed_stock_kg: float

    recent_batches: list[DashboardBatch]
    recent_orders: list[DashboardOrder]
