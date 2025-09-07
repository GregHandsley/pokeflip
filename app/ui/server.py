from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, RedirectResponse
import shutil
from typing import List, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.common.paths import project_root, inbox_unsorted_dir, inbox_pending_dir
from app.storage.db import connect_db, relpath

from app.cli.ingest_cli import scan_unsorted, index_images, filter_duplicates
from app.vision.pairing import group_by_stem, pair_by_name, pair_by_time
from app.pipelines.staging import move_pairs_to_pending
from app.pipelines.review import stage_pending
from app.common.paths import inbox_pending_dir
from app.listing.texts import build_title, render_description

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

@app.get("/upload", response_class=HTMLResponse)
def upload_get(request: Request):
    return templates.TemplateResponse("ui/upload.html", {"request": request})

@app.post("/upload")
async def upload_post(files: List[UploadFile] = File(...)):
    target = inbox_unsorted_dir(); target.mkdir(parents=True, exist_ok=True)
    for f in files:
        dest = target / Path(f.filename).name
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
    return RedirectResponse(url="/pending", status_code=303)

@app.post("/ingest")
def run_ingest():
    files = scan_unsorted(include_hidden=False)
    if not files:
        return RedirectResponse(url="/pending?moved=0&dupes=0", status_code=303)
    index_images(files)
    candidates, dupes = filter_duplicates(files, allow_duplicates=False)
    moved = 0
    if candidates:
        groups = group_by_stem(candidates)
        name_pairs, leftovers = pair_by_name(groups)
        time_pairs, leftovers2 = pair_by_time(leftovers, time_window=30)
        pairs = name_pairs + time_pairs
        if pairs:
            with connect_db() as conn:
                move_pairs_to_pending(pairs, conn=conn)
            moved = len(pairs)
    return RedirectResponse(url=f"/pending?moved={moved}&dupes={len(dupes)}", status_code=303)

@app.get("/pending", response_class=HTMLResponse)
def pending(request: Request, moved: int = 0, dupes: int = 0):
    root = inbox_pending_dir(); root.mkdir(parents=True, exist_ok=True)
    items = []
    for d in sorted([p for p in root.iterdir() if p.is_dir()]):
        imgs = sorted([p for p in d.iterdir() if p.is_file()])
        front = f"/files/{relpath(imgs[0])}" if imgs else None
        back  = f"/files/{relpath(imgs[1])}" if len(imgs) > 1 else None
        items.append({"uuid": d.name, "front": front, "back": back})
    return templates.TemplateResponse("ui/pending.html", {
        "request": request, "items": items, "moved": moved, "dupes": dupes, "counts": _counts()
    })

@app.get("/review/{uuid}", response_class=HTMLResponse)
def review_get(uuid: str, request: Request):
    pend = inbox_pending_dir() / uuid
    imgs = sorted([p for p in pend.iterdir() if p.is_file()]) if pend.exists() else []
    front = f"/files/{relpath(imgs[0])}" if len(imgs) >= 1 else None
    back  = f"/files/{relpath(imgs[1])}" if len(imgs) >= 2 else None
    return templates.TemplateResponse("ui/review.html", {"request": request, "uuid": uuid, "front": front, "back": back})

@app.post("/review/{uuid}")
def review_post(uuid: str,
                name: str = Form(...), set_name: str = Form(...), set_code: str = Form(...),
                number: str = Form(...), language: str = Form("EN"),
                rarity: str = Form(""), holo: Optional[str] = Form(None),
                condition: str = Form("NM")):
    meta = dict(
        name=name.strip(), set_name=set_name.strip(), set_code=set_code.strip(),
        number=str(number).strip(), language=language.strip().upper() or "EN",
        rarity=rarity.strip(), holo=(str(holo or "").lower() in ("y","yes","true","1","on")),
        condition=condition.strip().upper() or "NM",
    )
    sku = stage_pending(uuid, meta)
    return RedirectResponse(url=f"/pending?staged=1&sku={sku}", status_code=303)

@app.get("/cards", response_class=HTMLResponse)
def cards_view(request: Request, sku: str | None = None):
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""SELECT sku,name,set_name,set_code,number,language,rarity,holo,condition,notes
                       FROM cards ORDER BY rowid DESC LIMIT 100;""")
        rows = cur.fetchall()
    keys = ["sku","name","set_name","set_code","number","language","rarity","holo","condition","notes"]
    cards = [dict(zip(keys, r)) for r in rows]

    # Pick selected card: query param, else latest
    selected = None
    if cards:
        selected = next((c for c in cards if c["sku"] == sku), cards[0])

    preview = None
    if selected:
        preview = {
            "sku": selected["sku"],
            "title": build_title(selected),
            "description": render_description(selected),
        }

    return templates.TemplateResponse("ui/cards.html",
        {"request": request, "cards": cards, "preview": preview, "selected_sku": sku, "counts": _counts()}
    )
