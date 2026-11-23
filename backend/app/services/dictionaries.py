"""Бизнес-логика справочников: CRUD и проверки правил.

Сервисы не знают про HTTP: ошибки домена возвращают как ValueError
с текстом для пользователя; роутер переводит их в 400/409.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dictionaries import (
    Buyer,
    FeedBrand,
    FeedCategory,
    MoneyCategory,
    Place,
    ProductType,
    Vendor,
)
from app.schemas.dictionaries import (
    BuyerIn,
    FeedBrandIn,
    FeedCategoryIn,
    MoneyCategoryIn,
    PlaceIn,
    ProductTypeIn,
    VendorIn,
)

# --- общие помощники ---


def _get_or_404(db: Session, model: type, obj_id: int):
    obj = db.get(model, obj_id)
    if obj is None:
        raise ValueError(f"Запись не найдена (id={obj_id})")
    return obj


def _check_unique(db: Session, model: type, name: str, exclude_id: int | None = None):
    stmt = select(model.id).where(model.name == name)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise ValueError(f"«{name}» уже есть в справочнике")


def _delete(db: Session, model: type, obj_id: int):
    """Удаление: если на запись ссылаются другие таблицы — запрещаем."""
    obj = _get_or_404(db, model, obj_id)
    try:
        db.delete(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise ValueError(
            "Нельзя удалить: на эту запись ссылаются операции. "
            "Справочник допускает только добавление — используйте деактивацию."
        ) from None


# --- Места содержания ---


def list_places(db: Session) -> list[Place]:
    return list(db.scalars(select(Place).order_by(Place.name)))


def create_place(db: Session, data: PlaceIn) -> Place:
    _check_unique(db, Place, data.name)
    obj = Place(**data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_place(db: Session, obj_id: int, data: PlaceIn) -> Place:
    obj = _get_or_404(db, Place, obj_id)
    _check_unique(db, Place, data.name, exclude_id=obj_id)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_place(db: Session, obj_id: int) -> None:
    _delete(db, Place, obj_id)


# --- Категории корма ---


def list_feed_categories(db: Session) -> list[FeedCategory]:
    return list(db.scalars(select(FeedCategory).order_by(FeedCategory.name)))


def create_feed_category(db: Session, data: FeedCategoryIn) -> FeedCategory:
    _check_unique(db, FeedCategory, data.name)
    obj = FeedCategory(name=data.name)
    db.add(obj)
    db.commit()
    return obj


def update_feed_category(db: Session, obj_id: int, data: FeedCategoryIn) -> FeedCategory:
    obj = _get_or_404(db, FeedCategory, obj_id)
    _check_unique(db, FeedCategory, data.name, exclude_id=obj_id)
    obj.name = data.name
    db.commit()
    return obj


def delete_feed_category(db: Session, obj_id: int) -> None:
    _delete(db, FeedCategory, obj_id)


# --- Производители корма ---


def list_feed_brands(db: Session) -> list[FeedBrand]:
    return list(db.scalars(select(FeedBrand).order_by(FeedBrand.name)))


def create_feed_brand(db: Session, data: FeedBrandIn) -> FeedBrand:
    _check_unique(db, FeedBrand, data.name)
    obj = FeedBrand(name=data.name)
    db.add(obj)
    db.commit()
    return obj


def update_feed_brand(db: Session, obj_id: int, data: FeedBrandIn) -> FeedBrand:
    obj = _get_or_404(db, FeedBrand, obj_id)
    _check_unique(db, FeedBrand, data.name, exclude_id=obj_id)
    obj.name = data.name
    db.commit()
    return obj


def delete_feed_brand(db: Session, obj_id: int) -> None:
    _delete(db, FeedBrand, obj_id)


# --- Продавцы ---


def list_vendors(db: Session, vendor_type: str | None = None) -> list[Vendor]:
    """Список продавцов; фильтр по тегу-типу (жёсткое правило из концепции)."""
    stmt = select(Vendor).order_by(Vendor.name)
    vendors = list(db.scalars(stmt))
    if vendor_type is not None:
        vendors = [v for v in vendors if vendor_type in v.types]
    return vendors


def create_vendor(db: Session, data: VendorIn) -> Vendor:
    _check_unique(db, Vendor, data.name)
    obj = Vendor(**data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_vendor(db: Session, obj_id: int, data: VendorIn) -> Vendor:
    obj = _get_or_404(db, Vendor, obj_id)
    _check_unique(db, Vendor, data.name, exclude_id=obj_id)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_vendor(db: Session, obj_id: int) -> None:
    _delete(db, Vendor, obj_id)


# --- Покупатели ---


def list_buyers(db: Session) -> list[Buyer]:
    return list(db.scalars(select(Buyer).order_by(Buyer.name)))


def create_buyer(db: Session, data: BuyerIn) -> Buyer:
    obj = Buyer(**data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_buyer(db: Session, obj_id: int, data: BuyerIn) -> Buyer:
    obj = _get_or_404(db, Buyer, obj_id)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    return obj


def delete_buyer(db: Session, obj_id: int) -> None:
    _delete(db, Buyer, obj_id)


# --- Виды продукции ---


def list_product_types(db: Session) -> list[ProductType]:
    return list(db.scalars(select(ProductType).order_by(ProductType.name)))


def create_product_type(db: Session, data: ProductTypeIn) -> ProductType:
    _check_unique(db, ProductType, data.name)
    obj = ProductType(name=data.name, unit=data.unit)
    db.add(obj)
    db.commit()
    return obj


def update_product_type(db: Session, obj_id: int, data: ProductTypeIn) -> ProductType:
    obj = _get_or_404(db, ProductType, obj_id)
    _check_unique(db, ProductType, data.name, exclude_id=obj_id)
    obj.name = data.name
    obj.unit = data.unit
    db.commit()
    return obj


def delete_product_type(db: Session, obj_id: int) -> None:
    _delete(db, ProductType, obj_id)


# --- Категории денег ---


def list_money_categories(db: Session) -> list[MoneyCategory]:
    return list(db.scalars(select(MoneyCategory).order_by(MoneyCategory.kind, MoneyCategory.name)))


def create_money_category(db: Session, data: MoneyCategoryIn) -> MoneyCategory:
    obj = MoneyCategory(**data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def update_money_category(db: Session, obj_id: int, data: MoneyCategoryIn) -> MoneyCategory:
    obj = _get_or_404(db, MoneyCategory, obj_id)
    obj.name = data.name
    obj.kind = data.kind
    obj.is_general = data.is_general
    db.commit()
    return obj


def deactivate_money_category(db: Session, obj_id: int) -> None:
    """Категории денег не удаляются (на них ссылается журнал) — деактивация."""
    obj = _get_or_404(db, MoneyCategory, obj_id)
    obj.is_active = False
    db.commit()
