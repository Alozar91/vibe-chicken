"""Тесты склада корма: жёсткий тег продавца, остатки, корректировки."""

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.db import Base
from app.models.broiler import BatchFeeding, BroilerBatch
from app.models.dictionaries import FeedBrand, FeedCategory, Place, Vendor
from app.models.layers import LayFeeding, LayFlock
from app.schemas.dictionaries import VendorIn
from app.schemas.feed import FeedAdjustmentIn, FeedPurchaseIn
from app.services import dictionaries as dict_svc
from app.services import feed as svc

D = date(2025, 6, 1)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


@pytest.fixture()
def dicts(db):
    cat = FeedCategory(name="Старт")
    brand = FeedBrand(name="Бренд А")
    place = Place(name="Модуль 1", kind="broiler_module")
    db.add_all([cat, brand, place])
    db.commit()
    vendor = dict_svc.create_vendor(db, VendorIn(name="Кормовая база", note=None, types=["feed"]))
    return cat.id, brand.id, vendor.id, place.id


def _batch(db, place_id, code="B1"):
    batch = BroilerBatch(code=code, place_id=place_id, head_count=50, start_date=D,
                         vendor_id=1, chick_price_per_head=0)
    db.add(batch)
    db.flush()
    return batch


def _flock(db, place_id):
    flock = LayFlock(name="Стадо 1", place_id=place_id, start_date=D)
    db.add(flock)
    db.flush()
    return flock


def test_purchase_requires_feed_tag(db, dicts):
    cat_id, brand_id, _, _ = dicts
    chicks_vendor = dict_svc.create_vendor(db, VendorIn(
        name="Птицефабрика", note=None, types=["chicks"]))
    with pytest.raises(ValueError, match="не продавец корма"):
        svc.create_purchase(db, FeedPurchaseIn(
            date=D, feed_category_id=cat_id, feed_brand_id=brand_id,
            vendor_id=chicks_vendor.id, kg=100, total_cost=5000))


def test_purchase_ok_and_stock(db, dicts):
    cat_id, brand_id, vendor_id, _ = dicts
    svc.create_purchase(db, FeedPurchaseIn(
        date=D, feed_category_id=cat_id, feed_brand_id=brand_id,
        vendor_id=vendor_id, kg=100, total_cost=5000))
    rows = svc.stock_rows(db)
    assert len(rows) == 1
    assert rows[0].purchased_kg == 100
    assert rows[0].stock_kg == 100


def test_stock_with_batch_and_lay_usage(db, dicts):
    cat_id, brand_id, vendor_id, place_id = dicts
    svc.create_purchase(db, FeedPurchaseIn(
        date=D, feed_category_id=cat_id, feed_brand_id=brand_id,
        vendor_id=vendor_id, kg=100, total_cost=5000))

    batch = _batch(db, place_id)
    flock = _flock(db, place_id)
    db.add_all([
        BatchFeeding(batch_id=batch.id, date=D, feed_category_id=cat_id,
                     feed_brand_id=brand_id, kg=30),
        LayFeeding(flock_id=flock.id, date=D, feed_category_id=cat_id,
                   feed_brand_id=brand_id, kg=5),
    ])
    db.commit()

    rows = svc.stock_rows(db)
    assert rows[0].used_kg == 35
    assert rows[0].stock_kg == 65


def test_adjustment_fixes_stock(db, dicts):
    cat_id, brand_id, vendor_id, _ = dicts
    svc.create_purchase(db, FeedPurchaseIn(
        date=D, feed_category_id=cat_id, feed_brand_id=brand_id,
        vendor_id=vendor_id, kg=100, total_cost=5000))
    svc.create_adjustment(db, FeedAdjustmentIn(
        date=D, feed_category_id=cat_id, feed_brand_id=brand_id,
        kg_delta=-2.5, comment="инвентаризация"))
    rows = svc.stock_rows(db)
    assert rows[0].stock_kg == 97.5
    assert rows[0].adjusted_kg == -2.5


def test_negative_stock_allowed(db, dicts):
    """Расход не блокируется: остаток может уйти в минус (концепция §4.3)."""
    cat_id, brand_id, _, place_id = dicts
    batch = _batch(db, place_id)
    db.add(BatchFeeding(batch_id=batch.id, date=D, feed_category_id=cat_id,
                        feed_brand_id=brand_id, kg=10))
    db.commit()
    rows = svc.stock_rows(db)
    assert rows[0].stock_kg == -10
