"""HTTP-слой журнала денег; вся логика в services/money.py."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.money import MoneySummary, MoneyTransactionIn, MoneyTransactionOut
from app.services import money as svc

router = APIRouter(prefix="/api/money", tags=["money"])


def _handle(fn, db: Session, *args, **kwargs):
    try:
        return fn(db, *args, **kwargs)
    except ValueError as e:
        msg = str(e)
        code = 404 if ("не найден" in msg or "не найдена" in msg) else 400
        raise HTTPException(status_code=code, detail=msg) from None


@router.get("/transactions", response_model=list[MoneyTransactionOut])
def list_transactions(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    return svc.list_transactions(db, month)


@router.get("/summary", response_model=MoneySummary)
def summary(
    month: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}$"),
    db: Session = Depends(get_db),
):
    return svc.summary(db, month)


@router.post("/transactions", response_model=MoneyTransactionOut, status_code=201)
def create_transaction(data: MoneyTransactionIn, db: Session = Depends(get_db)):
    return _handle(
        svc.create_transaction, db,
        date_=data.date, money_category_id=data.money_category_id,
        amount=data.amount, description=data.description, batch_id=data.batch_id,
    )


@router.put("/transactions/{tx_id}", response_model=MoneyTransactionOut)
def update_transaction(tx_id: int, data: MoneyTransactionIn, db: Session = Depends(get_db)):
    return _handle(
        svc.update_transaction, db, tx_id,
        date_=data.date, money_category_id=data.money_category_id,
        amount=data.amount, description=data.description, batch_id=data.batch_id,
    )


@router.delete("/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_transaction, db, tx_id)
