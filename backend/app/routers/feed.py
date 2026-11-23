"""HTTP-слой склада корма. Логика — в services/feed.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.warehouse import FeedAdjustment, FeedPurchase
from app.schemas.feed import (
    FeedAdjustmentIn,
    FeedAdjustmentOut,
    FeedPurchaseIn,
    FeedPurchaseOut,
    FeedStockRow,
)
from app.services import feed as svc

router = APIRouter(prefix="/api/feed", tags=["feed"],
                   dependencies=[Depends(get_current_user)])


def _handle(fn, *args):
    try:
        return fn(*args)
    except ValueError as e:
        msg = str(e)
        status = 404 if msg.endswith("не найден") or msg.endswith("не найдена") else 400
        raise HTTPException(status_code=status, detail=msg) from None


# --- Остатки ---
@router.get("/stock", response_model=list[FeedStockRow])
def stock(db: Session = Depends(get_db)):
    return svc.stock_rows(db)


# --- Закупки ---
@router.get("/purchases", response_model=list[FeedPurchaseOut])
def purchases(db: Session = Depends(get_db)):
    return svc.list_purchases(db)


@router.post("/purchases", response_model=FeedPurchaseOut, status_code=201)
def create_purchase(data: FeedPurchaseIn, db: Session = Depends(get_db)):
    return _handle(svc.create_purchase, db, data)


@router.delete("/purchases/{purchase_id}", status_code=204)
def delete_purchase(purchase_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_purchase, db, purchase_id)


# --- Корректировки ---
@router.get("/adjustments", response_model=list[FeedAdjustmentOut])
def adjustments(db: Session = Depends(get_db)):
    return svc.list_adjustments(db)


@router.post("/adjustments", response_model=FeedAdjustmentOut, status_code=201)
def create_adjustment(data: FeedAdjustmentIn, db: Session = Depends(get_db)):
    return _handle(svc.create_adjustment, db, data)


@router.delete("/adjustments/{adjustment_id}", status_code=204)
def delete_adjustment(adjustment_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_adjustment, db, adjustment_id)
