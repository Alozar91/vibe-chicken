"""Геокодирование адреса в координаты (для маршрутов, §4.8)."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.models.user import User
from app.services import geocode as geocode_svc

router = APIRouter(prefix="/api/geocode", tags=["geocode"], dependencies=[Depends(get_current_user)])


class GeocodeOut(BaseModel):
    lat: float
    lon: float
    label: str = Field(description="Адрес, как его понял геокодер")


@router.post("", response_model=GeocodeOut)
def geocode_address(q: str = Query(alias="q", min_length=3, max_length=300)):
    """Текстовый адрес → координаты (Nominatim). 400, если не нашёл."""
    try:
        point = geocode_svc.geocode(q)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    return GeocodeOut(lat=point.lat, lon=point.lon, label=point.label)
