"""HTTP-слой управления пользователями; логика в services/users.py."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.users import UserCreateIn, UserOut, UserUpdateIn
from app.services import users as svc

router = APIRouter(
    prefix="/api/users", tags=["users"], dependencies=[Depends(get_current_user)]
)


def _handle(fn, *args, **kwargs):
    """Вызывает сервис; ValueError → 400, KeyError → 404 (по соглашению сервисов)."""
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        msg = str(e)
        status = 404 if msg.startswith("Запись не найдена") else 400
        raise HTTPException(status_code=status, detail=msg) from None


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return svc.list_users(db)


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    data: UserCreateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return _handle(svc.create_user, db, data)


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdateIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return _handle(svc.update_user, db, user_id, data, actor_id=admin.id)
