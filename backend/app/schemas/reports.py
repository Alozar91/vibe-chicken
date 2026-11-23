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
