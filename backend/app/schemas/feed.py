"""Pydantic-схемы склада корма."""

from datetime import date as Date

from pydantic import BaseModel, ConfigDict, Field


class FeedPurchaseIn(BaseModel):
    date: Date
    feed_category_id: int
    feed_brand_id: int
    vendor_id: int
    kg: float = Field(gt=0)
    total_cost: float = Field(ge=0)
    comment: str | None = Field(default=None, max_length=500)


class FeedPurchaseOut(FeedPurchaseIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vendor_name: str | None = None
    feed_category_name: str | None = None
    feed_brand_name: str | None = None


class FeedAdjustmentIn(BaseModel):
    date: Date
    feed_category_id: int
    feed_brand_id: int
    kg_delta: float  # со знаком: + инвентаризация нашла, - усушка/потери
    comment: str | None = Field(default=None, max_length=300)


class FeedAdjustmentOut(FeedAdjustmentIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    feed_category_name: str | None = None
    feed_brand_name: str | None = None


class FeedStockRow(BaseModel):
    """Остаток по паре «категория × производитель» (считается из событий)."""

    feed_category_id: int
    feed_brand_id: int
    feed_category_name: str
    feed_brand_name: str
    purchased_kg: float
    used_kg: float  # партии + несушки
    adjusted_kg: float  # сумма корректировок (со знаком)
    stock_kg: float
