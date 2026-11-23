"""Расчёт маршрута доставки (§4.8): матрица времён + оптимальный порядок.

Две чистые части:
1. Матрица времени/расстояния между точками — OSRM /table (OSM-данные,
   публичный сервер без ключа; адрес настраивается CHICKEN_OSRM_URL).
   Если OSRM недоступен или не нашёл дорогу — fallback на расстояние
   по прямой (гаверсинус) с пометкой «приблизительно».
2. Оптимальный порядок объезда — точное решение задачи коммивояжёра
   для открытого пути (старт на ферме, конец у последней остановки)
   алгоритмом Хелда–Карпа. Для 10 остановок это ~100 тыс. состояний —
   доли секунды, эвристики не нужны.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

import httpx

# Штраф за «недостижимую» пару точек в матрице OSRM (None): 6 часов пути
UNREACHABLE_PENALTY_S = 6 * 3600

# Скорость по сельским дорогам для оценки по прямой, км/ч
STRAIGHT_SPEED_KMH = 40.0


@dataclass
class Matrix:
    durations: list[list[float]]  # секунды
    distances: list[list[float]]  # метры (могут быть 0 в fallback по времени)
    approximate: bool  # True — считали по прямой, OSRM не ответили


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Расстояние по прямой между двумя точками, км."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def straight_matrix(points: Sequence[tuple[float, float]]) -> Matrix:
    """Fallback-матрица: время = расстояние по прямой / средняя скорость."""
    n = len(points)
    durations = [[0.0] * n for _ in range(n)]
    distances = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            km = haversine_km(points[i][0], points[i][1], points[j][0], points[j][1])
            distances[i][j] = km * 1000
            durations[i][j] = km / STRAIGHT_SPEED_KMH * 3600
    return Matrix(durations=durations, distances=distances, approximate=True)


def fetch_osrm_table(
    points: Sequence[tuple[float, float]],
    *,
    base_url: str,
    fetch: object | None = None,
) -> Matrix:
    """Матрица времён/расстояний через OSRM (координаты в формате lon,lat).

    fetch — инъекция HTTP для тестов: (url) -> dict с durations/distances.
    """
    coords = ";".join(f"{lon:.6f},{lat:.6f}" for lat, lon in points)
    url = f"{base_url.rstrip('/')}/table/v1/driving/{coords}?annotations=duration,distance"
    try:
        if fetch is not None:
            data = fetch(url)  # type: ignore[operator]
        else:
            resp = httpx.get(url, timeout=15, follow_redirects=True)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return straight_matrix(points)
    durations = data.get("durations")
    if not isinstance(durations, list) or len(durations) != len(points):
        return straight_matrix(points)
    n = len(points)
    clean: list[list[float]] = []
    dists: list[list[float]] = []
    raw_dists = data.get("distances") if isinstance(data.get("distances"), list) else None
    for i in range(n):
        row: list[float] = []
        drow: list[float] = []
        for j in range(n):
            d = durations[i][j] if i != j else 0.0
            if d is None:
                return straight_matrix(points)  # нет дороги — считаем по прямой
            row.append(float(d))
            if raw_dists is not None and raw_dists[i][j] is not None and i != j:
                drow.append(float(raw_dists[i][j]))
            else:
                drow.append(0.0 if i == j else row[-1] * STRAIGHT_SPEED_KMH * 1000 / 3600)
        clean.append(row)
        dists.append(drow)
    return Matrix(durations=clean, distances=dists, approximate=False)


def order_stops(durations: list[list[float]]) -> list[int]:
    """Оптимальный порядок остановок для открытого пути, старт — точка 0 (ферма).

    Вход: квадратная матрица времён; индекс 0 — ферма, 1..n-1 — остановки.
    Выход: порядок остановок в терминах входных индексов (без фермы).
    Хелд–Карп: dp[mask][last] — минимальное время пути ферма→…→last,
    покрывающего множество mask. Восстановление пути по argmin.
    """
    n = len(durations) - 1  # число остановок
    if n <= 0:
        return []
    if n > 15:
        raise ValueError("Слишком много остановок — в поездке не больше 15 точек")

    full = (1 << n) - 1
    inf = float("inf")
    dp = [[inf] * n for _ in range(1 << n)]
    parent: list[list[int]] = [[-1] * n for _ in range(1 << n)]

    for i in range(n):
        dp[1 << i][i] = durations[0][i + 1]

    for mask in range(1 << n):
        for last in range(n):
            if dp[mask][last] == inf or not (mask & (1 << last)):
                continue
            for nxt in range(n):
                if mask & (1 << nxt):
                    continue
                cost = dp[mask][last] + durations[last + 1][nxt + 1]
                new_mask = mask | (1 << nxt)
                if cost < dp[new_mask][nxt]:
                    dp[new_mask][nxt] = cost
                    parent[new_mask][nxt] = last

    best_last = min(range(n), key=lambda i: dp[full][i])
    order: list[int] = []
    mask, last = full, best_last
    while last != -1:
        order.append(last + 1)
        p = parent[mask][last]
        mask ^= 1 << last
        last = p
    order.reverse()
    return order
