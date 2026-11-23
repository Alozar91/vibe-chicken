"""Pydantic-схемы заказов покупателей (concept.md §4.7)."""

from datetime import date as Date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from pydantic import BaseModel as _BaseModel

from app.schemas.dictionaries import BuyerOut, ProductTypeOut


class OrderProductSaleIn(_BaseModel):
    """Вход продажи продукции из заказа: вид продукции и покупатель подставляются сервисом."""

    date: Date
    product_kg: float = Field(gt=0)
    price_per_kg: float = Field(ge=0)
    total_amount: float | None = Field(default=None, ge=0)


class OrderItemIn(BaseModel):
    """Позиция заказа. kind='egg' → unit='dozens'; kind='product' → unit из вида продукции."""

    kind: Literal["egg", "product"]
    product_type_id: int | None = None
    qty: float = Field(gt=0)
    price_per_unit: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check(self) -> "OrderItemIn":
        if self.kind == "product" and self.product_type_id is None:
            raise ValueError("Для продукции укажите вид продукции")
        if self.kind == "egg" and self.product_type_id is not None:
            raise ValueError("Для яйца вид продукции не указывается")
        return self


class OrderItemOut(OrderItemIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    unit: str
    product_type: ProductTypeOut | None = None


class OrderIn(BaseModel):
    date: Date
    buyer_id: int
    comment: str | None = Field(default=None, max_length=500)
    items: list[OrderItemIn] = Field(min_length=1)

    @model_validator(mode="after")
    def _check(self) -> "OrderIn":
        if not self.items:
            raise ValueError("Добавьте хотя бы одну позицию")
        return self


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: Date
    buyer: BuyerOut
    status: str
    closed_manually: bool
    comment: str | None
    created_at: datetime
    items: list[OrderItemOut]


class OrderStatusIn(BaseModel):
    status: Literal["new", "done", "cancelled"]


class OrderFulfillmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: int
    sale_kind: str
    egg_sale_id: int | None
    batch_sale_id: int | None
    actual_qty: float
    unit: str
    created_at: datetime
    # данные связанной продажи (для отображения в карточке заказа)
    sale_date: Date
    price: float
    amount: float


class OrderMetrics(BaseModel):
    """Плановое vs фактическое по позиции заказа."""

    item_id: int
    kind: str
    unit: str
    product_type_id: int | None
    product_type_name: str | None
    ordered_qty: float
    fulfilled_qty: float
    remaining_qty: float
    pct: float | None  # None — заказанного нет в позициях с продажами


class OrderDetailOut(OrderOut):
    fulfillments: list[OrderFulfillmentOut]
    metrics: list[OrderMetrics]
