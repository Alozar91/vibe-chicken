"""Склад корма и журнал денег. См. docs/data-model.md."""

from datetime import date as Date

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class FeedPurchase(Base):
    """Закупка корма — приход на склад + транзакция денег."""

    __tablename__ = "feed_purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[Date] = mapped_column(Date)
    feed_category_id: Mapped[int] = mapped_column(ForeignKey("feed_categories.id"))
    feed_brand_id: Mapped[int] = mapped_column(ForeignKey("feed_brands.id"))
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"))
    kg: Mapped[float] = mapped_column(Numeric(10, 3))
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2))
    comment: Mapped[str | None] = mapped_column(String(500), default=None)


class FeedAdjustment(Base):
    """Корректировка остатка (инвентаризация); kg_delta со знаком."""

    __tablename__ = "feed_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[Date] = mapped_column(Date)
    feed_category_id: Mapped[int] = mapped_column(ForeignKey("feed_categories.id"))
    feed_brand_id: Mapped[int] = mapped_column(ForeignKey("feed_brands.id"))
    kg_delta: Mapped[float] = mapped_column(Numeric(10, 3))
    comment: Mapped[str | None] = mapped_column(String(300), default=None)


class MoneyTransaction(Base):
    """Единый журнал денег; доход/расход определяется категорией.

    batch_id/flock_id — необязательная привязка к источнику.
    Транзакции от событий (закупка цыплят, корм, лечение, продажи)
    создаются сервисами в той же транзакции БД, что и событие.
    """

    __tablename__ = "money_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[Date] = mapped_column(Date)
    money_category_id: Mapped[int] = mapped_column(ForeignKey("money_categories.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("broiler_batches.id"), default=None, index=True
    )
    flock_id: Mapped[int | None] = mapped_column(
        ForeignKey("lay_flocks.id"), default=None, index=True
    )
