"""Тесты геокодирования (мокаем HTTP — сеть в тестах не дёргаем)."""

import pytest

from app.services import geocode


def _fetch_ok(url: str, user_agent: str) -> str:
    from urllib.parse import unquote

    assert "nominatim" in url
    assert "Садовая" in unquote(url)
    return '[{"lat": "54.1839", "lon": "45.1849", "display_name": "село Ивановка, Мордовия, Россия"}]'


def test_geocode_parses_result():
    point = geocode.geocode("ул. Садовая, с. Ивановка", fetch=_fetch_ok)
    assert (point.lat, point.lon) == (54.1839, 45.1849)
    assert "Ивановка" in point.label


def test_geocode_not_found():
    with pytest.raises(ValueError, match="не найден"):
        geocode.geocode("деревня Гадюкино", fetch=lambda u, ua: "[]")


def test_geocode_empty_query():
    with pytest.raises(ValueError, match="Введите адрес"):
        geocode.geocode("   ")


def test_geocode_garbage_response():
    with pytest.raises(ValueError, match="непонятный ответ"):
        geocode.geocode("тест", fetch=lambda u, ua: "<html>error</html>")
