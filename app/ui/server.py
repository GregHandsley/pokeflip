from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.common.paths import project_root, inbox_unsorted_dir, inbox_pending_dir
from app.storage.db import connect_db

app = FastAPI(title="Pokeflip UI")
templates = Jinja2Templates(directory=str(project_root() / "templates"))

# serve repo files (handy later for thumbs)
app.mount("/files", StaticFiles(directory=str(project_root())), name="files")

def _counts():
    unsorted_n = sum(1 for p in inbox_unsorted_dir().glob("*") if p.is_file())
    pending_n  = sum(1 for d in inbox_pending_dir().glob("*") if d.is_dir())
    staged_root = project_root() / "staged"
    staged_n = sum(1 for d in staged_root.rglob("*") if d.is_dir()) if staged_root.exists() else 0
    with connect_db() as conn:
        c = conn.cursor()
        cards_n  = c.execute("SELECT COUNT(*) FROM cards;").fetchone()[0]
        images_n = c.execute("SELECT COUNT(*) FROM images;").fetchone()[0]
    return dict(unsorted=unsorted_n, pending=pending_n, staged=staged_n, cards=cards_n, images=images_n)

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse("ui/dashboard.html", {"request": request, "counts": _counts()})
