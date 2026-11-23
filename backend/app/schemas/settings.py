"""Схемы настроек системы."""

from pydantic import BaseModel


class SettingOut(BaseModel):
    key: str
    value: str
    default: str
    label: str
    hint: str


class SettingUpdateIn(BaseModel):
    value: str
