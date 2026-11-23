# 🐔 Vibe Chicken — учёт птицефермы

Личное приложение для учёта производства на маленькой ферме:
яйценоскость, поголовье, корма, финансы и отчёты.

**Стек:** FastAPI + SQLAlchemy + SQLite · React + TypeScript + Vite + Tailwind · Docker для прода.

## Структура

```
backend/    FastAPI-приложение (Python 3.12, uv)
frontend/   React SPA (Vite, Tailwind, TypeScript)
deploy/     Docker и конфиги для VPS (появится позже)
```

## Запуск в разработке

**Бэкенд** (порт 8000, Swagger: http://localhost:8000/docs):

```bash
cd backend
uv sync                        # создать venv и поставить зависимости
uv run alembic upgrade head    # создать/обновить схему БД
uv run python -m uvicorn app.main:app --reload
```

**Фронтенд** (порт 5173, проксирует /api на бэкенд):

```bash
cd frontend
npm install
npm run dev
```

Открыть http://localhost:5173 — логин/пароль по умолчанию `admin` / `admin`.

⚠️ Пароль администратора задаётся **до первого запуска** через `backend/.env`
(см. `.env.example`), потом создаётся пользователь и env больше не влияет.
Смена пароля через UI появится позже; пока можно удалить `backend/data/app.db`
и запустить заново с новым паролем.

## Конфигурация

Все переменные с префиксом `CHICKEN_` — см. `backend/.env.example`.

## Полезное

- Миграции: `cd backend && uv run alembic revision --autogenerate -m "..."`, затем `uv run alembic upgrade head`
- Бэкап данных: скопировать файл `backend/data/app.db` (в проде — volume Docker)
