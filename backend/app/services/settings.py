"""Настройки системы: чтение/запись key-value с дефолтами.

Хранятся в БД (app_settings), редактируются владельцем в UI.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.settings import AppSetting

# Известные настройки с значениями по умолчанию и описаниями (русский текст для UI)
SETTING_DEFS: dict[str, dict] = {
    "output_ratio_tushka": {
        "default": "0.7",
        "label": "Коэффициент выхода тушки от живого веса",
        "hint": "Живой вес ≈ вес продукции / коэффициент. 0.7 = тушка примерно 70% живого веса",
    },
}


def get_value(db: Session, key: str) -> str:
    """Значение настройки; если нет в БД — дефолт. Неизвестный ключ — KeyError."""
    if key not in SETTING_DEFS:
        raise KeyError(key)
    row = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if row is None:
        return SETTING_DEFS[key]["default"]
    return row.value


def get_float(db: Session, key: str) -> float:
    return float(get_value(db, key))


def set_value(db: Session, key: str, value: str) -> None:
    if key not in SETTING_DEFS:
        raise KeyError(key)
    # валидация числа для числовых настроек
    if key.startswith("output_ratio"):
        v = float(value)
        if not (0 < v <= 1):
            raise ValueError("Коэффициент должен быть от 0 до 1 (например 0.7)")
    row = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value
    db.commit()


def list_all(db: Session) -> list[dict]:
    """Все известные настройки с текущими значениями (для UI)."""
    result = []
    for key, meta in SETTING_DEFS.items():
        row = db.scalar(select(AppSetting).where(AppSetting.key == key))
        result.append({
            "key": key,
            "value": row.value if row else meta["default"],
            "default": meta["default"],
            "label": meta["label"],
            "hint": meta["hint"],
        })
    return result
