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
    # цена яйца по умолчанию; редактируется в карточке «Цены продукции» (Настройки),
    # из общего списка настроек скрыта (hidden), читается через /api/dictionaries/prices
    "egg_price_per_ten": {
        "default": "",
        "label": "Цена яйца по умолчанию, ₽/десяток",
        "hint": "Подставляется кнопкой «Цена из справочника» в формах продаж яйца",
        "hidden": True,
    },
    # адрес и координаты хозяйства — стартовая точка маршрутов (§4.8);
    # редактируются в карточке «Адрес хозяйства», в общем списке скрыты
    "farm_address": {
        "default": "",
        "label": "Адрес хозяйства",
        "hint": "Стартовая точка маршрутов доставки",
        "hidden": True,
    },
    "farm_lat": {
        "default": "",
        "label": "Широта хозяйства",
        "hint": "Определяется по адресу или вводится вручную",
        "hidden": True,
    },
    "farm_lon": {
        "default": "",
        "label": "Долгота хозяйства",
        "hint": "Определяется по адресу или вводится вручную",
        "hidden": True,
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


def _normalize_number(value: str) -> str:
    """Принимает запятую как десятичный разделитель («0,8» → «0.8»)."""
    return value.strip().replace(",", ".")


def get_float(db: Session, key: str) -> float:
    return float(_normalize_number(get_value(db, key)))


def set_value(db: Session, key: str, value: str) -> None:
    if key not in SETTING_DEFS:
        raise KeyError(key)
    value = _normalize_number(value)
    # валидация числа для числовых настроек
    if key.startswith("output_ratio"):
        try:
            v = float(value)
        except ValueError:
            raise ValueError("Введите число, например 0.7 (можно с запятой: 0,7)")
        if not (0 < v <= 1):
            raise ValueError("Коэффициент должен быть от 0 до 1 (например 0.7)")
    if key == "egg_price_per_ten" and value != "":
        try:
            v = float(value)
        except ValueError:
            raise ValueError("Введите цену числом, например 60 или 60,5")
        if v < 0:
            raise ValueError("Цена не может быть отрицательной")
    row = db.scalar(select(AppSetting).where(AppSetting.key == key))
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value
    db.commit()


def describe(db: Session, key: str) -> dict:
    """Описание одной настройки с текущим значением (для UI и ответов API)."""
    if key not in SETTING_DEFS:
        raise KeyError(key)
    meta = SETTING_DEFS[key]
    row = db.scalar(select(AppSetting).where(AppSetting.key == key))
    return {
        "key": key,
        "value": row.value if row else meta["default"],
        "default": meta["default"],
        "label": meta["label"],
        "hint": meta["hint"],
    }


def list_all(db: Session) -> list[dict]:
    """Видимые настройки с текущими значениями (для UI); скрытые не показываем."""
    result = []
    for key, meta in SETTING_DEFS.items():
        if meta.get("hidden"):
            continue
        result.append(describe(db, key))
    return result
