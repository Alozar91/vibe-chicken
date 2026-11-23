"""Идемпотентность: мидлварь Idempotency-Key + атомарность продаж из заказа.

Мидлварь тестируется через реальный app (TestClient): POST с одним ключом
дважды должен вернуть один и тот же ответ и создать запись один раз.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

import app.core.idempotency as idempotency_mod
from app.main import app
from app.core.db import Base, get_db
from app.models.dictionaries import MoneyCategory
from app.models.warehouse import MoneyTransaction
from app.models.idempotency import IdempotencyKey
from app.models.user import User
from app.core.security import hash_password
from tests.conftest import make_engine


@pytest.fixture()
def db():
    engine = make_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


@pytest.fixture()
def api(db, monkeypatch):
    """TestClient: и мидлварь, и роутеры работают с одной тестовой БД.

    Мидлварь открывает сессии сама (не через get_db) — подменяем SessionLocal
    на фабрику того же тестового движка. Тесты с TestClient в этом проекте
    запускаются с with — lifespan стартует; чтобы он не трогал продовую БД,
    admin в тестовой БД создаём сами (см. _login).
    """
    monkeypatch.setattr(idempotency_mod, "SessionLocal", sessionmaker(bind=db.get_bind()))
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


def _login(client, db):
    """Админ в тестовой БД + вход через API (cookie сессии в клиенте)."""
    db.add(User(username="admin", password_hash=hash_password("pass1"), role="admin"))
    db.add(MoneyCategory(name="Корм", kind="expense"))
    db.commit()
    r = client.post("/api/auth/login", json={"username": "admin", "password": "pass1"})
    assert r.status_code == 200


def test_same_key_returns_same_response_and_single_row(api, db):
    _login(api, db)

    cat_id = db.scalar(select(MoneyCategory.id).where(MoneyCategory.kind == "expense"))
    body = {"date": "2026-11-24", "money_category_id": cat_id, "amount": 100.5, "description": "тест"}
    headers = {"Idempotency-Key": "test-key-1"}

    r1 = api.post("/api/money/transactions", json=body, headers=headers)
    assert r1.status_code == 201
    r2 = api.post("/api/money/transactions", json=body, headers=headers)
    assert r2.status_code == 201
    assert r1.json() == r2.json()

    # запись создана ровно одна
    count = db.scalar(select(func.count()).select_from(MoneyTransaction))
    assert count == 1
    # ключ сохранён
    assert db.scalar(select(func.count()).select_from(IdempotencyKey)) == 1


def test_different_key_creates_second_row(api, db):
    _login(api, db)
    cat_id = db.scalar(select(MoneyCategory.id).where(MoneyCategory.kind == "expense"))
    body = {"date": "2026-11-24", "money_category_id": cat_id, "amount": 10}

    api.post("/api/money/transactions", json=body, headers={"Idempotency-Key": "k-a"})
    api.post("/api/money/transactions", json=body, headers={"Idempotency-Key": "k-b"})
    assert db.scalar(select(func.count()).select_from(MoneyTransaction)) == 2


def test_error_responses_not_cached(api, db):
    """Ошибки не сохраняются: исправив данные, клиент повторяет тот же ключ."""
    _login(api, db)
    cat_id = db.scalar(select(MoneyCategory.id).where(MoneyCategory.kind == "expense"))
    headers = {"Idempotency-Key": "err-key"}

    r1 = api.post("/api/money/transactions",
                  json={"date": "2026-11-24", "money_category_id": cat_id, "amount": -5},
                  headers=headers)
    assert r1.status_code == 422  # amount > 0

    r2 = api.post("/api/money/transactions",
                  json={"date": "2026-11-24", "money_category_id": cat_id, "amount": 5},
                  headers=headers)
    assert r2.status_code == 201  # повтор выполнен по-настоящему
    assert db.scalar(select(func.count()).select_from(MoneyTransaction)) == 1


def test_get_not_affected(api, db):
    _login(api, db)
    r = api.get("/api/money/transactions", headers={"Idempotency-Key": "k-get"})
    assert r.status_code == 200
    assert db.scalar(select(func.count()).select_from(IdempotencyKey)) == 0
