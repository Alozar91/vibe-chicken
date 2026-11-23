"""Сохранённые маршруты доставки (§4.8): план объезда покупателей.

Маршрут — чистая логистика: денег не порождает, продажи оформляются
в заказах как раньше. Остановка = покупатель (несколько заказов одного
покупателя схлопываются в одну остановку) или свободная точка без
покупателя («заехать на почту»). Координаты хранятся снапшотом:
последующая правка покупателя в справочнике не меняет сохранённые поездки.
"""

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class DeliveryRoute(Base):
    """Поездка: имя + упорядоченные остановки от фермы."""

    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), default=None)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)

    stops: Mapped[list["RouteStop"]] = relationship(
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RouteStop.position",
    )


class RouteStop(Base):
    """Остановка маршрута: точка на карте + список заказов."""

    __tablename__ = "route_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)  # 0,1,2… — порядок объезда
    buyer_id: Mapped[int | None] = mapped_column(ForeignKey("buyers.id"), default=None)
    label: Mapped[str] = mapped_column(String(200))  # человекочитаемое название точки
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String(500), default=None)

    route: Mapped[DeliveryRoute] = relationship(back_populates="stops")
    orders: Mapped[list["RouteStopOrder"]] = relationship(
        back_populates="stop", cascade="all, delete-orphan"
    )


class RouteStopOrder(Base):
    """Связь остановки с заказом (что везём в этой точке)."""

    __tablename__ = "route_stop_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    stop_id: Mapped[int] = mapped_column(ForeignKey("route_stops.id", ondelete="CASCADE"))
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))

    stop: Mapped[RouteStop] = relationship(back_populates="orders")
