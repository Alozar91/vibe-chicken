"""Тесты резервных копий: создание, ротация, разбор URL."""

from datetime import datetime
from pathlib import Path

from app.services import backup as svc


def test_db_file_path_parsing():
    assert svc.db_file_path("sqlite:////tmp/x.db") == Path("/tmp/x.db")
    assert svc.db_file_path("sqlite:///:memory:") is None
    assert svc.db_file_path("postgresql://host/db") is None


def test_run_backup_creates_copy_and_rotates(tmp_path):
    src = tmp_path / "app.db"
    import sqlite3
    con = sqlite3.connect(src)
    con.execute("CREATE TABLE t (x INT)")
    con.execute("INSERT INTO t VALUES (1)")
    con.commit()
    con.close()

    bdir = tmp_path / "backups"
    first = svc.run_backup(src, bdir)
    assert first.exists() and first.name.startswith("app-2")
    # проверим, что копия валидна и содержит данные
    chk = sqlite3.connect(first)
    assert chk.execute("SELECT x FROM t").fetchone() == (1,)
    chk.close()

    # ротация: 16 копий → остаётся 14
    for _ in range(15):
        p = svc.run_backup(src, bdir)
    files = sorted(bdir.glob("app-*.db"))
    assert len(files) == 14
    assert p in files


def test_list_backups(tmp_path):
    src = tmp_path / "app.db"
    src.write_bytes(b"")
    bdir = tmp_path / "backups"
    svc.run_backup(src, bdir)
    rows = svc.list_backups(bdir)
    assert len(rows) == 1
    assert rows[0]["name"].startswith("app-")
    assert rows[0]["size_kb"] >= 0
    datetime.fromisoformat(rows[0]["created_at"])


def test_seconds_until_next_run():
    from datetime import datetime as dt
    # 14:00 → до 03:00 следующего дня 13 часов
    n = svc.seconds_until_next_run(dt(2026, 11, 23, 14, 0))
    assert n == 13 * 3600
    # 02:00 → 1 час
    assert svc.seconds_until_next_run(dt(2026, 11, 23, 2, 0)) == 3600
    # ровно 03:00 → сутки
    assert svc.seconds_until_next_run(dt(2026, 11, 23, 3, 0)) == 24 * 3600
