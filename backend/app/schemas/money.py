"""Схемы журнала денег."""

from datetime import date as Date

from pydantic import BaseModel, ConfigDict, Field


class MoneyTransactionIn(BaseModel):
    date: Date
    money_category_id: int
    amount: float = Field(gt=0)
    description: str | None = Field(default=None, max_length=500)
    batch_id: int | None = None


class MoneyTransactionOut(MoneyTransactionIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_name: str
    kind: str
    is_auto: bool
    source_type: str | None


class MoneySummary(BaseModel):
    income: float
    expense: float
    balance: float
