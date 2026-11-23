"""Общие фикстуры тестов.

Тестовый движок повторяет продовый (app/core/db.py): SQLite с включённым
PRAGMA foreign_keys — иначе FK-нарушения всплывают только на живом сервере.
"""

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  (регистрация моделей для Base.metadata)
from app.core.db import Base


def make_engine():
    """In-memory SQLite с foreign_keys=ON — как на живом сервере."""
    engine = create_engine("sqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def _fk(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


@pytest.fixture()
def db():
    engine = make_engine()
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    with Session() as session:
        yield session
