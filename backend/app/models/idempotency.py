"""Ключи идемпотентности (docs/concept.md §4.7, защита от дублей операций).

Мидлварь сохраняет ответ на не-GET запрос с заголовком Idempotency-Key:
повтор того же запроса (потеря связи, ретрай клиента) возвращает сохранённый
ответ, а не выполняет операцию заново.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, String, Text, delete as sa_delete
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

IDEMPOTENCY_TTL_DAYS = 7


class IdempotencyKey(Base):
    """Сохранённый ответ на запрос с ключом идемпотентности."""

    __tablename__ = "idempotency_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(64), unique=True)
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(500))
    status_code: Mapped[int]
    response_body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    @classmethod
    def prune(cls, db) -> None:
        """Удалить ключи старше TTL (вызывается при каждой записи, дёшево)."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=IDEMPOTENCY_TTL_DAYS)
        db.execute(sa_delete(cls).where(cls.created_at < cutoff))
