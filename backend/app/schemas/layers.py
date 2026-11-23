"""Схемы несушек и яйца."""

from datetime import date as Date

from pydantic import BaseModel, ConfigDict, Field


class LayFlockIn(BaseModel):
    name: str = Field(max_length=100)
    place_id: int
    start_date: Date


class LayFlockOut(LayFlockIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str


class LayFlockChangeIn(BaseModel):
    date: Date
    head_delta: int  # + пополнение, − выбраковка
    reason: str | None = Field(default=None, max_length=300)


class LayFlockChangeOut(LayFlockChangeIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class EggCollectionIn(BaseModel):
    date: Date
    pieces: int = Field(gt=0)


class EggCollectionOut(EggCollectionIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class EggSaleIn(BaseModel):
    date: Date
    dozens: int = Field(gt=0)
    price_per_ten: float = Field(ge=0)
    buyer_id: int | None = None
    total_amount: float | None = Field(default=None, ge=0)


class EggSaleOut(EggSaleIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class EggSelfUseIn(BaseModel):
    date: Date
    pieces: int = Field(gt=0)


class EggSelfUseOut(EggSelfUseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class LayFeedingIn(BaseModel):
    date: Date
    feed_category_id: int
    feed_brand_id: int
    kg: float = Field(gt=0)


class LayFeedingOut(LayFeedingIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class FlockMetrics(BaseModel):
    """Метрики стада несушек — считаются на бэкенде (стандарты §2.4)."""

    current_head: int  # Σ дельт изменений
    eggs_total: int  # Σ сборов (шт)
    dozens_sold: int  # продано десятков
    egg_revenue: float  # Σ продаж яйца
    selfuse_total: int  # съедено сами (шт)
    feed_kg: float  # Σ корма стадом
    lay_rate_pct: float | None  # яйценоскость: яйца за 7 дней / (поголовье×7) × 100
