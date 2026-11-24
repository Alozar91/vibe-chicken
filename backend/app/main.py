"""Точка входа FastAPI-приложения."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import ensure_secret_key, settings
from app.core.db import SessionLocal
from app.core.idempotency import IdempotencyMiddleware
from app.core.security import hash_password
from app.models.user import User
from app.routers import auth, broiler, dictionaries, feed, health, users
from app.routers import geocode as geocode_router
from app.routers import settings as settings_router
from app.routers import money as money_router
from app.routers import backup as backup_router
from app.routers import layers as layers_router
from app.routers import orders as orders_router
from app.routers import reports as reports_router
from app.routers import routes as routes_router
from app.services import backup as backup_svc


@asynccontextmanager
async def lifespan(_: FastAPI):
    """При первом запуске: restore БД из S3 (если том непостоянный), создание
    администратора, ночной бэкап-шедулер."""
    # Платформы без постоянных томов (App Platform): поднять БД из последнего
    # S3-бэкапа до миграций. На VPS с volume — пассивно (БД уже на месте).
    from app.services import s3_backup as s3_svc

    db_path = backup_svc.db_file_path(settings.db_url)
    if db_path is not None:
        restored = s3_svc.S3BackupSync().restore_if_needed(db_path)
        if restored:
            print(f"[s3] база восстановлена из бэкапа {restored}", flush=True)
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
    backup_svc.start_backup_scheduler(settings.db_url)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# идемпотентность до CORS/сессий (внутри них): replay проходит через CORS-заголовки
app.add_middleware(IdempotencyMiddleware)
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
app.include_router(users.router)
app.include_router(geocode_router.router)
app.include_router(dictionaries.router)
app.include_router(feed.router)
app.include_router(broiler.router)
app.include_router(settings_router.router)
app.include_router(money_router.router)
app.include_router(backup_router.router)
app.include_router(layers_router.router)
app.include_router(layers_router.sales_router)
app.include_router(reports_router.router)
app.include_router(orders_router.router)
app.include_router(routes_router.router)
