from __future__ import annotations
from pathlib import Path
from urllib.parse import quote
from fastapi.templating import Jinja2Templates

from app.common.paths import project_root, inbox_unsorted_dir, inbox_pending_dir
from app.storage.db import connect_db, relpath
from app.vision.imaging import is_image_file

# constants for uploads
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_MB = 15
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

# jinja templates (shared by routes)
templates = Jinja2Templates(directory=str(project_root() / "templates"))

def file_url(p: str | Path) -> str:
    if isinstance(p, Path):
        if p.is_absolute():
            rel = relpath(p)
        else:
            rel = str(p)
    else:  # str
        # DB stores repo-relative paths already (e.g., 'staged/...'); don't relpath again
        rel = p

    rel = rel.replace("\\", "/")
    return "/files/" + quote(rel, safe="/")

def counts() -> dict:
    unsorted_n = sum(
        1 for p in inbox_unsorted_dir().iterdir()
        if p.is_file() and not p.name.startswith(".") and is_image_file(p)
    )
    pending_n  = sum(1 for d in inbox_pending_dir().glob("*") if d.is_dir())
    staged_root = project_root() / "staged"
    staged_n = sum(1 for d in staged_root.rglob("*") if d.is_dir()) if staged_root.exists() else 0
    with connect_db() as conn:
        c = conn.cursor()
        cards_n  = c.execute("SELECT COUNT(*) FROM cards;").fetchone()[0]
        images_n = c.execute("SELECT COUNT(*) FROM images;").fetchone()[0]
    return dict(unsorted=unsorted_n, pending=pending_n, staged=staged_n, cards=cards_n, images=images_n)
