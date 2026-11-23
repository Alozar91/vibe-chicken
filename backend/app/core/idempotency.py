"""HTTP-мидлварь идемпотентности для мутирующих запросов.

Клиент генерирует UUID на каждую логическую операцию и шлёт его в заголовке
Idempotency-Key. При сетевом сбое клиент повторяет запрос с тем же ключом.
Мидлварь: если ответ с таким ключом уже сохранён (2xx) — вернуть его, иначе
выполнить и сохранить. Так повтор запроса никогда не создаёт вторую продажу.

Хранятся только успешные (2xx) ответы: ошибки можно безопасно повторять.
Ключи старше 7 дней вычищаются при каждой записи.
"""

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.db import SessionLocal
from app.models.idempotency import IdempotencyKey

_IDEMPOTENT_METHODS = {"POST", "PUT", "DELETE"}


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        key = request.headers.get("Idempotency-Key")
        if (
            request.method not in _IDEMPOTENT_METHODS
            or not key
            or not request.url.path.startswith("/api")
        ):
            return await call_next(request)

        method, path = request.method, request.url.path

        # 1) уже выполнялся? — вернуть сохранённый ответ
        with SessionLocal() as db:
            row = db.scalar(select(IdempotencyKey).where(IdempotencyKey.key == key))
            if row is not None and row.method == method and row.path == path:
                return Response(
                    content=row.response_body,
                    status_code=row.status_code,
                    media_type="application/json",
                )

        # 2) выполнить запрос
        response = await call_next(request)
        if not (200 <= response.status_code < 300):
            return response  # ошибки не сохраняем — их можно повторять

        body = b""
        async for chunk in response.body_iterator:  # noqa: SIM117 — буферизация для записи
            body += chunk

        # 3) сохранить ответ под ключом (гонка двух одинаковых запросов
        # решается уникальным индексом: проигравший отдаёт уже сохранённое)
        with SessionLocal() as db:
            try:
                db.add(IdempotencyKey(
                    key=key,
                    method=method,
                    path=path,
                    status_code=response.status_code,
                    response_body=body.decode("utf-8"),
                    created_at=datetime.now(timezone.utc),
                ))
                IdempotencyKey.prune(db)
                db.commit()
            except IntegrityError:
                db.rollback()
                row = db.scalar(select(IdempotencyKey).where(IdempotencyKey.key == key))
                if row is not None:
                    return Response(
                        content=row.response_body,
                        status_code=row.status_code,
                        media_type="application/json",
                    )

        headers = dict(response.headers)
        headers.pop("content-length", None)
        return Response(
            content=body,
            status_code=response.status_code,
            headers=headers,
            media_type="application/json",
        )
