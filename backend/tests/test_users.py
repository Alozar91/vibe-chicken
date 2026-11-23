"""Тесты пользователей: роли, отключение, защита последнего админа, смена пароля.

Сервисные тесты — на in-memory БД (tests/conftest.py); роутерные — TestClient
без with (lifespan не запускается, реальная БД не трогается), get_db
переопределяется на тестовую сессию.
"""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.db import Base, get_db
from app.core.security import hash_password, verify_password
from app.main import app
from app.models.user import User
from app.schemas.users import PasswordChangeIn, UserCreateIn, UserUpdateIn
from app.services import users as svc
from tests.conftest import make_engine


@pytest.fixture()
def db():
    engine = make_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session


@pytest.fixture()
def env(db):
    admin = User(username="admin", password_hash=hash_password("secret1"), role="admin")
    member = User(username="mama", password_hash=hash_password("secret2"), role="user")
    db.add_all([admin, member])
    db.commit()
    return {"admin_id": admin.id, "member_id": member.id}


def test_create_user_and_list(db, env):
    u = svc.create_user(db, UserCreateIn(username="papa", password="pass1234", role="user"))
    assert u.role == "user" and u.is_active and verify_password("pass1234", u.password_hash)
    names = [x.username for x in svc.list_users(db)]
    assert names == ["admin", "mama", "papa"]


def test_create_duplicate_username(db, env):
    with pytest.raises(ValueError, match="уже есть"):
        svc.create_user(db, UserCreateIn(username="MAMA", password="pass1234"))
    # слишком короткий пароль отсекается схемой
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        svc.create_user(db, UserCreateIn(username="kid", password="123"))


def test_update_password_and_role(db, env):
    u = svc.update_user(db, env["member_id"], UserUpdateIn(password="newpass1", role="admin"),
                        actor_id=env["admin_id"])
    assert verify_password("newpass1", u.password_hash) and u.role == "admin"


def test_cannot_deactivate_self(db, env):
    with pytest.raises(ValueError, match="самого себя"):
        svc.update_user(db, env["admin_id"], UserUpdateIn(is_active=False), actor_id=env["admin_id"])


def test_last_admin_protected(db, env):
    # единственный админ не может быть понижен или отключён
    with pytest.raises(ValueError, match="без активного администратора"):
        svc.update_user(db, env["admin_id"], UserUpdateIn(role="user"), actor_id=env["admin_id"])
    with pytest.raises(ValueError, match="без активного администратора"):
        svc.update_user(db, env["admin_id"], UserUpdateIn(is_active=False), actor_id=env["member_id"])
    # но при наличии второго админа — можно
    svc.update_user(db, env["member_id"], UserUpdateIn(role="admin"), actor_id=env["admin_id"])
    svc.update_user(db, env["admin_id"], UserUpdateIn(role="user"), actor_id=env["admin_id"])
    assert db.get(User, env["admin_id"]).role == "user"


def test_change_password_requires_old(db, env):
    member = db.get(User, env["member_id"])
    with pytest.raises(ValueError, match="Старый пароль неверен"):
        svc.change_password(db, member, PasswordChangeIn(old_password="wrong", new_password="newpass1"))
    svc.change_password(db, member, PasswordChangeIn(old_password="secret2", new_password="newpass1"))
    assert verify_password("newpass1", member.password_hash)


# --- Роутер: вход отключённого, доступ по ролям ---


def _client(session):
    app.dependency_overrides[get_db] = lambda: session
    return TestClient(app, raise_server_exceptions=False)


def test_router_login_inactive_and_admin_gate(db, env):
    # отключаем члена семьи
    svc.update_user(db, env["member_id"], UserUpdateIn(is_active=False), actor_id=env["admin_id"])
    client = _client(db)

    r = client.post("/api/auth/login", json={"username": "mama", "password": "secret2"})
    assert r.status_code == 403 and "отключён" in r.json()["detail"]

    r = client.post("/api/auth/login", json={"username": "mama", "password": "secret2"})
    # не-админ не проходит к управлению (даже если бы вошёл)
    assert r.status_code in (401, 403)

    r = client.post("/api/auth/login", json={"username": "admin", "password": "secret1"})
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    assert client.get("/api/users").status_code == 200


def test_router_member_cannot_manage_users(db, env):
    client = _client(db)
    client.post("/api/auth/login", json={"username": "mama", "password": "secret2"})
    r = client.post("/api/users", json={"username": "kid", "password": "pass1234"})
    assert r.status_code == 403
    assert client.get("/api/users").status_code == 403
