"""HTTP-слой резервных копий; логика в services/backup.py."""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.services import backup as svc

router = APIRouter(prefix="/api/backups", tags=["backups"])


class BackupInfo(BaseModel):
    name: str
    size_kb: int
    created_at: str


def _db_path_or_404():
    path = svc.db_file_path(settings.db_url)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Файл БД не найден")
    return path


@router.get("", response_model=list[BackupInfo])
def list_backups():
    return svc.list_backups(svc.backup_dir_for(_db_path_or_404()))


@router.post("", response_model=BackupInfo, status_code=201)
def create_backup():
    """Ручной бэкап прямо сейчас (с ротацией)."""
    path = svc.run_backup(_db_path_or_404())
    return {
        "name": path.name,
        "size_kb": round(path.stat().st_size / 1024),
        "created_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(),
    }
