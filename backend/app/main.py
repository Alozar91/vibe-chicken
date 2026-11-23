"""Точка входа FastAPI-приложения."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import ensure_secret_key, settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.routers import auth, broiler, dictionaries, feed, health
from app.routers import settings as settings_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    """При первом запуске создаёт администратора из настроек."""
    with SessionLocal() as db:
        has_users = db.scalar(select(User.id).limit(1)) is not None
        if not has_users:
            db.add(
                User(
                    username=settings.admin_username,
                    password_hash=hash_password(settings.admin_password),
                )
            )
            db.commit()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    SessionMiddleware,
    secret_key=ensure_secret_key(),
    max_age=settings.session_max_age,
    same_site="lax",
    https_only=settings.session_https_only,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(dictionaries.router)
app.include_router(feed.router)
app.include_router(broiler.router)
app.include_router(settings_router.router)
