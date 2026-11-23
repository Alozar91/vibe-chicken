"""Тесты партий бройлеров: теги, даты, забой, продажи, метрики."""

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401
from app.core.db import Base
from app.models.dictionaries import (
    Buyer,
    FeedBrand,
    FeedCategory,
    Place,
    ProductType,
)
from app.models.dictionaries import MoneyCategory
from app.models.warehouse import MoneyTransaction
from app.schemas.broiler import (
    BatchIn,
    FeedingIn,
    MortalityIn,
    SaleIn,
    SlaughterIn,
    SlaughterOutputIn,
    TreatmentIn,
    WeighingIn,
)
from app.schemas.dictionaries import VendorIn
from app.services import broiler as svc
from app.services import dictionaries as dict_svc

D = date(2025, 6, 1)


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


@pytest.fixture()
def env(db):
    place = Place(name="Модуль 1", kind="broiler_module")
    chicks_vendor = dict_svc.create_vendor(db, VendorIn(name="Птицефабрика", note=None, types=["chicks"]))
    feed_vendor = dict_svc.create_vendor(db, VendorIn(name="Кормовая", note=None, types=["feed"]))
    cat = FeedCategory(name="Старт")
    brand = FeedBrand(name="Маркорм")
    ptype = ProductType(name="Тушка")
    buyer = Buyer(name="Сосед")
    money_cat = MoneyCategory(name="Цыплята", kind="expense")
    db.add_all([place, cat, brand, ptype, buyer, money_cat])
    db.commit()
    return {
        "place_id": place.id,
        "chicks_vendor_id": chicks_vendor.id,
        "feed_vendor_id": feed_vendor.id,
        "cat_id": cat.id,
        "brand_id": brand.id,
        "ptype_id": ptype.id,
        "buyer_id": buyer.id,
        "money_cat_id": money_cat.id,
    }


def _batch_in(env, **overrides):
    data = {
        "code": "B-2025-1",
        "place_id": env["place_id"],
        "start_date": D,
        "head_count": 50,
        "cross": None,
        "vendor_id": env["chicks_vendor_id"],
        "chick_price_per_head": 100.0,
        "chick_avg_weight_kg": 0.04,
    }
    data.update(overrides)
    return BatchIn(**data)


def test_batch_requires_chicks_tag(db, env):
    with pytest.raises(ValueError, match="не продаёт цыплят"):
        svc.create_batch(db, _batch_in(env, vendor_id=env["feed_vendor_id"]))


def test_batch_duplicate_code(db, env):
    svc.create_batch(db, _batch_in(env))
    with pytest.raises(ValueError, match="уже есть"):
        svc.create_batch(db, _batch_in(env))


def test_batch_creates_money_transaction(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    tx = db.query(MoneyTransaction).filter_by(batch_id=batch.id).one()
    assert tx.amount == 5000.0  # 100 ₽ × 50 гол
    assert tx.date == D


def test_event_date_not_before_start(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    with pytest.raises(ValueError, match="раньше даты закупки"):
        svc.create_mortality(db, batch.id, MortalityIn(date=date(2025, 5, 30), head_count=2))


def test_mortality_and_metrics(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_mortality(db, batch.id, MortalityIn(date=D, head_count=3, cause="слабые"))
    m = svc.compute_metrics(db, batch.id)
    assert m.dead_head == 3
    assert m.current_head == 47
    assert m.survival_pct == 6.0  # (0 забитых + 3 павших) / 50 × 100


def test_feeding_updates_fcr_with_chick_weight(db, env):
    batch = svc.create_batch(db, _batch_in(env))  # chick_avg_weight 0.04
    svc.create_feeding(db, batch.id, FeedingIn(date=D, feed_category_id=env["cat_id"],
                                               feed_brand_id=env["brand_id"], kg=120))
    svc.create_slaughter(db, batch.id, SlaughterIn(
        date=D, head_count=50,
        outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=90)]))
    m = svc.compute_metrics(db, batch.id)
    # живой вес = 90 / 0.7 (коэффициент из настроек) = 128.57
    # привес = 128.57 − 0.04×50 = 126.57; FCR = 120/126.57
    assert m.fcr == pytest.approx(0.948, abs=0.01)
    assert m.output_pct == 70.0  # 90/128.57 = 70% (равен коэффициенту)
    assert m.direct_costs == 5000.0


def test_slaughter_more_than_current_head(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_mortality(db, batch.id, MortalityIn(date=D, head_count=10))
    with pytest.raises(ValueError, match="в партии осталось"):
        svc.create_slaughter(db, batch.id, SlaughterIn(
            date=D, head_count=45,
            outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=70)]))


def test_sale_date_not_before_slaughter(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    with pytest.raises(ValueError, match="Сначала зафиксируйте забой"):
        svc.create_sale(db, batch.id, SaleIn(date=D, product_type_id=env["ptype_id"],
                                             product_kg=10, price_per_kg=300))


def test_sale_total_amount_keeps_input(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_slaughter(db, batch.id, SlaughterIn(
        date=D, head_count=10,
        outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=18)]))
    # кг×цена = 18×300 = 5400, вводим 5500 (факт чека)
    sale = svc.create_sale(db, batch.id, SaleIn(date=D, product_type_id=env["ptype_id"],
                                                product_kg=18, price_per_kg=300,
                                                total_amount=5500))
    assert sale.total_amount == 5500.0
    # без total — вычисляется
    sale2 = svc.create_sale(db, batch.id, SaleIn(date=D, product_type_id=env["ptype_id"],
                                                 product_kg=2, price_per_kg=300))
    assert sale2.total_amount == 600.0


def test_weighings_fcr_fallback(db, env):
    # без chick_avg_weight_kg
    batch = svc.create_batch(db, _batch_in(env, chick_avg_weight_kg=None))
    svc.create_feeding(db, batch.id, FeedingIn(date=D, feed_category_id=env["cat_id"],
                                               feed_brand_id=env["brand_id"], kg=120))
    svc.create_weighing(db, batch.id, WeighingIn(date=D, head_count=10, avg_weight_kg=0.5))
    svc.create_weighing(db, batch.id, WeighingIn(date=date(2025, 6, 20), head_count=10, avg_weight_kg=2.0))
    m = svc.compute_metrics(db, batch.id)
    # привес = (2.0 − 0.5) × 50 = 75; FCR = 120/75 = 1.6
    assert m.fcr == pytest.approx(1.6, abs=0.01)


def test_no_fcr_without_data(db, env):
    batch = svc.create_batch(db, _batch_in(env, chick_avg_weight_kg=None))
    m = svc.compute_metrics(db, batch.id)
    assert m.fcr is None


# --- Редактирование событий (PUT) ---


def test_update_mortality(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    m = svc.create_mortality(db, batch.id, MortalityIn(date=D, head_count=3))
    upd = svc.update_mortality(db, batch.id, m.id, MortalityIn(date=D, head_count=5, cause="хищник"))
    assert upd.head_count == 5
    assert upd.cause == "хищник"
    assert svc.compute_metrics(db, batch.id).dead_head == 5


def test_update_weighing_changes_fcr(db, env):
    # без веса цыплёнка FCR идёт по контрольным взвешиваниям (нужно ≥2)
    batch = svc.create_batch(db, _batch_in(env, chick_avg_weight_kg=None))
    svc.create_feeding(db, batch.id, FeedingIn(date=D, feed_category_id=env["cat_id"],
                                               feed_brand_id=env["brand_id"], kg=120))
    svc.create_weighing(db, batch.id, WeighingIn(date=D, head_count=10, avg_weight_kg=0.5))
    w = svc.create_weighing(db, batch.id, WeighingIn(date=date(2025, 6, 20), head_count=10, avg_weight_kg=2.0))
    fcr1 = svc.compute_metrics(db, batch.id).fcr
    assert fcr1 is not None
    # меняем вес последнего взвешивания — FCR пересчитывается
    svc.update_weighing(db, batch.id, w.id, WeighingIn(date=date(2025, 6, 20), head_count=10, avg_weight_kg=2.4))
    fcr2 = svc.compute_metrics(db, batch.id).fcr
    assert fcr2 != fcr1


def test_update_slaughter_recomputes_live_weight(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    s = svc.create_slaughter(db, batch.id, SlaughterIn(
        date=D, head_count=10, outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=70)]))
    assert s["live_weight_kg"] == pytest.approx(100.0)  # 70/0.7
    # редактируем выход — живой вес пересчитывается
    upd = svc.update_slaughter(db, batch.id, s["id"], SlaughterIn(
        date=D, head_count=10, outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=84)]))
    assert upd["live_weight_kg"] == pytest.approx(120.0)


def test_update_sale_keeps_amount_rule(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_slaughter(db, batch.id, SlaughterIn(
        date=D, head_count=10, outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=18)]))
    sale = svc.create_sale(db, batch.id, SaleIn(date=D, product_type_id=env["ptype_id"],
                                                product_kg=10, price_per_kg=300))
    # правим кг — сумма пересчитывается (total не задан)
    upd = svc.update_sale(db, batch.id, sale.id, SaleIn(date=D, product_type_id=env["ptype_id"],
                                                        product_kg=12, price_per_kg=300))
    assert upd.total_amount == 3600.0


def test_update_sale_date_before_slaughter_blocked(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_slaughter(db, batch.id, SlaughterIn(
        date=D, head_count=10, outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=18)]))
    sale = svc.create_sale(db, batch.id, SaleIn(date=D, product_type_id=env["ptype_id"],
                                                product_kg=10, price_per_kg=300))
    with pytest.raises(ValueError, match="раньше даты забоя"):
        svc.update_sale(db, batch.id, sale.id, SaleIn(date=date(2025, 5, 1),
                                                      product_type_id=env["ptype_id"],
                                                      product_kg=10, price_per_kg=300))
