# Образ бэкенда Vibe Chicken: uv + Python 3.12 + uvicorn.
# SQLite-данные и бэкапы живут в /app/data (volume в docker-compose.yml).
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Сначала только манифесты — слой с зависимостями кэшируется
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

# Перед стартом накатываем миграции (идемпотентно), затем uvicorn.
# Один воркер: SQLite WAL и ночной бэкап-шедулер рассчитаны на один процесс.
CMD ["sh", "-c", "uv run --no-sync alembic upgrade head && uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8000"]
