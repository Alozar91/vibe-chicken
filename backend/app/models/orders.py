"""Заказы покупателей (docs/concept.md §4.7). Заказ — план; факт живёт в продажах."""

from datetime import date as Date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Order(Base):
    """Заказ покупателя: что и сколько хотели (план).

    Статусы: new → done / cancelled. Статус done ставится автоматически,
    когда по всем позициям продано не меньше заказанного, либо вручную.
    """

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[Date] = mapped_column(Date)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("buyers.id"))
    status: Mapped[str] = mapped_column(String(10), default="new")  # new | done | cancelled
    closed_manually: Mapped[bool] = mapped_column(Boolean, default=False)
    comment: Mapped[str | None] = mapped_column(String(500), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=None)

    buyer = relationship("Buyer")
    items = relationship("OrderItem", cascade="all, delete-orphan", order_by="OrderItem.id")


class OrderItem(Base):
    """Позиция заказа.

    kind='egg' — яйцо, qty в десятках (unit='dozens').
    kind='product' — мясная продукция из справочника product_types;
    единица берётся из product_types.unit: 'pieces' (тушка) или 'kg' (потроха, печень).
    """

    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # egg | product
    product_type_id: Mapped[int | None] = mapped_column(ForeignKey("product_types.id"), default=None)
    qty: Mapped[float] = mapped_column(Numeric(12, 3))
    unit: Mapped[str] = mapped_column(String(10))  # dozens | pieces | kg
    price_per_unit: Mapped[float | None] = mapped_column(Numeric(12, 2), default=None)

    product_type = relationship("ProductType")


class OrderFulfillment(Base):
    """Связь позиции заказа с фактической продажей, созданной из заказа.

    actual_qty — сколько продано, в единице позиции (снимок на момент продажи);
    для тушек шт пересчитывается из кг продажи по среднему весу тушки.
    """

    __tablename__ = "order_fulfillments"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"), index=True)
    sale_kind: Mapped[str] = mapped_column(String(20))  # egg_sale | batch_sale
    egg_sale_id: Mapped[int | None] = mapped_column(ForeignKey("egg_sales.id"), default=None)
    batch_sale_id: Mapped[int | None] = mapped_column(ForeignKey("batch_sales.id"), default=None)
    actual_qty: Mapped[float] = mapped_column(Numeric(12, 3))
    unit: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=None)
