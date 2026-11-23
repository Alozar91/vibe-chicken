from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import LoginIn, UserOut
from app.schemas.users import PasswordChangeIn
from app.services import users as users_svc

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)) -> User:
    user = db.scalar(select(User).where(User.username == data.username))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Пользователь отключён")
    request.session["user_id"] = user.id
    return user


@router.post("/logout")
def logout(request: Request) -> dict[str, bool]:
    request.session.clear()
    return {"ok": True}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/change-password", status_code=204)
def change_password(
    data: PasswordChangeIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Смена собственного пароля (старый обязателен)."""
    try:
        users_svc.change_password(db, user, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None
