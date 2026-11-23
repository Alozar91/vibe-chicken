"""HTTP-слой отчётов; логика в services/reports.py."""

import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.reports import (
    BatchRow,
    BuyerRow,
    CategorySlice,
    DashboardOut,
    EggMonthPoint,
    MonthPoint,
)
from app.services import reports as svc

router = APIRouter(prefix="/api/reports", tags=["reports"])

_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")


def _check_months(months: int) -> int:
    if months < 1 or months > 24:
        raise HTTPException(status_code=400, detail="months должен быть от 1 до 24")
    return months


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db: Session = Depends(get_db)):
    """Сводка для дашборда: KPI + последние партии и заказы."""
    return svc.dashboard(db)


@router.get("/monthly", response_model=list[MonthPoint])
def monthly(months: int = Query(default=12, ge=1, le=24), db: Session = Depends(get_db)):
    return svc.monthly(db, _check_months(months))


@router.get("/categories", response_model=list[CategorySlice])
def categories(
    month: str | None = Query(default=None, description="YYYY-MM, по умолчанию текущий"),
    db: Session = Depends(get_db),
):
    if month is not None and not _MONTH_RE.match(month):
        raise HTTPException(status_code=400, detail="month должен быть в формате YYYY-MM")
    return svc.categories(db, month)


@router.get("/eggs", response_model=list[EggMonthPoint])
def eggs(months: int = Query(default=6, ge=1, le=24), db: Session = Depends(get_db)):
    return svc.eggs_by_month(db, _check_months(months))


@router.get("/buyers", response_model=list[BuyerRow])
def buyers(months: int = Query(default=12, ge=1, le=24), db: Session = Depends(get_db)):
    return svc.buyers(db, _check_months(months))


@router.get("/batches", response_model=list[BatchRow])
def batches(db: Session = Depends(get_db)):
    return svc.batches(db)
