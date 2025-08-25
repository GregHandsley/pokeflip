# app/logger.py
from __future__ import annotations
from pathlib import Path
from datetime import datetime
import json

from .paths import project_root

def _logs_dir() -> Path:
    return project_root() / "logs"

def _log_path() -> Path:
    return _logs_dir() / "ingest.log"

def _ensure_logs_dir():
    _logs_dir().mkdir(parents=True, exist_ok=True)

def log_duplicate_skipped(file_relpath: str, phash: str, seen_as: list[tuple[str, str | None]]) -> None:
    """
    Append a JSON line recording that `file_relpath` was skipped as a duplicate.
    `seen_as` is a list of (other_path, other_sku) that matched this pHash.
    """
    _ensure_logs_dir()
    entry = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "event": "duplicate_skipped",
        "file": file_relpath,
        "phash": phash,
        "matches": [{"path": p, "sku": sku} for (p, sku) in seen_as],
    }
    with _log_path().open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")
