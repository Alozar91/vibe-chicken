"""Тесты партий бройлеров: теги, даты, забой, продажи, метрики."""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

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
from app.services import money
from app.services import dictionaries as dict_svc
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from tests.conftest import make_engine

D = date(2025, 6, 1)


@pytest.fixture()
def db():
    engine = make_engine()
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


# --- Редактирование партии ---


def test_update_batch_price_updates_money_tx(db, env):
    batch = svc.create_batch(db, _batch_in(env))  # 50 гол × 100 = 5000
    upd = svc.update_batch(db, batch.id, _batch_in(env, chick_price_per_head=60))
    assert upd.chick_price_per_head == 60.0
    tx = db.scalar(select(MoneyTransaction).where(MoneyTransaction.batch_id == batch.id))
    assert tx.amount == 3000.0  # 50 гол × 60


def test_update_batch_head_count_below_lost_blocked(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_mortality(db, batch.id, MortalityIn(date=D, head_count=10))
    with pytest.raises(ValueError, match="выбывших"):
        svc.update_batch(db, batch.id, _batch_in(env, head_count=5))


def test_update_batch_start_date_after_event_blocked(db, env):
    batch = svc.create_batch(db, _batch_in(env))
    svc.create_feeding(db, batch.id, FeedingIn(date=date(2025, 6, 10), feed_category_id=env["cat_id"],
                                               feed_brand_id=env["brand_id"], kg=10))
    with pytest.raises(ValueError, match="позже первого события"):
        svc.update_batch(db, batch.id, _batch_in(env, start_date=date(2025, 6, 20)))


def test_update_batch_duplicate_code_blocked(db, env):
    b1 = svc.create_batch(db, _batch_in(env))
    b2 = svc.create_batch(db, _batch_in(env, code="B-2"))
    with pytest.raises(ValueError, match="уже есть"):
        svc.update_batch(db, b2.id, _batch_in(env, code=b1.code))


# --- Журнал денег: авто-записи и распределение общих расходов ---


def _setup_money_cats(db):
    """Категории: лечение, продажа (доход), электричество (общая)."""
    treat = MoneyCategory(name="Лечение", kind="expense")
    sale_cat = MoneyCategory(name="Продажа продукции", kind="income")
    el = MoneyCategory(name="Электричество", kind="expense", is_general=True)
    db.add_all([treat, sale_cat, el])
    db.commit()
    return treat.id, sale_cat.id, el.id


def test_auto_transactions_created_and_synced(db, env):
    _setup_money_cats(db)
    b = svc.create_batch(db, _batch_in(env))  # 50×100 = 5000
    tr = svc.create_treatment(db, b.id, TreatmentIn(date=D, description="Вакцина", cost=250.0))
    svc.create_slaughter(db, b.id, SlaughterIn(
        date=D, head_count=5, outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=10.0)]))
    sale = svc.create_sale(db, b.id, SaleIn(
        date=D, product_type_id=env["ptype_id"], product_kg=10.0,
        price_per_kg=200.0, buyer_id=env["buyer_id"], total_amount=2000.0))

    txs = list(db.scalars(select(MoneyTransaction)))
    assert len(txs) == 3
    chicks = next(t for t in txs if t.source_type == "chicks")
    treat_tx = next(t for t in txs if t.source_type == "treatment")
    sale_tx = next(t for t in txs if t.source_type == "sale")
    assert float(chicks.amount) == 5000.0 and chicks.batch_id == b.id and chicks.is_auto
    assert float(treat_tx.amount) == 250.0 and treat_tx.batch_id == b.id
    assert float(sale_tx.amount) == 2000.0

    # правка события → синхронизация записи
    svc.update_treatment(db, b.id, tr.id, TreatmentIn(date=D, description="Вакцина", cost=300.0))
    db.expire_all()
    treat_tx = db.get(MoneyTransaction, treat_tx.id)
    assert float(treat_tx.amount) == 300.0

    # удаление события → удаление записи
    svc.delete_sale(db, b.id, sale.id)
    db.expire_all()
    assert db.get(MoneyTransaction, sale_tx.id) is None


def test_manual_transactions_crud_and_auto_guard(db, env):
    _setup_money_cats(db)
    tx = money.create_transaction(
        db, date_=D, money_category_id=_setup_money_cats(db)[2], amount=1500.0,
        description="Свет за месяц", batch_id=None)
    upd = money.update_transaction(
        db, tx["id"], date_=D, money_category_id=tx["money_category_id"],
        amount=1800.0, description=None, batch_id=None)
    assert upd["amount"] == 1800.0

    # авто-запись нельзя менять/удалять вручную
    b = svc.create_batch(db, _batch_in(env))
    chicks_tx = db.scalar(select(MoneyTransaction).where(MoneyTransaction.source_type == "chicks"))
    with pytest.raises(ValueError, match="Автоматическую"):
        money.update_transaction(
            db, chicks_tx.id, date_=D, money_category_id=1, amount=1.0,
            description=None, batch_id=None)
    with pytest.raises(ValueError, match="Автоматическую"):
        money.delete_transaction(db, chicks_tx.id)

    money.delete_transaction(db, tx["id"])
    assert db.get(MoneyTransaction, tx["id"]) is None


def test_general_expense_distribution_by_chicken_days(db, env):
    _setup_money_cats(db)
    el = db.scalar(select(MoneyCategory).where(MoneyCategory.name == "Электричество"))

    # партия А: 50 гол с D (1 июня); партия Б: 50 гол с 26 июня
    a = svc.create_batch(db, _batch_in(env, code="B-A"))
    b = svc.create_batch(db, _batch_in(env, code="B-B", start_date=D + timedelta(days=25)))
    money.create_transaction(
        db, date_=D, money_category_id=el.id, amount=620.0,
        description="Электричество за июнь", batch_id=None)

    today = D + timedelta(days=60)
    days = money.chicken_days_by_month(db, today=today)
    assert days["2025-06"] == 50 * 30 + 50 * 5  # А: 30 дней, Б: 5 дней июня

    share_a = money.general_expense_share(db, a, today=today)
    share_b = money.general_expense_share(db, b, today=today)
    # 620 ₽ × (1500 / 1750) и (250 / 1750)
    assert abs(share_a - 620 * 1500 / 1750) < 0.01
    assert abs(share_b - 620 * 250 / 1750) < 0.01

    # метрики: доля общих попадает в profit
    svc.create_slaughter(db, a.id, SlaughterIn(
        date=D + timedelta(days=10), head_count=5,
        outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=10.0)]))
    svc.create_sale(db, a.id, SaleIn(
        date=D + timedelta(days=10), product_type_id=env["ptype_id"], product_kg=10.0,
        price_per_kg=200.0, buyer_id=env["buyer_id"]))
    m = svc.compute_metrics(db, a.id)
    assert m.shared_costs > 0
    assert abs(m.profit - (m.revenue - m.direct_costs - m.shared_costs)) < 0.01


def test_batch_arrival_age(db, env):
    """Возраст при поступлении: default 1 (суточные), подрощенные — своё значение."""
    from app.services.broiler import batch_age_days

    daily = svc.create_batch(db, _batch_in(env))  # default
    assert daily.arrival_age_days == 1
    # суточные: в день поступления возраст 1
    assert batch_age_days(daily, on_date=D) == 1

    grown = svc.create_batch(db, _batch_in(
        env, code="B-2025-2", start_date=D - timedelta(days=10), arrival_age_days=30))
    assert grown.arrival_age_days == 30
    # 10 дней на ферме + 30 при поступлении = 40
    assert batch_age_days(grown, on_date=D) == 40
    # возраст на конкретную дату (день поступления) = 30
    assert batch_age_days(grown, on_date=D - timedelta(days=10)) == 30


# --- Подсказка номера партии (next_code) ---


def test_next_code_sequential(db, env):
    """B-202611-1 → следующая подсказка B-202611-2; новый месяц → -1."""
    from app.services import broiler as svc2

    b1 = svc.create_batch(db, _batch_in(env, code="B-202611-1"))
    assert svc2.next_code(db) == "B-202611-2"
    svc.create_batch(db, _batch_in(env, code="B-202611-2"))
    assert svc2.next_code(db) == "B-202611-3"
    # чужой префикс не мешает
    assert svc2.next_code(db, "B-202612") == "B-202612-1"
    # суффикс не-число игнорируется (не влияет на порядковый номер)
    svc.create_batch(db, _batch_in(env, code="B-202611-старая"))
    assert svc2.next_code(db) == "B-202611-3"
    _ = b1
