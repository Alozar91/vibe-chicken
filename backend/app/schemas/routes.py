"""Pydantic-схемы маршрутов доставки (§4.8)."""

from pydantic import BaseModel, ConfigDict, Field


class OrderBrief(BaseModel):
    """Заказ в остановке — для показа в списке точек."""

    id: int
    buyer_name: str = ""
    status: str = ""
    total: float = 0.0  # сумма заказа, ₽ (заполняется сервисом)


class StopIn(BaseModel):
    """Остановка при сохранении маршрута (порядок = как в списке)."""

    buyer_id: int | None = None
    label: str = Field(max_length=200)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    note: str | None = Field(default=None, max_length=500)
    order_ids: list[int] = []


class RouteIn(BaseModel):
    name: str | None = Field(default=None, max_length=200)  # None → «Поездка dd.mm»
    stops: list[StopIn] = Field(min_length=1, max_length=12)


class StopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    buyer_id: int | None
    label: str
    lat: float
    lon: float
    note: str | None
    order_ids: list[int] = []


class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: object = None
    stops: list[StopOut]


class RouteDetailOut(RouteOut):
    """Маршрут с пересчитанными временами переездов."""

    farm_label: str = ""
    farm_lat: float | None = None
    farm_lon: float | None = None
    approximate: bool = False
    total_seconds: float = 0.0
    total_meters: float = 0.0
    legs: list[float] = []  # секунды переезда между соседними точками


class PreviewStop(StopIn):
    pass


class PreviewOut(BaseModel):
    """Предпросмотр: автопорядок остановок + времена переездов."""

    farm_label: str = ""
    farm_lat: float | None = None
    farm_lon: float | None = None
    approximate: bool = False
    total_seconds: float = 0.0
    total_meters: float = 0.0
    legs: list[float] = []  # ферма→стоп1, стоп1→стоп2…, по выбранному порядку
    no_coords_buyers: list[str] = []  # покупатели выбранных заказов без координат
    stops: list[PreviewStop]
