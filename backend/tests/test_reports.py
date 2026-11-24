"""Тесты отчётов: месяцы, категории, яйцо, покупатели, партии."""

from datetime import date, timedelta

import pytest

from app.models.dictionaries import (
    Buyer,
    FeedBrand,
    FeedCategory,
    MoneyCategory,
    Place,
    ProductType,
    Vendor,
)
from app.models.warehouse import FeedPurchase
from app.schemas.broiler import (
    BatchIn,
    FeedingIn,
    MortalityIn,
    SaleIn,
    SlaughterIn,
    SlaughterOutputIn,
    WeighingIn,
)
from app.schemas.layers import EggCollectionIn, EggSaleIn, EggSelfUseIn
from app.services import broiler as bro
from app.services import feed as feed_svc
from app.services import layers as lay
from app.services import money as money_svc
from app.services import reports as rep
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from tests.conftest import make_engine

TODAY = date.today()


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
    lay_place = Place(name="Курятник", kind="lay_house")
    buyer = Buyer(name="Пётр")
    cat_inc = MoneyCategory(name="Продажа продукции", kind="income")
    cat_exp = MoneyCategory(name="Электричество", kind="expense", is_general=True)
    feed_cat = FeedCategory(name="ПК")
    brand = FeedBrand(name="Маркорм")
    vendor = Vendor(name="Завод", types=["feed", "chicks"])
    product = ProductType(name="Тушка")
    db.add_all([place, lay_place, buyer, cat_inc, cat_exp, feed_cat, brand, vendor, product])
    db.commit()
    return {
        "place_id": place.id, "lay_place_id": lay_place.id, "buyer_id": buyer.id,
        "income_id": cat_inc.id, "expense_id": cat_exp.id,
        "feed_cat": feed_cat.id, "feed_brand": brand.id, "vendor_id": vendor.id,
        "ptype_id": product.id,
    }


def _batch(db, env, code="B-202611-1", heads=100):
    return bro.create_batch(db, BatchIn(
        code=code, place_id=env["place_id"], start_date=TODAY - timedelta(days=30),
        head_count=heads, chick_price_per_head=60, chick_avg_weight_kg=0.04,
        vendor_id=env["vendor_id"]))


def test_monthly_continuous_axis_and_amounts(db, env):
    money_svc.create_transaction(db, date_=TODAY, money_category_id=env["income_id"],
                                 amount=1000.0, description=None, batch_id=None)
    money_svc.create_transaction(db, date_=TODAY - timedelta(days=40),
                                 money_category_id=env["expense_id"],
                                 amount=300.0, description=None, batch_id=None)
    points = rep.monthly(db, months=6)
    assert len(points) == 6
    assert points[-1].month == TODAY.strftime("%Y-%m")
    assert points[-1].income == 1000.0
    # месяц 40 дней назад — второй с конца или раньше, там расход
    prev = [p for p in points if p.expense == 300.0]
    assert len(prev) == 1 and prev[0].balance == -300.0
    # нулевые месяцы присутствуют (непрерывная ось)
    assert all(p.income == 0 and p.expense == 0 for p in points[:-2] if p.month not in
               {TODAY.strftime("%Y-%m"), prev[0].month})


def test_categories_by_month(db, env):
    this_month = TODAY.strftime("%Y-%m")
    money_svc.create_transaction(db, date_=TODAY, money_category_id=env["expense_id"],
                                 amount=250.0, description=None, batch_id=None)
    money_svc.create_transaction(db, date_=TODAY, money_category_id=env["income_id"],
                                 amount=900.0, description=None, batch_id=None)
    slices = rep.categories(db, this_month)
    exp = [s for s in slices if s.kind == "expense"]
    assert len(exp) == 1 and exp[0].name == "Электричество" and exp[0].total == 250.0
    inc = [s for s in slices if s.kind == "income"]
    assert inc[0].total == 900.0


def test_eggs_and_buyers(db, env):
    flock = lay.create_flock(db, lay.LayFlockIn(
        name="Несушки", place_id=env["lay_place_id"], start_date=TODAY - timedelta(days=60)))
    lay.create_change(db, flock.id, lay.LayFlockChangeIn(date=TODAY - timedelta(days=60), head_delta=30))
    lay.create_collection(db, flock.id, EggCollectionIn(date=TODAY, pieces=120))
    lay.create_selfuse(db, flock.id, EggSelfUseIn(date=TODAY, pieces=20))
    lay.create_sale(db, EggSaleIn(
        date=TODAY, dozens=50, price_per_ten=90, buyer_id=env["buyer_id"], total_amount=None))

    eggs = rep.eggs_by_month(db, months=3)
    assert eggs[-1].collected == 120 and eggs[-1].selfused == 20
    assert eggs[-1].dozens_sold == 50 and eggs[-1].revenue == 4500.0

    rows = rep.buyers(db, months=12)
    assert len(rows) == 1
    r = rows[0]
    assert r.name == "Пётр" and r.egg_dozens == 50 and r.egg_amount == 4500.0
    assert r.total == 4500.0
    # продажа без покупателя попадает в «Без покупателя»
    lay.create_sale(db, EggSaleIn(date=TODAY, dozens=5, price_per_ten=80, buyer_id=None, total_amount=None))
    rows = rep.buyers(db, months=12)
    assert {r.name for r in rows} == {"Пётр", "Без покупателя"}


def test_batches_report_feed_cost(db, env):
    # закупка корма: 100 кг за 5000 → 50 ₽/кг
    feed_svc.create_purchase(db, feed_svc.FeedPurchaseIn(
        date=TODAY - timedelta(days=20), feed_category_id=env["feed_cat"],
        feed_brand_id=env["vendor_id"], vendor_id=env["vendor_id"],
        kg=100, total_cost=5000, comment=None))
    batch = _batch(db, env)
    bro.create_feeding(db, batch.id, FeedingIn(
        date=TODAY - timedelta(days=10), feed_category_id=env["feed_cat"],
        feed_brand_id=env["vendor_id"], kg=30))
    bro.create_mortality(db, batch.id, MortalityIn(date=TODAY - timedelta(days=5), head_count=3, cause=None))
    bro.create_slaughter(db, batch.id, SlaughterIn(
        date=TODAY, head_count=50,
        outputs=[SlaughterOutputIn(product_type_id=1, kg=25)]))
    bro.create_sale(db, batch.id, SaleIn(
        date=TODAY, product_type_id=1, product_kg=20, price_per_kg=220,
        buyer_id=env["buyer_id"], total_amount=4400))

    rows = rep.batches(db)
    assert len(rows) == 1
    r = rows[0]
    assert r.code == "B-202611-1"
    assert r.feed_kg == 30 and r.feed_cost == 1500.0  # 30 кг × 50 ₽
    # прямые: 100×60 (цыплята) + 1500 (корм) = 7500
    assert r.direct_costs == 7500.0
    assert r.revenue == 4400.0
    assert r.profit == 4400 - 7500 - r.shared_costs
    assert r.profit_per_head is not None and abs(r.profit_per_head - r.profit / 100) < 0.01


def test_dashboard_summary(db, env):
    """Дашборд: KPI месяца, последние партии (возраст, взвешивание), заказы."""
    from app.schemas.orders import OrderIn
    from app.services import orders as orders_svc

    # партия: поступила 30 дней назад подрощенной (20 дн) → сегодня возраст 50
    batch = bro.create_batch(db, BatchIn(
        code="B-DASH-1", place_id=env["place_id"], start_date=TODAY - timedelta(days=30),
        arrival_age_days=20, head_count=100, chick_price_per_head=60,
        chick_avg_weight_kg=0.04, vendor_id=env["vendor_id"]))
    bro.create_mortality(db, batch.id, MortalityIn(date=TODAY - timedelta(days=5), head_count=3, cause=None))
    bro.create_weighing(db, batch.id, WeighingIn(
        date=TODAY - timedelta(days=5), head_count=50, avg_weight_kg=1.2))
    bro.create_weighing(db, batch.id, WeighingIn(
        date=TODAY - timedelta(days=12), head_count=50, avg_weight_kg=0.8))

    # корм: 100 кг куплено, 30 скормлено → 70 на складе
    feed_svc.create_purchase(db, feed_svc.FeedPurchaseIn(
        date=TODAY - timedelta(days=20), feed_category_id=env["feed_cat"],
        feed_brand_id=env["vendor_id"], vendor_id=env["vendor_id"],
        kg=100, total_cost=5000, comment=None))
    bro.create_feeding(db, batch.id, FeedingIn(
        date=TODAY - timedelta(days=10), feed_category_id=env["feed_cat"],
        feed_brand_id=env["vendor_id"], kg=30))

    # яйцо за текущий месяц
    flock = lay.create_flock(db, lay.LayFlockIn(
        name="Несушки", place_id=env["lay_place_id"], start_date=TODAY - timedelta(days=60)))
    lay.create_change(db, flock.id, lay.LayFlockChangeIn(date=TODAY - timedelta(days=60), head_delta=30))
    lay.create_collection(db, flock.id, EggCollectionIn(date=TODAY, pieces=120))
    lay.create_sale(db, EggSaleIn(
        date=TODAY, dozens=50, price_per_ten=90, buyer_id=env["buyer_id"], total_amount=None))

    # деньги за текущий месяц + заказ
    money_svc.create_transaction(db, date_=TODAY, money_category_id=env["income_id"],
                                 amount=900.0, description=None, batch_id=None)
    money_svc.create_transaction(db, date_=TODAY, money_category_id=env["expense_id"],
                                 amount=250.0, description=None, batch_id=None)
    orders_svc.create_order(db, OrderIn(
        date=TODAY, buyer_id=env["buyer_id"],
        items=[{"kind": "egg", "qty": 20, "price_per_unit": 60}]))

    d = rep.dashboard(db)
    # 900 (ручной доход) + 4500 (авто-транзакция продажи яйца 50 дес × 90 ₽)
    assert d.month_income == 5400.0 and d.month_expense == 250.0 and d.month_balance == 5150.0
    assert d.egg_collected == 120 and d.egg_dozens_sold == 50
    assert d.active_batches == 1 and d.active_heads == 97
    assert d.orders_open == 1
    assert d.feed_stock_kg == 70.0

    assert len(d.recent_batches) == 1
    b = d.recent_batches[0]
    assert b.code == "B-DASH-1" and b.status == "active"
    assert b.heads_alive == 97
    assert b.age_days == 50  # 30 дней с поступления + возраст при поступлении 20
    assert b.last_weighing is not None
    assert b.last_weighing.avg_weight_kg == 1.2  # именно последнее (не первое)
    assert b.last_weighing.date == (TODAY - timedelta(days=5)).isoformat()

    assert len(d.recent_orders) == 1
    o = d.recent_orders[0]
    assert o.buyer_name == "Пётр" and o.status == "new"
    assert o.items[0].kind == "egg" and o.items[0].qty == 20 and o.items[0].unit == "dozens"


def test_dashboard_closed_batch_has_no_age(db, env):
    """Закрытой партии возраст не показываем (age_days=None), но в списке она есть."""
    batch = bro.create_batch(db, BatchIn(
        code="B-DASH-2", place_id=env["place_id"], start_date=TODAY - timedelta(days=90),
        head_count=50, chick_price_per_head=60, chick_avg_weight_kg=0.04,
        vendor_id=env["vendor_id"]))
    bro.create_slaughter(db, batch.id, SlaughterIn(
        date=TODAY, head_count=47, live_weight_kg=94.0,
        outputs=[SlaughterOutputIn(product_type_id=1, kg=65.0)]))
    bro.close_batch(db, batch.id)
    d = rep.dashboard(db)
    mine = [b for b in d.recent_batches if b.code == "B-DASH-2"]
    assert len(mine) == 1
    assert mine[0].status == "closed" and mine[0].age_days is None
    assert mine[0].heads_alive == 3


# --- Продажи по видам продукции (products) ---


def test_products_aggregation(db, env):
    """Бройлер по видам + яйцо отдельной строкой; сортировка по сумме."""
    batch = _batch(db, env, code="B-PRD-1")
    bro.create_slaughter(db, batch.id, SlaughterIn(
        date=TODAY, head_count=10,
        outputs=[SlaughterOutputIn(product_type_id=env["ptype_id"], kg=15.0)],
    ))
    bro.create_sale(db, batch.id, SaleIn(
        date=TODAY, product_type_id=env["vendor_id"], product_kg=10.0,
        price_per_kg=300.0, buyer_id=env["buyer_id"],
    ))
    bro.create_sale(db, batch.id, SaleIn(
        date=TODAY, product_type_id=env["vendor_id"], product_kg=2.0,
        price_per_kg=300.0,
    ))
    lay.create_sale(db, EggSaleIn(
        date=TODAY, dozens=5, price_per_ten=60.0, buyer_id=env["buyer_id"]))
    lay.create_sale(db, EggSaleIn(date=TODAY, dozens=3, price_per_ten=60.0))

    rows = rep.products(db, months=12)
    by_id = {r.product_type_id: r for r in rows}
    egg = by_id[None]
    assert egg.name == "Яйцо" and egg.unit == "dozen"
    assert egg.dozen == 8 and egg.amount == 480.0 and egg.sales_count == 2
    carcass = by_id[env["vendor_id"]]
    assert carcass.kg == 12.0 and carcass.amount == 3600.0 and carcass.sales_count == 2
    # сортировка по сумме: продукция (3600) выше яйца (480)
    assert rows[0].product_type_id == env["vendor_id"]
