"""S3-синхронизация SQLite-бэкапов — для платформ без постоянных томов
(например, Timeweb Cloud App Platform: директива volumes в Docker Compose
там запрещена, и данные в контейнере пропадают при повторном деплое).

Логика:
 - при старте: если локальной БД нет, а в S3 есть последний бэкап — скачать
   и развернуть его (restore), после чего накатываются миграции Alembic;
 - после каждого бэкапа (ночного и ручного): загрузить копию в S3.

Включается переменными CHICKEN_S3_* (все четыре обязательны); если они не
заданы — модуль полностью пассивен, поведение как на обычном VPS.
Хранилище: любое S3-совместимое (Timeweb Object Storage, Yandex Object
Storage и т.п.). Реализация на httpx — без новых зависимостей: AWS SigV4
подпись запросов вручную (put/get/list/delete объекта).
"""

import hashlib
import hmac
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.core.config import settings


class S3BackupSync:
    """Клиент S3-совместимого хранилища (SigV4) + логика sync/restore."""

    def __init__(self) -> None:
        self.endpoint = (settings.s3_endpoint_url or "").rstrip("/")
        self.bucket = settings.s3_bucket or ""
        self.access_key = settings.s3_access_key_id or ""
        self.secret_key = settings.s3_secret_access_key or ""
        self.region = settings.s3_region or "us-east-1"
        self.enabled = bool(self.endpoint and self.bucket and self.access_key and self.secret_key)
        u = urlparse(self.endpoint) if self.endpoint else None
        self.host = u.netloc if u else ""
        self.prefix = "chicken-backups/"

    # --- SigV4 helpers ---

    def _sign(self, key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode(), hashlib.sha256).digest()

    def _auth_headers(self, method: str, path: str, query: str, payload_hash: str) -> dict[str, str]:
        """AWS Signature V4 для одного запроса (query-string подпись не нужна —
        подписываем заголовки авторизации)."""
        now = datetime.now(timezone.utc)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")
        canonical_headers = (
            f"host:{self.host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n"
        )
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        canonical_request = f"{method}\n{path}\n{query}\n{canonical_headers}\n{signed_headers}\n{payload_hash}"
        scope = f"{date_stamp}/{self.region}/s3/aws4_request"
        string_to_sign = (
            f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical_request.encode()).hexdigest()}"
        )
        k = self._sign(self._sign(self._sign(self._sign(
            f"AWS4{self.secret_key}".encode(), date_stamp), self.region), "s3"), "aws4_request")
        signature = hmac.new(k, string_to_sign.encode(), hashlib.sha256).hexdigest()
        return {
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
            "Authorization": (
                f"AWS4-HMAC-SHA256 Credential={self.access_key}/{scope}, "
                f"SignedHeaders={signed_headers}, Signature={signature}"
            ),
        }

    def _object_url(self, key: str) -> str:
        # path-style: endpoint/bucket/key — работает и с Timeweb, и с MinIO
        return f"{self.endpoint}/{self.bucket}/{key}"

    # --- операции ---

    def _put(self, key: str, data: bytes) -> bool:
        payload_hash = hashlib.sha256(data).hexdigest()
        headers = self._auth_headers("PUT", f"/{self.bucket}/{key}", "", payload_hash)
        try:
            r = httpx.put(self._object_url(key), content=data, headers=headers, timeout=120)
            return r.status_code in (200, 201)
        except httpx.HTTPError:
            return False

    def _get(self, key: str) -> bytes | None:
        payload_hash = hashlib.sha256(b"").hexdigest()
        headers = self._auth_headers("GET", f"/{self.bucket}/{key}", "", payload_hash)
        try:
            r = httpx.get(self._object_url(key), headers=headers, timeout=120)
            return r.content if r.status_code == 200 else None
        except httpx.HTTPError:
            return None

    def _list(self) -> list[str]:
        """Имена объектов в бакете с префиксом (ключи)."""
        payload_hash = hashlib.sha256(b"").hexdigest()
        query = f"list-type=2&prefix={self.prefix}"
        headers = self._auth_headers("GET", f"/{self.bucket}/", query, payload_hash)
        try:
            r = httpx.get(f"{self.endpoint}/{self.bucket}?{query}", headers=headers, timeout=60)
        except httpx.HTTPError:
            return []
        if r.status_code != 200:
            return []
        return re.findall(r"<Key>([^<]+)</Key>", r.text)

    # --- высокоуровневая логика ---

    def _latest_remote(self) -> str | None:
        keys = [k for k in self._list() if k.endswith(".db")]
        return max(keys) if keys else None  # имена сортируются по времени (YYYY-MM-DD-HHMMSS)

    def restore_if_needed(self, db_path: Path) -> str | None:
        """Если локальной БД нет (новый контейнер) — развернуть последний бэкап из S3.
        Возвращает имя восстановленного объекта или None."""
        if not self.enabled or db_path.exists():
            return None
        latest = self._latest_remote()
        if latest is None:
            return None
        data = self._get(latest)
        if data is None:
            return None
        db_path.parent.mkdir(parents=True, exist_ok=True)
        db_path.write_bytes(data)
        # WAL-файлы от старой копии не нужны
        for suffix in ("-wal", "-shm"):
            Path(str(db_path) + suffix).unlink(missing_ok=True)
        return latest

    def upload_latest(self, db_path: Path) -> str | None:
        """Загрузить самый свежий локальный бэкап в S3 (после run_backup).
        Возвращает ключ объекта или None."""
        if not self.enabled:
            return None
        backups = sorted((db_path.parent / "backups").glob("app-*.db"))
        if not backups:
            return None
        latest = backups[-1]
        key = f"{self.prefix}{latest.name}"
        return key if self._put(key, latest.read_bytes()) else None
