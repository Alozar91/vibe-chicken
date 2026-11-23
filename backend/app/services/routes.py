"""Бизнес-логика маршрутов доставки (§4.8).

preview(): автопорядок объезда для выбранных заказов (стопы = покупатели,
заказы одного покупателя схлопываются; без координат — отдельно с пометкой).
CRUD сохранённых маршрутов: порядок остановок сохраняется «как есть» —
ручная правка пользователя главнее авторасчёта.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.dictionaries import Buyer
from app.models.orders import Order, OrderItem
from app.models.routes import DeliveryRoute, RouteStop, RouteStopOrder
from app.models.settings import AppSetting
from app.schemas.routes import (
    PreviewOut,
    PreviewStop,
    RouteDetailOut,
    RouteIn,
    RouteOut,
    StopIn,
    StopOut,
)
from app.services import routing

MAX_STOPS = 12


# --- точка фермы из настроек ---


def farm_point(db: Session) -> tuple[str, float, float] | None:
    """(адрес, lat, lon) хозяйства; None — координаты не заданы."""
    rows = db.scalars(select(AppSetting).where(AppSetting.key.in_(
        ["farm_address", "farm_lat", "farm_lon"]
    ))).all()
    vals = {s.key: s.value for s in rows}
    try:
        lat = float(str(vals.get("farm_lat", "")).replace(",", "."))
        lon = float(str(vals.get("farm_lon", "")).replace(",", "."))
    except ValueError:
        return None
    return vals.get("farm_address", "") or "Хозяйство", lat, lon


def _order_total(order: Order) -> float:
    total = 0.0
    for item in order.items:
        if item.price_per_unit is not None:
            total += float(item.qty) * float(item.price_per_unit)
    return total


def _orders_total_map(db: Session, order_ids: list[int]) -> dict[int, float]:
    rows = db.execute(
        select(OrderItem.order_id, OrderItem.qty, OrderItem.price_per_unit)
        .where(OrderItem.order_id.in_(order_ids))
    ).all()
    totals: dict[int, float] = {}
    for order_id, qty, price in rows:
        if price is not None:
            totals[order_id] = totals.get(order_id, 0.0) + float(qty) * float(price)
    return totals


# --- предпросмотр маршрута ---


def preview(db: Session, order_ids: list[int]) -> PreviewOut:
    if not order_ids:
        raise ValueError("Выберите хотя бы один заказ")
    orders = list(db.scalars(select(Order).where(Order.id.in_(order_ids))).all())
    found = {o.id for o in orders}
    missing = [i for i in order_ids if i not in found]
    if missing:
        raise KeyError(f"Запись не найдена (id={missing[0]})")

    farm = farm_point(db)
    if farm is None:
        raise ValueError("Задайте адрес и координаты хозяйства в настройках")

    # заказы без координат у покупателя — не участвуют в оптимизации
    no_coords: list[str] = []
    groups: dict[int, list[Order]] = {}  # buyer_id → заказы
    for o in orders:
        b = db.get(Buyer, o.buyer_id)
        if b is None or b.lat is None or b.lon is None:
            no_coords.append(b.name if b else f"заказ №{o.id}")
            continue
        groups.setdefault(o.buyer_id, []).append(o)

    totals = _orders_total_map(db, [o.id for o in orders])

    def make_stop(buyer_id: int, orders_: list[Order]) -> PreviewStop:
        b = db.get(Buyer, buyer_id)
        assert b is not None and b.lat is not None and b.lon is not None
        return PreviewStop(
            buyer_id=buyer_id,
            label=b.name,
            lat=b.lat,
            lon=b.lon,
            note=None,
            order_ids=[o.id for o in orders_],
        )

    stops = [make_stop(bid, os_) for bid, os_ in groups.items()]
    ordered = stops
    legs: list[float] = []
    total_seconds = 0.0
    total_meters = 0.0
    approximate = False

    if len(stops) > MAX_STOPS:
        raise ValueError(f"Не больше {MAX_STOPS} остановок в поездке")
    if stops:
        points = [(farm[1], farm[2])] + [(s.lat, s.lon) for s in stops]
        matrix = routing.fetch_osrm_table(points, base_url=_osrm_url())
        approx = matrix.approximate
        idx = routing.order_stops(matrix.durations)  # индексы 1..n
        ordered = [stops[i - 1] for i in idx]
        path = [0] + idx
        legs = [
            matrix.durations[path[k]][path[k + 1]]
            for k in range(len(path) - 1)
        ]
        total_seconds = sum(legs)
        total_meters = sum(matrix.distances[path[k]][path[k + 1]] for k in range(len(path) - 1))
        approximate = approx

    return PreviewOut(
        farm_label=farm[0],
        farm_lat=farm[1],
        farm_lon=farm[2],
        approximate=approximate,
        total_seconds=round(total_seconds),
        total_meters=round(total_meters),
        legs=[round(l) for l in legs],
        no_coords_buyers=no_coords,
        stops=ordered,
    )


def _osrm_url() -> str:
    from app.core.config import settings

    return settings.osrm_url


# --- CRUD сохранённых маршрутов ---


def _check_stop_count(stops: list[StopIn]) -> None:
    if len(stops) > MAX_STOPS:
        raise ValueError(f"Не больше {MAX_STOPS} остановок в поездке")


def _validate_refs(db: Session, stops: list[StopIn]) -> None:
    buyer_ids = {s.buyer_id for s in stops if s.buyer_id is not None}
    for bid in buyer_ids:
        if db.get(Buyer, bid) is None:
            raise ValueError(f"Покупатель не найден (id={bid})")
    order_ids = {oid for s in stops for oid in s.order_ids}
    if order_ids:
        found = {
            i for (i,) in db.execute(select(Order.id).where(Order.id.in_(order_ids))).all()
        }
        missing = order_ids - found
        if missing:
            raise ValueError(f"Заказ не найден (id={min(missing)})")


def list_routes(db: Session) -> list[RouteOut]:
    routes = list(db.scalars(select(DeliveryRoute).order_by(DeliveryRoute.id.desc())).all())
    return [_route_out(r) for r in routes]


def _route_out(r: DeliveryRoute) -> RouteOut:
    return RouteOut(
        id=r.id,
        name=r.name,
        created_at=r.created_at,
        stops=[
            StopOut(
                id=s.id,
                position=s.position,
                buyer_id=s.buyer_id,
                label=s.label,
                lat=s.lat,
                lon=s.lon,
                note=s.note,
                order_ids=[o.order_id for o in s.orders],
            )
            for s in sorted(r.stops, key=lambda x: x.position)
        ],
    )


def _write_stops(db: Session, route: DeliveryRoute, stops: list[StopIn]) -> None:
    route.stops = []
    db.flush()
    for pos, s in enumerate(stops):
        stop = RouteStop(
            route_id=route.id,
            position=pos,
            buyer_id=s.buyer_id,
            label=s.label,
            lat=s.lat,
            lon=s.lon,
            note=s.note,
        )
        db.add(stop)
        db.flush()
        for oid in s.order_ids:
            db.add(RouteStopOrder(stop_id=stop.id, order_id=oid))


def create_route(db: Session, data: RouteIn, *, actor_id: int | None = None) -> RouteOut:
    _check_stop_count(data.stops)
    _validate_refs(db, data.stops)
    name = (data.name or "").strip() or f"Поездка {date.today().strftime('%d.%m')}"
    route = DeliveryRoute(
        name=name,
        created_at=datetime.now(timezone.utc),
        created_by=actor_id,
    )
    db.add(route)
    db.flush()
    _write_stops(db, route, data.stops)
    db.commit()
    db.refresh(route)
    return _route_out(route)


def _get_route(db: Session, route_id: int) -> DeliveryRoute:
    r = db.get(DeliveryRoute, route_id)
    if r is None:
        raise KeyError("Запись не найдена")
    return r


def update_route(db: Session, route_id: int, data: RouteIn) -> RouteOut:
    route = _get_route(db, route_id)
    _check_stop_count(data.stops)
    _validate_refs(db, data.stops)
    route.name = (data.name or "").strip() or route.name
    _write_stops(db, route, data.stops)
    db.commit()
    db.refresh(route)
    return _route_out(route)


def delete_route(db: Session, route_id: int) -> None:
    route = _get_route(db, route_id)
    db.delete(route)
    db.commit()


def route_detail(db: Session, route_id: int) -> RouteDetailOut:
    """Маршрут + времена переездов (считаем на лету по матрице OSRM)."""
    route = _get_route(db, route_id)
    base = _route_out(route)
    stops = base.stops
    farm = farm_point(db)
    approximate = False
    legs: list[float] = []
    total_m = 0.0

    if stops:
        pts = [(s.lat, s.lon) for s in stops]
        if farm is not None:
            pts = [(farm[1], farm[2])] + pts
        matrix = routing.fetch_osrm_table(pts, base_url=_osrm_url())
        approximate = matrix.approximate
        offset = 1 if farm is not None else 0
        path = list(range(len(pts)))
        legs = [matrix.durations[path[k]][path[k + 1]] for k in range(len(path) - 1)]
        total_m = sum(matrix.distances[path[k]][path[k + 1]] for k in range(len(path) - 1))

    return RouteDetailOut(
        id=base.id,
        name=base.name,
        created_at=base.created_at,
        stops=stops,
        approximate=approximate,
        total_seconds=round(sum(legs)),
        total_meters=round(total_m),
        legs=[round(l) for l in legs],
    )
