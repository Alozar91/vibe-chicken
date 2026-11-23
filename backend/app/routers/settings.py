"""Настройки системы (только администратор)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.schemas.settings import SettingOut, SettingUpdateIn
from app.services import settings as svc

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    return svc.list_all(db)


@router.put("/{key}", response_model=SettingOut)
def update_setting(key: str, data: SettingUpdateIn, db: Session = Depends(get_db),
                   _: object = Depends(get_current_user)):
    try:
        svc.set_value(db, key, data.value)
    except KeyError:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Настройка не найдена")
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    return svc.describe(db, key)
