"""Справочники (редактируются в UI). См. docs/data-model.md."""

from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Place(Base):
    """Место содержания (бройлерный модуль, курятник несушек)."""

    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    kind: Mapped[str] = mapped_column(String(20))  # broiler_module | lay_house
    note: Mapped[str | None] = mapped_column(String(500), default=None)


class FeedCategory(Base):
    """Категория корма (старт, рост, финиш, несушка + свои)."""

    __tablename__ = "feed_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class FeedBrand(Base):
    """Производитель корма (для сравнения конверсии)."""

    __tablename__ = "feed_brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Vendor(Base):
    """Продавец (контрагент) с обязательными тегами-типами.

    Типы: chicks (цыплята), feed (корм), meds (лекарства), other (прочее).
    Проверка соответствия тега типу операции — жёсткая, в сервисах.
    """

    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    note: Mapped[str | None] = mapped_column(String(500), default=None)
    types: Mapped[list[str]] = mapped_column(JSON, default=list)


class Buyer(Base):
    """Покупатель продукции (бройлер, яйцо)."""

    __tablename__ = "buyers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(30), default=None)
    address: Mapped[str | None] = mapped_column(String(300), default=None)


class ProductType(Base):
    """Вид мясной продукции (тушка, потроха, печень…).

    unit — единица, которой торгуют этим видом: 'pieces' (тушка, шт) или
    'kg' (потроха, печень и прочее на вес). Используется заказами (§4.7).
    """

    __tablename__ = "product_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    unit: Mapped[str] = mapped_column(String(10), default="kg")  # pieces | kg


class MoneyCategory(Base):
    """Категория денежной операции; kind определяет доход/расход."""

    __tablename__ = "money_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(10))  # income | expense
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # общая категория: нераспределённые расходы в ней делятся по кура-дням (§4.4)
    is_general: Mapped[bool] = mapped_column(default=False)
