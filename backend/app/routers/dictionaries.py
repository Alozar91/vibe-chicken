"""HTTP-слой справочников: приём запросов, статусы, вызов сервисов.

Все эндпоинты требуют авторизации. Ошибки домена (ValueError из сервисов)
переводятся в 400 с осмысленным русским текстом; «не найдено» — 404.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dictionaries import (
    BuyerIn,
    BuyerOut,
    FeedBrandIn,
    FeedBrandOut,
    FeedCategoryIn,
    FeedCategoryOut,
    MoneyCategoryIn,
    MoneyCategoryOut,
    PlaceIn,
    PlaceOut,
    ProductTypeIn,
    ProductTypeOut,
    VendorIn,
    VendorOut,
)
from app.services import dictionaries as svc

router = APIRouter(prefix="/api/dictionaries", tags=["dictionaries"],
                   dependencies=[Depends(get_current_user)])


def _handle(fn, *args):
    """Вызывает сервис; ValueError → 400, KeyError → 404 (по соглашению сервисов)."""
    try:
        return fn(*args)
    except ValueError as e:
        msg = str(e)
        status = 404 if msg.startswith("Запись не найдена") else 400
        raise HTTPException(status_code=status, detail=msg) from None


# --- Места содержания ---
@router.get("/places", response_model=list[PlaceOut])
def places(db: Session = Depends(get_db)):
    return svc.list_places(db)


@router.post("/places", response_model=PlaceOut, status_code=201)
def create_place(data: PlaceIn, db: Session = Depends(get_db)):
    return _handle(svc.create_place, db, data)


@router.put("/places/{obj_id}", response_model=PlaceOut)
def update_place(obj_id: int, data: PlaceIn, db: Session = Depends(get_db)):
    return _handle(svc.update_place, db, obj_id, data)


@router.delete("/places/{obj_id}", status_code=204)
def delete_place(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_place, db, obj_id)


# --- Категории корма ---
@router.get("/feed-categories", response_model=list[FeedCategoryOut])
def feed_categories(db: Session = Depends(get_db)):
    return svc.list_feed_categories(db)


@router.post("/feed-categories", response_model=FeedCategoryOut, status_code=201)
def create_feed_category(data: FeedCategoryIn, db: Session = Depends(get_db)):
    return _handle(svc.create_feed_category, db, data)


@router.put("/feed-categories/{obj_id}", response_model=FeedCategoryOut)
def update_feed_category(obj_id: int, data: FeedCategoryIn, db: Session = Depends(get_db)):
    return _handle(svc.update_feed_category, db, obj_id, data)


@router.delete("/feed-categories/{obj_id}", status_code=204)
def delete_feed_category(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_feed_category, db, obj_id)


# --- Производители корма ---
@router.get("/feed-brands", response_model=list[FeedBrandOut])
def feed_brands(db: Session = Depends(get_db)):
    return svc.list_feed_brands(db)


@router.post("/feed-brands", response_model=FeedBrandOut, status_code=201)
def create_feed_brand(data: FeedBrandIn, db: Session = Depends(get_db)):
    return _handle(svc.create_feed_brand, db, data)


@router.put("/feed-brands/{obj_id}", response_model=FeedBrandOut)
def update_feed_brand(obj_id: int, data: FeedBrandIn, db: Session = Depends(get_db)):
    return _handle(svc.update_feed_brand, db, obj_id, data)


@router.delete("/feed-brands/{obj_id}", status_code=204)
def delete_feed_brand(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_feed_brand, db, obj_id)


# --- Продавцы ---
@router.get("/vendors", response_model=list[VendorOut])
def vendors(vendor_type: str | None = None, db: Session = Depends(get_db)):
    """Фильтр по тегу: ?vendor_type=chicks|feed|meds|other (жёсткое правило)."""
    return svc.list_vendors(db, vendor_type)


@router.post("/vendors", response_model=VendorOut, status_code=201)
def create_vendor(data: VendorIn, db: Session = Depends(get_db)):
    return _handle(svc.create_vendor, db, data)


@router.put("/vendors/{obj_id}", response_model=VendorOut)
def update_vendor(obj_id: int, data: VendorIn, db: Session = Depends(get_db)):
    return _handle(svc.update_vendor, db, obj_id, data)


@router.delete("/vendors/{obj_id}", status_code=204)
def delete_vendor(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_vendor, db, obj_id)


# --- Покупатели ---
@router.get("/buyers", response_model=list[BuyerOut])
def buyers(db: Session = Depends(get_db)):
    return svc.list_buyers(db)


@router.post("/buyers", response_model=BuyerOut, status_code=201)
def create_buyer(data: BuyerIn, db: Session = Depends(get_db)):
    return _handle(svc.create_buyer, db, data)


@router.put("/buyers/{obj_id}", response_model=BuyerOut)
def update_buyer(obj_id: int, data: BuyerIn, db: Session = Depends(get_db)):
    return _handle(svc.update_buyer, db, obj_id, data)


@router.delete("/buyers/{obj_id}", status_code=204)
def delete_buyer(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_buyer, db, obj_id)


# --- Виды продукции ---
@router.get("/prices")
def get_prices(db: Session = Depends(get_db)):
    """Справочник цен: яйцо (₽/дес) + виды продукции (₽/шт или ₽/кг)."""
    return _handle(svc.get_prices, db)


@router.get("/product-types", response_model=list[ProductTypeOut])
def product_types(db: Session = Depends(get_db)):
    return svc.list_product_types(db)


@router.post("/product-types", response_model=ProductTypeOut, status_code=201)
def create_product_type(data: ProductTypeIn, db: Session = Depends(get_db)):
    return _handle(svc.create_product_type, db, data)


@router.put("/product-types/{obj_id}", response_model=ProductTypeOut)
def update_product_type(obj_id: int, data: ProductTypeIn, db: Session = Depends(get_db)):
    return _handle(svc.update_product_type, db, obj_id, data)


@router.delete("/product-types/{obj_id}", status_code=204)
def delete_product_type(obj_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_product_type, db, obj_id)


# --- Категории денег ---
@router.get("/money-categories", response_model=list[MoneyCategoryOut])
def money_categories(db: Session = Depends(get_db)):
    return svc.list_money_categories(db)


@router.post("/money-categories", response_model=MoneyCategoryOut, status_code=201)
def create_money_category(data: MoneyCategoryIn, db: Session = Depends(get_db)):
    return _handle(svc.create_money_category, db, data)


@router.put("/money-categories/{obj_id}", response_model=MoneyCategoryOut)
def update_money_category(obj_id: int, data: MoneyCategoryIn, db: Session = Depends(get_db)):
    return _handle(svc.update_money_category, db, obj_id, data)


@router.delete("/money-categories/{obj_id}", status_code=204)
def delete_money_category(obj_id: int, db: Session = Depends(get_db)):
    """Не удаляем, а деактивируем — журнал ссылается на категории."""
    _handle(svc.deactivate_money_category, db, obj_id)
