"""HTTP-роутеры заказов покупателей (§4.7). Бизнес-логика — в services/orders.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.schemas.orders import OrderProductSaleIn
from app.schemas.layers import EggSaleIn
from app.schemas.orders import (
    OrderDetailOut,
    OrderProductSaleIn,
    OrderFulfillmentOut,
    OrderIn,
    OrderOut,
    OrderStatusIn,
)
from app.services import orders as svc

router = APIRouter(prefix="/api/orders", tags=["orders"],
                   dependencies=[Depends(get_current_user)])


def _handle(fn, *args):
    try:
        return fn(*args)
    except ValueError as e:
        msg = str(e)
        status = 404 if "не найден" in msg or "не найдена" in msg else 400
        raise HTTPException(status_code=status, detail=msg) from None


@router.get("", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    return svc.list_orders(db)


@router.get("/carcass-weight")
def carcass_weight(db: Session = Depends(get_db)):
    """Средний вес тушки по всем забоям — для пересчёта шт → кг в форме."""
    return {"avg_kg": svc.avg_carcass_weight(db)}


@router.post("", response_model=OrderOut, status_code=201)
def create_order(data: OrderIn, db: Session = Depends(get_db)):
    return _handle(svc.create_order, db, data)


@router.get("/{obj_id}", response_model=OrderDetailOut)
def get_order(obj_id: int, db: Session = Depends(get_db)):
    return _handle(svc.get_order_detail, db, obj_id)


@router.put("/{obj_id}", response_model=OrderOut)
def update_order(obj_id: int, data: OrderIn, db: Session = Depends(get_db)):
    return _handle(svc.update_order, db, obj_id, data)


@router.delete("/{obj_id}", status_code=204)
def delete_order(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_order, db, obj_id)


@router.put("/{obj_id}/status", response_model=OrderOut)
def set_status(obj_id: int, data: OrderStatusIn, db: Session = Depends(get_db)):
    return _handle(svc.set_status, db, obj_id, data)


@router.post("/{obj_id}/items/{item_id}/egg-sale", response_model=OrderFulfillmentOut, status_code=201)
def create_egg_fulfillment(obj_id: int, item_id: int, data: EggSaleIn, db: Session = Depends(get_db)):
    return _handle(svc.create_egg_fulfillment, db, obj_id, item_id, data)


@router.post("/{obj_id}/items/{item_id}/product-sale", response_model=OrderFulfillmentOut, status_code=201)
def create_product_fulfillment(
    obj_id: int, item_id: int, batch_id: int, data: OrderProductSaleIn,
    actual_pieces: float | None = None, db: Session = Depends(get_db),
):
    return _handle(svc.create_product_fulfillment, db, obj_id, item_id, batch_id, data, actual_pieces)


@router.delete("/{obj_id}/fulfillments/{f_id}", status_code=204)
def delete_fulfillment(obj_id: int, f_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_fulfillment, db, obj_id, f_id)

