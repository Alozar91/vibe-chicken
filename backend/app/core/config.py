"""Конфигурация приложения.

Все переменные окружения читаются с префиксом CHICKEN_
(например, CHICKEN_ADMIN_PASSWORD) из окружения или файла backend/.env.
"""

import secrets
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/
DATA_DIR = BASE_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_prefix="CHICKEN_",
        extra="ignore",
    )

    app_name: str = "Vibe Chicken"

    # SQLite по умолчанию; при необходимости меняется одной строкой
    db_url: str = f"sqlite:///{DATA_DIR / 'app.db'}"

    # Ключ для подписи session-cookie. Если пуст — генерируется один раз
    # и сохраняется в data/secret.key, чтобы сессии переживали рестарт.
    secret_key: str = ""

    # Администратор создаётся при первом запуске, если в БД нет пользователей
    admin_username: str = "admin"
    admin_password: str = "admin"

    session_max_age: int = 60 * 60 * 24 * 30  # 30 дней
    session_https_only: bool = False  # включить за nginx с SSL в проде

    cors_origins: list[str] = ["http://localhost:5173"]

    # S3-синхронизация бэкапов (для платформ без постоянных томов, например
    # Timeweb App Platform). Все 4 переменные заданы — включена; иначе пассивна.
    s3_endpoint_url: str = ""
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_region: str = "us-east-1"

    # Сервер матрицы маршрутов (OSRM). Дефолт — публичный демо-сервер;
    # можно поднять свой и поменять одной строкой в .env
    osrm_url: str = "https://router.project-osrm.org"


settings = Settings()


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def ensure_secret_key() -> str:
    """Возвращает secret_key из настроек или персистентный автосгенерированный."""
    if settings.secret_key:
        return settings.secret_key
    ensure_data_dir()
    key_file = DATA_DIR / "secret.key"
    if key_file.exists():
        return key_file.read_text().strip()
    key = secrets.token_hex(32)
    key_file.write_text(key)
    return key
