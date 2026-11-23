"""Геокодирование адресов через Nominatim (OSM).

Для маршрутов доставки (§4.8): переводим текстовый адрес в координаты.
Nominatim бесплатный и без ключа, но с правилами: не более 1 запроса в
секунду, обязателен User-Agent (https://operations.osmfoundation.org).
В сельской местности может не найти адрес — тогда пользователь вводит
координаты вручную (например, из Яндекс.Карт).

HTTP-клиент передаётся параметром (инъекция для тестов), по умолчанию —
httpx. Сервис не знает про HTTP-роутинг: ошибки домена — ValueError.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import NamedTuple

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "vibe-chicken/1.0 (family farm bookkeeping app)"

# Nominatim требует не чаще 1 запроса в секунду — держим интервал между вызовами
_MIN_INTERVAL = 1.1
_last_call = 0.0

Fetcher = Callable[[str, dict[str, str]], str]


class GeoPoint(NamedTuple):
    lat: float
    lon: float
    label: str  # как адрес понял геокодер (для подтверждения пользователем)


def _throttle() -> None:
    global _last_call
    wait = _MIN_INTERVAL - (time.monotonic() - _last_call)
    if wait > 0:
        time.sleep(wait)
    _last_call = time.monotonic()


def _default_fetch(url: str, user_agent: str) -> str:
    _throttle()
    resp = httpx.get(
        url,
        headers={"User-Agent": user_agent},
        timeout=10,
        follow_redirects=True,
    )
    resp.raise_for_status()
    return resp.text


def parse_nominatim(raw: str) -> GeoPoint | None:
    """Разбор ответа Nominatim (список результатов). None — ничего не нашлось."""
    import json

    try:
        results = json.loads(raw)
    except ValueError:
        raise ValueError("Геокодер вернул непонятный ответ") from None
    if not isinstance(results, list) or not results:
        return None
    first = results[0]
    try:
        return GeoPoint(
            lat=float(first["lat"]),
            lon=float(first["lon"]),
            label=first.get("display_name", ""),
        )
    except (KeyError, TypeError, ValueError):
        raise ValueError("Геокодер вернул результат без координат") from None


def geocode(query: str, *, fetch: Fetcher | None = None) -> GeoPoint:
    """Адрес → координаты. Пустой запрос или «не нашлось» — ValueError."""
    query = query.strip()
    if not query:
        raise ValueError("Введите адрес для поиска")
    from urllib.parse import urlencode

    url = f"{NOMINATIM_URL}?{urlencode({
        'q': query,
        'format': 'jsonv2',
        'limit': 1,
        'accept-language': 'ru',
    })}"
    raw = (fetch or _default_fetch)(url, USER_AGENT)
    point = parse_nominatim(raw)
    if point is None:
        raise ValueError(
            "Адрес не найден в OpenStreetMap. Уточните формулировку "
            "(село, район) или введите координаты вручную"
        )
    return point
