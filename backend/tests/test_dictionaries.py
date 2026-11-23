"""Тесты бизнес-логики справочников (уровень сервисов, без HTTP)."""

import pytest

import app.models  # noqa: F401 — регистрация моделей
from app.schemas.dictionaries import PlaceIn, VendorIn
from app.services import dictionaries as svc
from sqlalchemy.orm import sessionmaker

from app.core.db import Base
from tests.conftest import make_engine


@pytest.fixture()
def db():
    engine = make_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


# --- Места содержания ---


def test_create_place_ok(db):
    place = svc.create_place(db, PlaceIn(name="Модуль 1", kind="broiler_module"))
    assert place.id is not None


def test_create_place_duplicate_name(db):
    svc.create_place(db, PlaceIn(name="Модуль 1", kind="broiler_module"))
    with pytest.raises(ValueError, match="уже есть"):
        svc.create_place(db, PlaceIn(name="Модуль 1", kind="broiler_module"))


def test_delete_missing_place(db):
    with pytest.raises(ValueError, match="не найдена"):
        svc.delete_place(db, 999)


# --- Продавцы: жёсткие теги ---


def test_vendor_requires_at_least_one_type(db):
    with pytest.raises(Exception):
        svc.create_vendor(db, VendorIn(name="Кто-то", note=None, types=[]))


def test_vendor_filter_by_type(db):
    svc.create_vendor(db, VendorIn(name="Птицефабрика", note=None, types=["chicks", "feed"]))
    svc.create_vendor(db, VendorIn(name="Кормовая база", note=None, types=["feed"]))

    chicks = svc.list_vendors(db, vendor_type="chicks")
    feed = svc.list_vendors(db, vendor_type="feed")
    meds = svc.list_vendors(db, vendor_type="meds")

    assert [v.name for v in chicks] == ["Птицефабрика"]
    assert [v.name for v in feed] == ["Кормовая база", "Птицефабрика"]
    assert meds == []


def test_vendor_types_editable(db):
    vendor = svc.create_vendor(db, VendorIn(name="Птицефабрика", note=None, types=["chicks"]))
    updated = svc.update_vendor(
        db, vendor.id, VendorIn(name="Птицефабрика", note="ошибка исправлена", types=["chicks", "feed"])
    )
    assert sorted(updated.types) == ["chicks", "feed"]
