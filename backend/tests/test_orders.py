"""Тесты заказов покупателей (concept.md §4.7): CRUD, статусы, продажи из заказа."""

from datetime import date

import pytest

from app.models.dictionaries import Place, ProductType, Vendor
from app.schemas.broiler import BatchIn, SlaughterIn, SlaughterOutputIn
from app.schemas.layers import EggSaleIn
from app.schemas.orders import OrderIn, OrderProductSaleIn, OrderStatusIn
from app.services import broiler as broiler_svc
from app.services import layers as layers_svc
from app.services import orders as svc

D = date(2026, 1, 10)


@pytest.fixture()
def db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    import app.models  # noqa: F401
    from app.core.db import Base

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


@pytest.fixture()
def env(db):
    place = Place(name="Модуль 1", kind="broiler_module")
    vendor = Vendor(name="Ферма", types=["chicks"])
    carcass = ProductType(name="Тушка", unit="pieces")
    liver = ProductType(name="Печень", unit="kg")
    db.add_all([place, vendor, carcass, liver])
    db.commit()
    return {"place_id": place.id, "vendor_id": vendor.id, "carcass_id": carcass.id, "liver_id": liver.id}


def _order_in(env, buyer_id, **over):
    data = {
        "date": D,
        "buyer_id": buyer_id,
        "items": [
            {"kind": "egg", "qty": 20, "price_per_unit": 60},
            {"kind": "product", "product_type_id": env["carcass_id"], "qty": 6, "price_per_unit": 350},
        ],
    }
    data.update(over)
    return OrderIn(**data)


@pytest.fixture()
def buyer_id(db):
    from app.models.dictionaries import Buyer

    b = Buyer(name="Ионов")
    db.add(b)
    db.commit()
    return b.id


@pytest.fixture()
def batch_id(db, env):
    b = broiler_svc.create_batch(
        db,
        BatchIn(
            code="B-1", place_id=env["place_id"], start_date=date(2026, 1, 1),
            head_count=50, vendor_id=env["vendor_id"], chick_price_per_head=100,
        ),
    )
    # забой: 40 голов, выход тушки 28 кг (средний вес тушки 0.7 кг)
    broiler_svc.create_slaughter(
        db, b.id,
        SlaughterIn(date=date(2026, 1, 9), head_count=40,
                    outputs=[SlaughterOutputIn(product_type_id=env["carcass_id"], kg=28)]),
    )
    return b.id


def test_order_crud_and_validation(db, env, buyer_id):
    order = svc.create_order(db, _order_in(env, buyer_id=buyer_id))
    assert order.status == "new"
    assert len(order.items) == 2
    assert order.items[0].unit == "dozens"
    assert order.items[1].unit == "pieces"

    with pytest.raises(ValueError, match="не найден"):
        svc.create_order(db, _order_in(env, 999))
    with pytest.raises(ValueError, match="не найден"):
        svc.create_order(db, _order_in(env, buyer_id, items=[{"kind": "product", "product_type_id": 999, "qty": 1}]))

    upd = svc.update_order(db, order.id, _order_in(env, buyer_id, comment="привезти утром"))
    assert upd.comment == "привезти утром"
    svc.delete_order(db, order.id)
    assert svc.list_orders(db) == []


def test_update_blocked_with_sales(db, env, buyer_id):
    order = svc.create_order(db, _order_in(env, buyer_id=buyer_id))
    item = order.items[0]
    svc.create_egg_fulfillment(db, order.id, item.id, EggSaleIn(date=D, dozens=10, price_per_ten=60))
    with pytest.raises(ValueError, match="уже есть продажи"):
        svc.update_order(db, order.id, _order_in(env, buyer_id=buyer_id))
    with pytest.raises(ValueError, match="уже есть продажи"):
        svc.delete_order(db, order.id)


def test_egg_fulfillment_and_auto_status(db, env, buyer_id, batch_id):
    order = svc.create_order(db, _order_in(env, buyer_id))
    egg_item = order.items[0]   # 20 десятков
    carcass_item = order.items[1]  # 6 тушек
    # факт: только 14 десятков (не хватило)
    svc.create_egg_fulfillment(db, order.id, egg_item.id, EggSaleIn(date=D, dozens=14, price_per_ten=60))
    detail = svc.get_order_detail(db, order.id)
    assert detail.metrics[0].ordered_qty == 20
    assert detail.metrics[0].fulfilled_qty == 14
    assert detail.metrics[0].remaining_qty == 6
    assert detail.metrics[0].pct == 70.0
    assert order.status == "new"
    # довоз: ещё 6 → яйцо закрыто, но тушки нет → заказ ещё new
    svc.create_egg_fulfillment(db, order.id, egg_item.id, EggSaleIn(date=D, dozens=6, price_per_ten=60))
    detail = svc.get_order_detail(db, order.id)
    assert order.status == "new"
    # тушки: 6 шт × 0.7 кг = 4.2 кг → все позиции закрыты → done
    svc.create_product_fulfillment(
        db, order.id, carcass_item.id, batch_id,
        OrderProductSaleIn(date=D, product_kg=4.2, price_per_kg=350),
    )
    detail = svc.get_order_detail(db, order.id)
    assert order.status == "done"
    assert len(detail.fulfillments) == 3
    # продажи яйца создались с покупателем из заказа
    sales = layers_svc.list_sales(db)
    assert len(sales) == 2 and all(s.buyer_id == buyer_id for s in sales)


def test_manual_status_and_cancelled_guard(db, env, buyer_id):
    order = svc.create_order(db, _order_in(env, buyer_id=buyer_id))
    svc.set_status(db, order.id, OrderStatusIn(status="done"))
    assert order.status == "done" and order.closed_manually
    # ручной done не перещёлкивается обратно при новых продажах
    svc.create_egg_fulfillment(db, order.id, order.items[0].id, EggSaleIn(date=D, dozens=1, price_per_ten=60))
    assert order.status == "done"

    order2 = svc.create_order(db, _order_in(env, buyer_id=buyer_id))
    svc.set_status(db, order2.id, OrderStatusIn(status="cancelled"))
    with pytest.raises(ValueError, match="отменён"):
        svc.create_egg_fulfillment(db, order2.id, order2.items[0].id, EggSaleIn(date=D, dozens=5, price_per_ten=60))


def test_product_fulfillment_kg_to_pieces(db, env, buyer_id, batch_id):
    order = svc.create_order(db, _order_in(env, buyer_id=buyer_id))
    item = order.items[1]  # 6 тушек
    # 6 тушек × 0.7 кг = 4.2 кг; яйцо (20 дес) ещё не продано → заказ остаётся new
    svc.create_product_fulfillment(db, order.id, item.id, batch_id, OrderProductSaleIn(date=D, product_kg=4.2, price_per_kg=350))
    detail = svc.get_order_detail(db, order.id)
    m = detail.metrics[1]
    assert m.fulfilled_qty == 6.0
    assert m.remaining_qty == 0.0
    assert m.pct == 100.0
    assert order.status == "new"  # яйцо не продано
    assert detail.metrics[0].fulfilled_qty == 0


def test_delete_fulfillment(db, env, buyer_id):
    order = svc.create_order(db, _order_in(env, buyer_id=buyer_id))
    item = order.items[0]
    f = svc.create_egg_fulfillment(db, order.id, item.id, EggSaleIn(date=D, dozens=10, price_per_ten=60))
    svc.delete_fulfillment(db, order.id, f.id)
    detail = svc.get_order_detail(db, order.id)
    assert detail.fulfillments == []
    assert detail.metrics[0].fulfilled_qty == 0
    assert layers_svc.list_sales(db) == []
