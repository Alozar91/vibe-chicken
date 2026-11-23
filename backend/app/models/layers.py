"""Несушки, яйцо, хозяйственные события. См. docs/data-model.md."""

from datetime import date as Date

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LayFlock(Base):
    """Стадо несушек (долгоживущая группа)."""

    __tablename__ = "lay_flocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"))
    start_date: Mapped[Date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | closed


class LayFlockChange(Base):
    """Пополнение/выбраковка стада; текущее поголовье = сумма дельт."""

    __tablename__ = "lay_flock_changes"

    id: Mapped[int] = mapped_column(primary_key=True)
    flock_id: Mapped[int] = mapped_column(ForeignKey("lay_flocks.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    head_delta: Mapped[int]  # + пополнение, − выбраковка
    reason: Mapped[str | None] = mapped_column(String(300), default=None)


class EggCollection(Base):
    """Ежедневный сбор яйца (штук)."""

    __tablename__ = "egg_collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    flock_id: Mapped[int] = mapped_column(ForeignKey("lay_flocks.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    pieces: Mapped[int]


class EggSelfUse(Base):
    """Расход яйца на собственные нужды."""

    __tablename__ = "egg_selfuse"

    id: Mapped[int] = mapped_column(primary_key=True)
    flock_id: Mapped[int] = mapped_column(ForeignKey("lay_flocks.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    pieces: Mapped[int]


class EggSale(Base):
    """Продажа яйца десятками (стадо не указывается — одно)."""

    __tablename__ = "egg_sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[Date] = mapped_column(Date)
    dozens: Mapped[int]
    price_per_ten: Mapped[float] = mapped_column(Numeric(12, 2))
    buyer_id: Mapped[int | None] = mapped_column(ForeignKey("buyers.id"), default=None)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2))


class LayFeeding(Base):
    """Расход корма стадом несушек — списывает со склада."""

    __tablename__ = "lay_feedings"

    id: Mapped[int] = mapped_column(primary_key=True)
    flock_id: Mapped[int] = mapped_column(ForeignKey("lay_flocks.id"), index=True)
    date: Mapped[Date] = mapped_column(Date)
    feed_category_id: Mapped[int] = mapped_column(ForeignKey("feed_categories.id"))
    feed_brand_id: Mapped[int] = mapped_column(ForeignKey("feed_brands.id"))
    kg: Mapped[float] = mapped_column(Numeric(10, 3))


class FarmWriteoff(Base):
    """Списание птицы без привязки к партии (хозяйственное событие)."""

    __tablename__ = "farm_writeoffs"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[Date] = mapped_column(Date)
    head_count: Mapped[int]
    cause: Mapped[str] = mapped_column(String(300))
