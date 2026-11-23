"""Pydantic-схемы справочников."""

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal


class PlaceIn(BaseModel):
    name: str = Field(max_length=100)
    kind: str = Field(pattern="^(broiler_module|lay_house)$")
    note: str | None = Field(default=None, max_length=500)


class PlaceOut(PlaceIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class FeedCategoryIn(BaseModel):
    name: str = Field(max_length=100)


class FeedCategoryOut(FeedCategoryIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class FeedBrandIn(BaseModel):
    name: str = Field(max_length=100)


class FeedBrandOut(FeedBrandIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


VENDOR_TYPES = ("chicks", "feed", "meds", "other")


class VendorIn(BaseModel):
    name: str = Field(max_length=150)
    note: str | None = Field(default=None, max_length=500)
    types: list[str] = Field(min_length=1)  # обязательные теги-типы

    model_config = ConfigDict(json_schema_extra={"example": {
        "name": "Птицефабрика №1", "note": None, "types": ["chicks", "feed"],
    }})


class VendorOut(VendorIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class BuyerIn(BaseModel):
    name: str = Field(max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=300)
    # Координаты для маршрутов; если одна задана — должна быть и вторая
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def _coords_pair(self):
        if (self.lat is None) != (self.lon is None):
            raise ValueError("Укажите обе координаты — широту и долготу")
        return self


class BuyerOut(BuyerIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ProductTypeIn(BaseModel):
    name: str = Field(max_length=100)
    unit: Literal["pieces", "kg"] = "kg"
    # цена продажи по умолчанию за единицу вида (₽/шт или ₽/кг по unit)
    sale_price: float | None = Field(default=None, ge=0)


class ProductTypeOut(ProductTypeIn):
    model_config = ConfigDict(from_attributes=True)

    id: int


class MoneyCategoryIn(BaseModel):
    name: str = Field(max_length=100)
    kind: str = Field(pattern="^(income|expense)$")
    is_general: bool = False


class MoneyCategoryOut(MoneyCategoryIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
