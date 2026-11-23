"""Тесты несушек: стада, поголовье, сбор/самопотребление яйца, продажи, метрики."""

from datetime import date, timedelta

import pytest

from app.models.dictionaries import MoneyCategory, Place
from app.schemas.layers import (
    EggCollectionIn,
    EggSaleIn,
    EggSelfUseIn,
    LayFlockChangeIn,
    LayFlockIn,
    LayFeedingIn,
)
from app.services import layers as svc
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from tests.conftest import make_engine

D = date(2026, 1, 1)


@pytest.fixture()
def db():


    engine = make_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


@pytest.fixture()
def env(db):
    from app.models.dictionaries import FeedBrand, FeedCategory

    place = Place(name="Курятник", kind="coop")
    cat = FeedCategory(name="ПК")
    brand = FeedBrand(name="Маркорм")
    db.add_all([place, cat, brand])
    db.commit()
    return {"place_id": place.id, "cat_id": cat.id, "brand_id": brand.id}


def _flock_in(env, **over):
    data = {"name": "Несушки-1", "place_id": env["place_id"], "start_date": D}
    data.update(over)
    return LayFlockIn(**data)


def test_flock_crud_and_dup_name(db, env):
    f = svc.create_flock(db, _flock_in(env))
    assert f.status == "active"
    with pytest.raises(ValueError, match="уже есть"):
        svc.create_flock(db, _flock_in(env))
    upd = svc.update_flock(db, f.id, _flock_in(env, name="Несушки-А"))
    assert upd.name == "Несушки-А"
    closed = svc.close_flock(db, f.id)
    assert closed.status == "closed"


def test_changes_head_rules(db, env):
    f = svc.create_flock(db, _flock_in(env))
    with pytest.raises(ValueError, match="не может быть нулевым"):
        svc.create_change(db, f.id, LayFlockChangeIn(date=D, head_delta=0))
    svc.create_change(db, f.id, LayFlockChangeIn(date=D, head_delta=30))
    with pytest.raises(ValueError, match="раньше даты"):
        svc.create_change(db, f.id, LayFlockChangeIn(date=D - timedelta(days=1), head_delta=5))
    svc.create_change(db, f.id, LayFlockChangeIn(date=D + timedelta(days=10), head_delta=-10, reason="брак"))
    assert svc.current_head(db, f.id) == 20
    # списание больше поголовья блокируется
    with pytest.raises(ValueError, match="списать больше"):
        svc.create_change(db, f.id, LayFlockChangeIn(date=D + timedelta(days=11), head_delta=-25))
    # правка: −10 → −5
    ch = svc.list_changes(db, f.id)[1]
    svc.update_change(db, f.id, ch.id, LayFlockChangeIn(date=D + timedelta(days=10), head_delta=-5))
    assert svc.current_head(db, f.id) == 25
    # удаление базовой записи (+30) уводит поголовье в минус — запрещено
    first = svc.list_changes(db, f.id)[0]
    with pytest.raises(ValueError, match="минус"):
        svc.delete_change(db, f.id, first.id)
    assert svc.current_head(db, f.id) == 25


def test_selfuse_cannot_exceed_laid(db, env):
    f = svc.create_flock(db, _flock_in(env))
    with pytest.raises(ValueError, match="не найден"):
        svc.create_collection(db, 999, EggCollectionIn(date=D, pieces=10))
    svc.create_collection(db, f.id, EggCollectionIn(date=D, pieces=10))
    svc.create_selfuse(db, f.id, EggSelfUseIn(date=D, pieces=5))
    with pytest.raises(ValueError, match="больше, чем собрано"):
        svc.create_selfuse(db, f.id, EggSelfUseIn(date=D, pieces=10))


def test_egg_sale_money_transaction(db, env):
    db.add(MoneyCategory(name="Продажа продукции", kind="income"))
    db.commit()
    sale = svc.create_sale(db, EggSaleIn(
        date=D, dozens=10, price_per_ten=90.0, buyer_id=None, total_amount=None))
    assert float(sale.total_amount) == 900.0
    # введённая сумма сохраняется, если отличается
    sale2 = svc.create_sale(db, EggSaleIn(
        date=D, dozens=5, price_per_ten=90.0, buyer_id=None, total_amount=400.0))
    assert float(sale2.total_amount) == 400.0
    from sqlalchemy import select

    from app.models.warehouse import MoneyTransaction

    txs = list(db.scalars(select(MoneyTransaction).where(MoneyTransaction.source_type == "egg_sale")))
    assert len(txs) == 2
    svc.update_sale(db, sale2.id, EggSaleIn(
        date=D, dozens=5, price_per_ten=100.0, buyer_id=None, total_amount=None))
    db.expire_all()
    tx2 = db.get(MoneyTransaction, txs[1].id)
    assert float(tx2.amount) == 500.0
    svc.delete_sale(db, sale2.id)
    db.expire_all()
    assert db.get(MoneyTransaction, txs[1].id) is None


def test_metrics(db, env):
    f = svc.create_flock(db, _flock_in(env))
    svc.create_change(db, f.id, LayFlockChangeIn(date=D, head_delta=30))
    today = date.today()
    svc.create_collection(db, f.id, EggCollectionIn(date=today, pieces=20))
    svc.create_collection(db, f.id, EggCollectionIn(date=today - timedelta(days=1), pieces=25))
    svc.create_selfuse(db, f.id, EggSelfUseIn(date=today, pieces=5))
    svc.create_feeding(db, f.id, LayFeedingIn(
        date=D, feed_category_id=env["cat_id"], feed_brand_id=env["brand_id"], kg=2.5))
    m = svc.compute_flock_metrics(db, f.id)
    assert m.current_head == 30
    assert m.eggs_total == 45
    assert m.selfuse_total == 5
    assert m.feed_kg == 2.5
    # яйценоскость: (20+25)/(30×7)×100 ≈ 21.4
    assert m.lay_rate_pct is not None and abs(m.lay_rate_pct - 45 / 210 * 100) < 0.1
