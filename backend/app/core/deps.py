"""Общие зависимости FastAPI."""

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Возвращает авторизованного пользователя или 401.

    Отключённый (is_active=false) пользователь теряет доступ немедленно,
    даже если сессия ещё жива.
    """
    user_id = request.session.get("user_id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Не авторизован")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Не авторизован")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Только администратор (владелец, concept §6)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Только для администратора")
    return user
