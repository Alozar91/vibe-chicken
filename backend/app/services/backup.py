"""Резервные копии SQLite: ночной бэкап + ручной, ротация (хранить N последних).

Формат: data/backups/app-YYYY-MM-DD-HHMM.db (консистентная копия через
sqlite3 backup API — учитывает WAL). Запускается фоновым потоком при старте.
"""

import re
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path

BACKUP_KEEP = 14
NIGHT_HOUR = 3  # ежедневный бэкап в 03:00


def db_file_path(db_url: str) -> Path | None:
    """Путь к файлу БД из sqlite-URL; None для :memory:/не-sqlite."""
    m = re.match(r"^sqlite:///(.+)$", db_url)
    if not m or m.group(1) == ":memory:":
        return None
    return Path(m.group(1))


def backup_dir_for(db_path: Path) -> Path:
    return db_path.parent / "backups"


def run_backup(db_path: Path, backup_dir: Path | None = None) -> Path:
    """Создать копию БД и удалить старые сверх BACKUP_KEEP."""
    backup_dir = backup_dir or backup_dir_for(db_path)
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    dest = backup_dir / f"app-{stamp}.db"
    n = 1
    while dest.exists():  # несколько копий в одну секунду
        n += 1
        dest = backup_dir / f"app-{stamp}-{n}.db"
    src = sqlite3.connect(db_path)
    dst = sqlite3.connect(dest)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()
    rotate_backups(backup_dir)
    return dest


def rotate_backups(backup_dir: Path, keep: int = BACKUP_KEEP) -> None:
    """Оставить только keep самых свежих копий."""
    files = sorted(backup_dir.glob("app-*.db"), key=lambda f: f.stat().st_mtime)
    for old in files[:-keep] if len(files) > keep else []:
        old.unlink(missing_ok=True)


def list_backups(backup_dir: Path) -> list[dict]:
    """Список копий: имя, размер КБ, время создания (новые сверху)."""
    if not backup_dir.exists():
        return []
    result = []
    for f in sorted(backup_dir.glob("app-*.db"), key=lambda f: f.stat().st_mtime, reverse=True):
        result.append({
            "name": f.name,
            "size_kb": round(f.stat().st_size / 1024),
            "created_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return result


def seconds_until_next_run(now: datetime | None = None) -> int:
    """Сколько секунд ждать до следующего ночного бэкапа."""
    now = now or datetime.now()
    target = now.replace(hour=NIGHT_HOUR, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return int((target - now).total_seconds())


def start_backup_scheduler(db_url: str) -> threading.Thread | None:
    """Фоновый поток: раз в сутки (в 03:00) — бэкап + ротация."""
    db_path = db_file_path(db_url)
    if db_path is None or not db_path.exists():
        return None

    def _loop() -> None:
        while True:
            time.sleep(seconds_until_next_run())
            try:
                run_backup(db_path)
            except Exception:  # noqa: BLE001 — бэкап не должен ронять приложение
                continue

    thread = threading.Thread(target=_loop, name="backup-scheduler", daemon=True)
    thread.start()
    return thread
