"""Бизнес-логика склада корма: закупки, корректировки, остатки.

Остаток = Σзакупки − Σрасход (партии + несушки) + Σкорректировок,
считается запросом, не хранится (event-sourcing, концепция §4.3).
Закупка корма принимает только продавца с тегом «feed» (жёсткое правило).
"""

from datetime import date as Date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.broiler import BatchFeeding
from app.models.dictionaries import FeedBrand, FeedCategory, Vendor
from app.models.layers import LayFeeding
from app.models.warehouse import FeedAdjustment, FeedPurchase
from app.schemas.feed import FeedAdjustmentIn, FeedPurchaseIn, FeedStockRow


def _get_vendor_with_feed_tag(db: Session, vendor_id: int) -> Vendor:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise ValueError("Продавец не найден")
    if "feed" not in vendor.types:
        raise ValueError(f"«{vendor.name}» не продавец корма — выберите продавца с тегом «Корм»")
    return vendor


def _check_dict_refs(db: Session, category_id: int, brand_id: int) -> None:
    if db.get(FeedCategory, category_id) is None:
        raise ValueError("Категория корма не найдена")
    if db.get(FeedBrand, brand_id) is None:
        raise ValueError("Производитель корма не найден")


# --- Закупки ---


def list_purchases(db: Session, limit: int = 200) -> list[FeedPurchase]:
    stmt = (
        select(FeedPurchase)
        .order_by(FeedPurchase.date.desc(), FeedPurchase.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def create_purchase(db: Session, data: FeedPurchaseIn) -> FeedPurchase:
    _get_vendor_with_feed_tag(db, data.vendor_id)
    _check_dict_refs(db, data.feed_category_id, data.feed_brand_id)
    obj = FeedPurchase(**data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def delete_purchase(db: Session, purchase_id: int) -> None:
    """Удаление закупки разрешено только пока на неё не списали корм."""
    obj = db.get(FeedPurchase, purchase_id)
    if obj is None:
        raise ValueError("Закупка не найдена")
    db.delete(obj)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise ValueError("Нельзя удалить закупку: на неё уже ссылаются операции") from None


# --- Корректировки ---


def list_adjustments(db: Session, limit: int = 200) -> list[FeedAdjustment]:
    stmt = (
        select(FeedAdjustment)
        .order_by(FeedAdjustment.date.desc(), FeedAdjustment.id.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


def create_adjustment(db: Session, data: FeedAdjustmentIn) -> FeedAdjustment:
    _check_dict_refs(db, data.feed_category_id, data.feed_brand_id)
    obj = FeedAdjustment(**data.model_dump())
    db.add(obj)
    db.commit()
    return obj


def delete_adjustment(db: Session, adjustment_id: int) -> None:
    obj = db.get(FeedAdjustment, adjustment_id)
    if obj is None:
        raise ValueError("Корректировка не найдена")
    db.delete(obj)
    db.commit()


# --- Остатки ---


def stock_rows(db: Session) -> list[FeedStockRow]:
    """Остатки по каждой паре «категория × производитель».

    Единицы учёта — все события склада: закупки, списания партий,
    списания несушек, корректировки. Остаток может быть отрицательным
    (расход не блокируется, концепция §4.3).
    """
    cats = {c.id: c.name for c in db.scalars(select(FeedCategory))}
    brands = {b.id: b.name for b in db.scalars(select(FeedBrand))}

    def _kg_sum(model, col_kg, col_cat, col_brand):
        return db.execute(
            select(col_cat, col_brand, func.sum(col_kg)).group_by(col_cat, col_brand)
        ).all()

    purchased: dict[tuple[int, int], float] = {
        (c, b): float(kg or 0) for c, b, kg in _kg_sum(FeedPurchase, FeedPurchase.kg, FeedPurchase.feed_category_id, FeedPurchase.feed_brand_id)
    }
    used_batch: dict[tuple[int, int], float] = {
        (c, b): float(kg or 0) for c, b, kg in _kg_sum(BatchFeeding, BatchFeeding.kg, BatchFeeding.feed_category_id, BatchFeeding.feed_brand_id)
    }
    used_lay: dict[tuple[int, int], float] = {
        (c, b): float(kg or 0) for c, b, kg in _kg_sum(LayFeeding, LayFeeding.kg, LayFeeding.feed_category_id, LayFeeding.feed_brand_id)
    }
    adjusted: dict[tuple[int, int], float] = {
        (c, b): float(kg or 0) for c, b, kg in _kg_sum(FeedAdjustment, FeedAdjustment.kg_delta, FeedAdjustment.feed_category_id, FeedAdjustment.feed_brand_id)
    }

    keys = sorted(set(purchased) | set(used_batch) | set(used_lay) | set(adjusted))
    rows: list[FeedStockRow] = []
    for cat_id, brand_id in keys:
        p = purchased.get((cat_id, brand_id), 0.0)
        ub = used_batch.get((cat_id, brand_id), 0.0)
        ul = used_lay.get((cat_id, brand_id), 0.0)
        a = adjusted.get((cat_id, brand_id), 0.0)
        rows.append(
            FeedStockRow(
                feed_category_id=cat_id,
                feed_brand_id=brand_id,
                feed_category_name=cats.get(cat_id, f"#{cat_id}"),
                feed_brand_name=brands.get(brand_id, f"#{brand_id}"),
                purchased_kg=round(p, 3),
                used_kg=round(ub + ul, 3),
                adjusted_kg=round(a, 3),
                stock_kg=round(p - ub - ul + a, 3),
            )
        )
    return rows


def total_stock_kg(db: Session) -> float:
    return round(sum(r.stock_kg for r in stock_rows(db)), 3)
