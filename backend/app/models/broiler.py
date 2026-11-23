"""Бройлеры: партии и события. См. docs/data-model.md."""

from datetime import date as Date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class BroilerBatch(Base):
    """Партия бройлера (потомство одного закупа)."""

    __tablename__ = "broiler_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"))
    start_date: Mapped[Date] = mapped_column(Date)
    # Возраст при поступлении (дней): 1 = суточные; подрощенные — больше.
    # Текущий возраст = (дата − start_date) + arrival_age_days; кура-дни
    # (общие расходы) считаются только от start_date — реальное пребывание на ферме.
    arrival_age_days: Mapped[int] = mapped_column(default=1)
    head_count: Mapped[int]
    cross: Mapped[str | None] = mapped_column(String(50), default=None)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    chick_price_per_head: Mapped[float] = mapped_column(Numeric(12, 2))
    chick_avg_weight_kg: Mapped[float | None] = mapped_column(Numeric(6, 3), default=None)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | closed
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    place = relationship("Place")
    vendor = relationship("Vendor")


class BatchMortality(Base):
    """Падёж в партии."""

    __tablename__ = "batch_mortalities"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("broiler_batches.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    head_count: Mapped[int]
    cause: Mapped[str | None] = mapped_column(String(300), default=None)


class BatchFeeding(Base):
    """Расход корма партией — списывает со склада."""

    __tablename__ = "batch_feedings"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("broiler_batches.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    feed_category_id: Mapped[int] = mapped_column(ForeignKey("feed_categories.id"))
    feed_brand_id: Mapped[int] = mapped_column(ForeignKey("feed_brands.id"))
    kg: Mapped[float] = mapped_column(Numeric(10, 3))


class BatchWeighing(Base):
    """Контрольное взвешивание (опционально)."""

    __tablename__ = "batch_weighings"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("broiler_batches.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    head_count: Mapped[int]
    avg_weight_kg: Mapped[float] = mapped_column(Numeric(6, 3))


class BatchTreatment(Base):
    """Обработка/лечение партии с стоимостью."""

    __tablename__ = "batch_treatments"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("broiler_batches.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(500))
    cost: Mapped[float] = mapped_column(Numeric(12, 2))


class BatchSlaughter(Base):
    """Забой и разделка (живой вес); выход по видам — в slaughter_outputs."""

    __tablename__ = "batch_slaughters"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("broiler_batches.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    head_count: Mapped[int]
    live_weight_kg: Mapped[float] = mapped_column(Numeric(10, 3))

    outputs = relationship(
        "SlaughterOutput", cascade="all, delete-orphan", back_populates="slaughter"
    )


class SlaughterOutput(Base):
    """Выход продукции по видам для одного забоя."""

    __tablename__ = "slaughter_outputs"

    id: Mapped[int] = mapped_column(primary_key=True)
    slaughter_id: Mapped[int] = mapped_column(
        ForeignKey("batch_slaughters.id", ondelete="CASCADE"), index=True
    )
    product_type_id: Mapped[int] = mapped_column(ForeignKey("product_types.id"))
    kg: Mapped[float] = mapped_column(Numeric(10, 3))

    slaughter = relationship("BatchSlaughter", back_populates="outputs")
    product_type = relationship("ProductType")


class BatchSale(Base):
    """Реализация продукции по весу конкретного вида."""

    __tablename__ = "batch_sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("broiler_batches.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    product_type_id: Mapped[int] = mapped_column(ForeignKey("product_types.id"))
    product_kg: Mapped[float] = mapped_column(Numeric(10, 3))
    price_per_kg: Mapped[float] = mapped_column(Numeric(12, 2))
    buyer_id: Mapped[int | None] = mapped_column(ForeignKey("buyers.id"), default=None)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2))
