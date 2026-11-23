"""Схемы пользователей (concept §6)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str  # admin | user
    is_active: bool
    created_at: datetime


class UserCreateIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=4, max_length=128)
    role: str = Field(default="user", pattern="^(admin|user)$")


class UserUpdateIn(BaseModel):
    """Частичное обновление: все поля необязательны."""

    username: str | None = Field(default=None, min_length=2, max_length=64)
    password: str | None = Field(default=None, min_length=4, max_length=128)
    role: str | None = Field(default=None, pattern="^(admin|user)$")
    is_active: bool | None = None


class PasswordChangeIn(BaseModel):
    """Смена пароля любым пользователем (себе)."""

    old_password: str
    new_password: str = Field(min_length=4, max_length=128)
