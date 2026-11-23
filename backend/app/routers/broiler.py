"""HTTP-слой партий бройлеров. Логика — в services/broiler.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.schemas.broiler import (
    BatchIn,
    BatchMetrics,
    BatchOut,
    FeedingIn,
    FeedingOut,
    MortalityIn,
    MortalityOut,
    SaleIn,
    SaleOut,
    SlaughterIn,
    TreatmentIn,
    TreatmentOut,
    WeighingIn,
    WeighingOut,
)
from app.services import broiler as svc

router = APIRouter(prefix="/api/batches", tags=["batches"],
                   dependencies=[Depends(get_current_user)])


def _handle(fn, *args):
    try:
        return fn(*args)
    except ValueError as e:
        msg = str(e)
        status = 404 if "не найден" in msg or "не найдена" in msg else 400
        raise HTTPException(status_code=status, detail=msg) from None


@router.get("", response_model=list[BatchOut])
def batches(db: Session = Depends(get_db)):
    return svc.list_batches(db)


@router.post("", response_model=BatchOut, status_code=201)
def create_batch(data: BatchIn, db: Session = Depends(get_db)):
    return _handle(svc.create_batch, db, data)


@router.put("/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: int, data: BatchIn, db: Session = Depends(get_db)):
    return _handle(svc.update_batch, db, batch_id, data)


@router.post("/{batch_id}/close", response_model=BatchOut)
def close_batch(batch_id: int, db: Session = Depends(get_db)):
    return _handle(svc.close_batch, db, batch_id)


@router.get("/{batch_id}/metrics", response_model=BatchMetrics)
def metrics(batch_id: int, db: Session = Depends(get_db)):
    return _handle(svc.compute_metrics, db, batch_id)


# --- Падёж ---
@router.get("/{batch_id}/mortalities", response_model=list[MortalityOut])
def mortalities(batch_id: int, db: Session = Depends(get_db)):
    return svc.list_mortalities(db, batch_id)


@router.post("/{batch_id}/mortalities", response_model=MortalityOut, status_code=201)
def create_mortality(batch_id: int, data: MortalityIn, db: Session = Depends(get_db)):
    return _handle(svc.create_mortality, db, batch_id, data)


@router.put("/{batch_id}/mortalities/{obj_id}", response_model=MortalityOut)
def update_mortality(batch_id: int, obj_id: int, data: MortalityIn, db: Session = Depends(get_db)):
    return _handle(svc.update_mortality, db, batch_id, obj_id, data)


@router.delete("/{batch_id}/mortalities/{obj_id}", status_code=204)
def delete_mortality(batch_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_mortality, db, batch_id, obj_id)


# --- Кормление ---
@router.get("/{batch_id}/feedings", response_model=list[FeedingOut])
def feedings(batch_id: int, db: Session = Depends(get_db)):
    return svc.list_feedings(db, batch_id)


@router.post("/{batch_id}/feedings", response_model=FeedingOut, status_code=201)
def create_feeding(batch_id: int, data: FeedingIn, db: Session = Depends(get_db)):
    return _handle(svc.create_feeding, db, batch_id, data)


@router.put("/{batch_id}/feedings/{obj_id}", response_model=FeedingOut)
def update_feeding(batch_id: int, obj_id: int, data: FeedingIn, db: Session = Depends(get_db)):
    return _handle(svc.update_feeding, db, batch_id, obj_id, data)


@router.delete("/{batch_id}/feedings/{obj_id}", status_code=204)
def delete_feeding(batch_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_feeding, db, batch_id, obj_id)


# --- Взвешивания ---
@router.get("/{batch_id}/weighings", response_model=list[WeighingOut])
def weighings(batch_id: int, db: Session = Depends(get_db)):
    return svc.list_weighings(db, batch_id)


@router.post("/{batch_id}/weighings", response_model=WeighingOut, status_code=201)
def create_weighing(batch_id: int, data: WeighingIn, db: Session = Depends(get_db)):
    return _handle(svc.create_weighing, db, batch_id, data)


@router.put("/{batch_id}/weighings/{obj_id}", response_model=WeighingOut)
def update_weighing(batch_id: int, obj_id: int, data: WeighingIn, db: Session = Depends(get_db)):
    return _handle(svc.update_weighing, db, batch_id, obj_id, data)


@router.delete("/{batch_id}/weighings/{obj_id}", status_code=204)
def delete_weighing(batch_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_weighing, db, batch_id, obj_id)


# --- Лечение ---
@router.get("/{batch_id}/treatments", response_model=list[TreatmentOut])
def treatments(batch_id: int, db: Session = Depends(get_db)):
    return svc.list_treatments(db, batch_id)


@router.post("/{batch_id}/treatments", response_model=TreatmentOut, status_code=201)
def create_treatment(batch_id: int, data: TreatmentIn, db: Session = Depends(get_db)):
    return _handle(svc.create_treatment, db, batch_id, data)


@router.put("/{batch_id}/treatments/{obj_id}", response_model=TreatmentOut)
def update_treatment(batch_id: int, obj_id: int, data: TreatmentIn, db: Session = Depends(get_db)):
    return _handle(svc.update_treatment, db, batch_id, obj_id, data)


@router.delete("/{batch_id}/treatments/{obj_id}", status_code=204)
def delete_treatment(batch_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_treatment, db, batch_id, obj_id)


# --- Забой ---
@router.get("/{batch_id}/slaughters", response_model=list[dict])
def slaughters(batch_id: int, db: Session = Depends(get_db)):
    return svc.list_slaughters(db, batch_id)


@router.post("/{batch_id}/slaughters", response_model=dict, status_code=201)
def create_slaughter(batch_id: int, data: SlaughterIn, db: Session = Depends(get_db)):
    return _handle(svc.create_slaughter, db, batch_id, data)


@router.put("/{batch_id}/slaughters/{obj_id}", response_model=dict)
def update_slaughter(batch_id: int, obj_id: int, data: SlaughterIn, db: Session = Depends(get_db)):
    return _handle(svc.update_slaughter, db, batch_id, obj_id, data)


@router.delete("/{batch_id}/slaughters/{obj_id}", status_code=204)
def delete_slaughter(batch_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_slaughter, db, batch_id, obj_id)


# --- Продажи ---
@router.get("/{batch_id}/sales", response_model=list[SaleOut])
def sales(batch_id: int, db: Session = Depends(get_db)):
    return svc.list_sales(db, batch_id)


@router.post("/{batch_id}/sales", response_model=SaleOut, status_code=201)
def create_sale(batch_id: int, data: SaleIn, db: Session = Depends(get_db)):
    return _handle(svc.create_sale, db, batch_id, data)


@router.put("/{batch_id}/sales/{obj_id}", response_model=SaleOut)
def update_sale(batch_id: int, obj_id: int, data: SaleIn, db: Session = Depends(get_db)):
    return _handle(svc.update_sale, db, batch_id, obj_id, data)


@router.delete("/{batch_id}/sales/{obj_id}", status_code=204)
def delete_sale(batch_id: int, obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_sale, db, batch_id, obj_id)
