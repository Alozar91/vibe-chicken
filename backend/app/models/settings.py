"""Настройки системы (key-value). См. docs/data-model.md, раздел настроек."""

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class AppSetting(Base):
    """Пара ключ-значение для настроек (коэффициенты, параметры расчётов)."""

    __tablename__ = "app_settings"
    __table_args__ = (UniqueConstraint("key", name="uq_app_settings_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(500))
