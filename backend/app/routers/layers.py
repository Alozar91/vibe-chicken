"""HTTP-слой несушек и яйца; вся логика в services/layers.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.layers import (
    EggCollectionIn,
    EggCollectionOut,
    EggSaleIn,
    EggSaleOut,
    EggSelfUseIn,
    EggSelfUseOut,
    FlockMetrics,
    LayFlockChangeIn,
    LayFlockChangeOut,
    LayFlockIn,
    LayFlockOut,
    LayFeedingIn,
    LayFeedingOut,
)
from app.services import layers as svc

router = APIRouter(prefix="/api/flocks", tags=["layers"])


def _handle(fn, db: Session, *args, **kwargs):
    try:
        return fn(db, *args, **kwargs)
    except ValueError as e:
        msg = str(e)
        code = 404 if ("не найден" in msg or "не найдена" in msg) else 400
        raise HTTPException(status_code=code, detail=msg) from None


# --- Стада ---


@router.get("", response_model=list[LayFlockOut])
def list_flocks(db: Session = Depends(get_db)):
    return svc.list_flocks(db)


@router.post("", response_model=LayFlockOut, status_code=201)
def create_flock(data: LayFlockIn, db: Session = Depends(get_db)):
    return _handle(svc.create_flock, db, data)


@router.put("/{flock_id}", response_model=LayFlockOut)
def update_flock(flock_id: int, data: LayFlockIn, db: Session = Depends(get_db)):
    return _handle(svc.update_flock, db, flock_id, data)


@router.get("/{flock_id}", response_model=LayFlockOut)
def get_flock(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc._get_flock, db, flock_id)


@router.post("/{flock_id}/close", response_model=LayFlockOut)
def close_flock(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc.close_flock, db, flock_id)


@router.get("/{flock_id}/metrics", response_model=FlockMetrics)
def flock_metrics(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc.compute_flock_metrics, db, flock_id)


# --- Изменения поголовья ---


@router.get("/{flock_id}/changes", response_model=list[LayFlockChangeOut])
def list_changes(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc.list_changes, db, flock_id)


@router.post("/{flock_id}/changes", response_model=LayFlockChangeOut, status_code=201)
def create_change(flock_id: int, data: LayFlockChangeIn, db: Session = Depends(get_db)):
    return _handle(svc.create_change, db, flock_id, data)


@router.put("/{flock_id}/changes/{obj_id}", response_model=LayFlockChangeOut)
def update_change(flock_id: int, obj_id: int, data: LayFlockChangeIn, db: Session = Depends(get_db)):
    return _handle(svc.update_change, db, flock_id, obj_id, data)


@router.delete("/{flock_id}/changes/{obj_id}", status_code=204)
def delete_change(flock_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_change, db, flock_id, obj_id)


# --- Сбор яйца ---


@router.get("/{flock_id}/collections", response_model=list[EggCollectionOut])
def list_collections(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc.list_collections, db, flock_id)


@router.post("/{flock_id}/collections", response_model=EggCollectionOut, status_code=201)
def create_collection(flock_id: int, data: EggCollectionIn, db: Session = Depends(get_db)):
    return _handle(svc.create_collection, db, flock_id, data)


@router.put("/{flock_id}/collections/{obj_id}", response_model=EggCollectionOut)
def update_collection(flock_id: int, obj_id: int, data: EggCollectionIn, db: Session = Depends(get_db)):
    return _handle(svc.update_collection, db, flock_id, obj_id, data)


@router.delete("/{flock_id}/collections/{obj_id}", status_code=204)
def delete_collection(flock_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_collection, db, flock_id, obj_id)


# --- Самопотребление ---


@router.get("/{flock_id}/selfuse", response_model=list[EggSelfUseOut])
def list_selfuse(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc.list_selfuse, db, flock_id)


@router.post("/{flock_id}/selfuse", response_model=EggSelfUseOut, status_code=201)
def create_selfuse(flock_id: int, data: EggSelfUseIn, db: Session = Depends(get_db)):
    return _handle(svc.create_selfuse, db, flock_id, data)


@router.put("/{flock_id}/selfuse/{obj_id}", response_model=EggSelfUseOut)
def update_selfuse(flock_id: int, obj_id: int, data: EggSelfUseIn, db: Session = Depends(get_db)):
    return _handle(svc.update_selfuse, db, flock_id, obj_id, data)


@router.delete("/{flock_id}/selfuse/{obj_id}", status_code=204)
def delete_selfuse(flock_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_selfuse, db, flock_id, obj_id)


# --- Кормление ---


@router.get("/{flock_id}/feedings", response_model=list[LayFeedingOut])
def list_feedings(flock_id: int, db: Session = Depends(get_db)):
    return _handle(svc.list_feedings, db, flock_id)


@router.post("/{flock_id}/feedings", response_model=LayFeedingOut, status_code=201)
def create_feeding(flock_id: int, data: LayFeedingIn, db: Session = Depends(get_db)):
    return _handle(svc.create_feeding, db, flock_id, data)


@router.put("/{flock_id}/feedings/{obj_id}", response_model=LayFeedingOut)
def update_feeding(flock_id: int, obj_id: int, data: LayFeedingIn, db: Session = Depends(get_db)):
    return _handle(svc.update_feeding, db, flock_id, obj_id, data)


@router.delete("/{flock_id}/feedings/{obj_id}", status_code=204)
def delete_feeding(flock_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_feeding, db, flock_id, obj_id)


# --- Продажи яйца (глобальные) ---


sales_router = APIRouter(prefix="/api/egg-sales", tags=["layers"])


@sales_router.get("", response_model=list[EggSaleOut])
def list_sales(db: Session = Depends(get_db)):
    return svc.list_sales(db)


@sales_router.post("", response_model=EggSaleOut, status_code=201)
def create_sale(data: EggSaleIn, db: Session = Depends(get_db)):
    return _handle(svc.create_sale, db, data)


@sales_router.put("/{sale_id}", response_model=EggSaleOut)
def update_sale(sale_id: int, data: EggSaleIn, db: Session = Depends(get_db)):
    return _handle(svc.update_sale, db, sale_id, data)


@sales_router.delete("/{sale_id}", status_code=204)
def delete_sale(sale_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_sale, db, sale_id)
