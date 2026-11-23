"""Тесты маршрутов (§4.8): математика порядка + CRUD + preview (мокаем OSRM)."""

from datetime import date

import pytest

from app.schemas.dictionaries import BuyerIn
from app.schemas.orders import OrderIn, OrderItemIn
from app.schemas.routes import RouteIn, StopIn
from app.services import dictionaries as dict_svc
from app.services import orders as orders_svc
from app.services import routes as routes_svc
from app.services import routing
from app.services import settings as settings_svc

D = date(2025, 6, 1)


# --- математика: точный порядок объезда ---


def test_order_stops_finds_optimal_path():
    # Ферма(0) — A(1) — B(2) — C(3); оптимально ферма→B→A→C:
    durations = [
        [0, 10, 5, 20],  # от фермы
        [10, 0, 8, 6],
        [5, 8, 0, 7],
        [20, 6, 7, 0],
    ]
    assert routing.order_stops(durations) == [2, 3, 1]


def test_order_stops_tiny_cases():
    assert routing.order_stops([[0]]) == []
    assert routing.order_stops([[0, 3], [4, 0]]) == [1]


def test_straight_matrix_symmetry():
    m = routing.straight_matrix([(54.0, 45.0), (54.1, 45.0), (54.0, 45.1)])
    assert m.approximate
    assert m.durations[0][1] == m.durations[1][0]
    assert m.durations[0][1] > 0


def test_fetch_osrm_fallback_on_network_error():
    def broken(url):
        raise RuntimeError("no network")

    m = routing.fetch_osrm_table([(54.0, 45.0), (54.1, 45.0)], base_url="http://x", fetch=broken)
    assert m.approximate


def test_fetch_osrm_parses_table():
    def ok(url):
        return {
            "durations": [[0, 100.0, 200.0], [100.0, 0, 50.0], [200.0, 50.0, 0]],
            "distances": [[0, 1000.0, 2000.0], [1000.0, 0, 500.0], [2000.0, 500.0, 0]],
        }

    m = routing.fetch_osrm_table(
        [(54.0, 45.0), (54.1, 45.0), (54.2, 45.0)], base_url="http://x", fetch=ok
    )
    assert not m.approximate
    assert m.durations[0][2] == 200.0
    assert m.distances[1][2] == 500.0


# --- фикстуры данных ---


@pytest.fixture()
def buyers_orders(db):
    """Ферма с координатами + 2 покупателя + 3 заказа (у второго два заказа)."""
    settings_svc.set_value(db, "farm_lat", "54.0")
    settings_svc.set_value(db, "farm_lon", "45.0")
    settings_svc.set_value(db, "farm_address", "с. Ивановка")
    anna = dict_svc.create_buyer(db, BuyerIn(name="Анна", lat=54.05, lon=45.02))
    boris = dict_svc.create_buyer(db, BuyerIn(name="Борис", lat=54.12, lon=44.95))
    dict_svc.create_buyer(db, BuyerIn(name="Вера"))  # без координат
    o1 = orders_svc.create_order(db, OrderIn(date=D, buyer_id=anna.id, items=[OrderItemIn(kind="egg", qty=10)]))
    o2 = orders_svc.create_order(db, OrderIn(date=D, buyer_id=boris.id, items=[OrderItemIn(kind="egg", qty=5)]))
    o3 = orders_svc.create_order(db, OrderIn(date=D, buyer_id=boris.id, items=[OrderItemIn(kind="egg", qty=7)]))
    vera = dict_svc.list_buyers(db)[2]
    o4 = orders_svc.create_order(db, OrderIn(date=D, buyer_id=vera.id, items=[OrderItemIn(kind="egg", qty=3)]))
    return {"anna": anna, "boris": boris, "vera": vera, "o1": o1, "o2": o2, "o3": o3, "o4": o4}


def test_preview_merges_orders_by_buyer(db, buyers_orders, monkeypatch):
    """Заказы одного покупателя → одна остановка; Vera без координат — в no_coords."""
    data = buyers_orders

    def fake_matrix(points, *, base_url, fetch=None):
        return routing.straight_matrix(points)

    monkeypatch.setattr(routing, "fetch_osrm_table", fake_matrix)
    out = routes_svc.preview(db, [data["o1"].id, data["o2"].id, data["o3"].id, data["o4"].id])
    assert len(out.stops) == 2
    boris_stop = next(s for s in out.stops if s.buyer_id == data["boris"].id)
    assert sorted(boris_stop.order_ids) == sorted([data["o2"].id, data["o3"].id])
    assert out.no_coords_buyers == ["Вера"]
    assert out.farm_lat == 54.0
    assert len(out.legs) == len(out.stops)  # ферма→…→последняя


def test_preview_requires_farm_coords(db, buyers_orders):
    settings_svc.set_value(db, "farm_lat", "")
    with pytest.raises(ValueError, match="координаты хозяйства"):
        routes_svc.preview(db, [buyers_orders["o1"].id])


def test_preview_missing_order(db, buyers_orders):
    with pytest.raises(KeyError):
        routes_svc.preview(db, [999])


# --- CRUD ---


def test_route_crud_roundtrip(db, buyers_orders, monkeypatch):
    data = buyers_orders
    route = routes_svc.create_route(
        db,
        RouteIn(
            name=None,
            stops=[
                StopIn(buyer_id=data["boris"].id, label="Борис", lat=54.12, lon=44.95,
                       order_ids=[data["o2"].id]),
                StopIn(buyer_id=data["anna"].id, label="Анна", lat=54.05, lon=45.02,
                       order_ids=[data["o1"].id]),
            ],
        ),
    )
    # имя по умолчанию с датой
    assert route.name.startswith("Поездка ")
    assert [s.position for s in route.stops] == [0, 1]

    # деталь с временами — сеть не трогаем, подменяем матрицу
    monkeypatch.setattr(routing, "fetch_osrm_table",
                        lambda pts, *, base_url, fetch=None: routing.straight_matrix(pts))
    detail = routes_svc.route_detail(db, route.id)
    assert detail.total_seconds >= 0
    assert detail.total_meters > 0  # по прямой между точками есть расстояние

    # правка: меняем порядок и имя
    upd = routes_svc.update_route(
        db, route.id,
        RouteIn(name="Развоз субботы", stops=route.stops and [
            StopIn(buyer_id=data["anna"].id, label="Анна", lat=54.05, lon=45.02, order_ids=[data["o1"].id]),
            StopIn(buyer_id=data["boris"].id, label="Борис", lat=54.12, lon=44.95, order_ids=[data["o2"].id]),
        ]),
    )
    assert upd.name == "Развоз субботы"
    assert [s.label for s in upd.stops] == ["Анна", "Борис"]

    routes_svc.delete_route(db, route.id)
    assert routes_svc.list_routes(db) == []


def test_route_max_stops():
    """Схема отсекает 13-ю остановку (лимит 12) ещё до сервиса."""
    from pydantic import ValidationError

    stops = [StopIn(buyer_id=None, label=f"Т{i}", lat=54 + i * 0.01, lon=45.0) for i in range(13)]
    with pytest.raises(ValidationError):
        RouteIn(stops=stops)
