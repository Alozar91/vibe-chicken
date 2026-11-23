"""Управление пользователями (concept §6).

Только администратор (владелец) управляет списком: создание, смена паролей,
ролей, отключение. Отключённый не может войти, его записи сохранаются.
Свои пароли пользователи меняют сами (change_password).
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.users import PasswordChangeIn, UserCreateIn, UserUpdateIn


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.id)))


def _check_username_free(db: Session, username: str, exclude_id: int | None = None) -> None:
    stmt = select(User.id).where(func.lower(User.username) == username.lower())
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise ValueError(f"Пользователь «{username}» уже есть")


def _active_admins(db: Session, exclude_id: int | None = None) -> int:
    stmt = select(func.count(User.id)).where(User.role == "admin", User.is_active == True)  # noqa: E712
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return int(db.scalar(stmt) or 0)


def create_user(db: Session, data: UserCreateIn) -> User:
    _check_username_free(db, data.username)
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        role=data.role,
    )
    db.add(user)
    db.commit()
    return user


def update_user(db: Session, user_id: int, data: UserUpdateIn, actor_id: int) -> User:
    """Обновление профиля админом.

    Защиты: нельзя отключить самого себя; нельзя понизить в роли или
    отключить последнего активного администратора.
    """
    user = db.get(User, user_id)
    if user is None:
        raise ValueError("Пользователь не найден")

    if data.is_active is False and user_id == actor_id:
        raise ValueError("Нельзя отключить самого себя")

    new_role = data.role if data.role is not None else user.role
    new_active = data.is_active if data.is_active is not None else user.is_active
    loses_admin = user.role == "admin" and (new_role != "admin" or not new_active)
    if loses_admin and _active_admins(db, exclude_id=user.id) == 0:
        raise ValueError("Нельзя оставить хозяйство без активного администратора")

    if data.username is not None and data.username != user.username:
        _check_username_free(db, data.username, exclude_id=user.id)
        user.username = data.username
    if data.password is not None:
        user.password_hash = hash_password(data.password)
    user.role = new_role
    user.is_active = new_active
    db.commit()
    return user


def change_password(db: Session, user: User, data: PasswordChangeIn) -> None:
    """Пользователь меняет свой пароль (старый обязателен)."""
    if not verify_password(data.old_password, user.password_hash):
        raise ValueError("Старый пароль неверен")
    user.password_hash = hash_password(data.new_password)
    db.commit()
