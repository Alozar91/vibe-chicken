"""Маршруты доставки (§4.8): предпросмотр и CRUD поездок."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.routes import PreviewOut, RouteDetailOut, RouteIn, RouteOut
from app.services import routes as svc

router = APIRouter(prefix="/api/routes", tags=["routes"], dependencies=[Depends(get_current_user)])


def _handle(fn, *args, **kwargs):
    """ValueError → 400, KeyError → 404 (соглашение роутеров)."""
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e).strip("'\"")) from None


@router.get("/preview", response_model=PreviewOut)
def preview_route(order_ids: str = Query(description="id заказов через запятую"), db: Session = Depends(get_db)):
    """Автопорядок объезда для выбранных заказов (ферма — старт)."""
    try:
        ids = [int(x) for x in order_ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="order_ids — числа через запятую") from None
    return _handle(svc.preview, db, ids)


@router.post("", response_model=RouteOut, status_code=201)
def create_route(data: RouteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _handle(svc.create_route, db, data, actor_id=user.id)


@router.get("", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db)):
    return svc.list_routes(db)


@router.get("/{route_id}", response_model=RouteDetailOut)
def get_route(route_id: int, db: Session = Depends(get_db)):
    return _handle(svc.route_detail, db, route_id)


@router.put("/{route_id}", response_model=RouteOut)
def update_route(route_id: int, data: RouteIn, db: Session = Depends(get_db)):
    return _handle(svc.update_route, db, route_id, data)


@router.delete("/{route_id}", status_code=204)
def delete_route(route_id: int, db: Session = Depends(get_db)):
    _handle(svc.delete_route, db, route_id)
