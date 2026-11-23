"""Pydantic-схемы партий бройлеров и их событий."""

from datetime import date as Date, datetime

from pydantic import BaseModel, ConfigDict, Field


class BatchIn(BaseModel):
    code: str = Field(max_length=30)
    place_id: int
    start_date: Date
    head_count: int = Field(gt=0)
    cross: str | None = Field(default=None, max_length=50)
    vendor_id: int
    chick_price_per_head: float = Field(ge=0)
    chick_avg_weight_kg: float | None = Field(default=None, gt=0)


class BatchOut(BatchIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    closed_at: datetime | None = None
    place_name: str | None = None
    vendor_name: str | None = None


class BatchMetrics(BaseModel):
    """Метрики партии — считаются на бэкенде (стандарты §2.4)."""

    current_head: int  # head_count − падёж − забитые
    slaughtered_head: int
    dead_head: int
    survival_pct: float | None  # (забитые + падёж)/head_count
    fcr: float | None  # конверсия корма; None = «нет данных»
    feed_kg: float
    live_weight_kg: float  # Σ предубойного живого веса
    output_kg: float  # Σ продукции по всем видам
    output_pct: float | None  # выход продукции от живого веса
    direct_costs: float  # цыплята + корм (доля) + лечение
    revenue: float  # Σ продаж
    profit: float | None  # выручка − прямые затраты (общие — позже)


class MortalityIn(BaseModel):
    date: Date
    head_count: int = Field(gt=0)
    cause: str | None = Field(default=None, max_length=300)


class MortalityOut(MortalityIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int


class FeedingIn(BaseModel):
    date: Date
    feed_category_id: int
    feed_brand_id: int
    kg: float = Field(gt=0)


class FeedingOut(FeedingIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    feed_category_name: str | None = None
    feed_brand_name: str | None = None


class WeighingIn(BaseModel):
    date: Date
    head_count: int = Field(gt=0)
    avg_weight_kg: float = Field(gt=0)


class WeighingOut(WeighingIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int


class TreatmentIn(BaseModel):
    date: Date
    description: str = Field(max_length=300)
    cost: float = Field(ge=0)


class TreatmentOut(TreatmentIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int


class SlaughterOutputIn(BaseModel):
    product_type_id: int
    kg: float = Field(gt=0)


class SlaughterOutputOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_type_id: int
    kg: float
    product_type_name: str | None = None


class SlaughterIn(BaseModel):
    date: Date
    head_count: int = Field(gt=0)
    live_weight_kg: float = Field(gt=0)
    outputs: list[SlaughterOutputIn] = Field(min_length=1)


class SlaughterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    date: Date
    head_count: int
    live_weight_kg: float
    outputs: list[SlaughterOutputOut] = []


class SaleIn(BaseModel):
    date: Date
    product_type_id: int
    product_kg: float = Field(gt=0)
    price_per_kg: float = Field(ge=0)
    buyer_id: int | None = None
    total_amount: float | None = Field(default=None, ge=0)


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    date: Date
    product_type_id: int
    product_kg: float
    price_per_kg: float
    buyer_id: int | None
    total_amount: float
    product_type_name: str | None = None
    buyer_name: str | None = None
