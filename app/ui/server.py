from __future__ import annotations
from pathlib import Path
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, RedirectResponse
import shutil, os
from typing import List, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from urllib.parse import quote

from app.common.paths import project_root, inbox_unsorted_dir, inbox_pending_dir
from app.storage.db import connect_db, relpath
from app.ops.listings import upsert_listing
from app.ops.state_watcher import move_if_ready

from app.cli.ingest_cli import scan_unsorted, index_images, filter_duplicates
from app.vision.pairing import group_by_stem, pair_by_name, pair_by_time
from app.vision.imaging import is_image_file
from app.pipelines.staging import move_pairs_to_pending
from app.pipelines.review import stage_pending
from app.listing.texts import build_title, render_description

ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}  # keep HEIC out for now
MAX_UPLOAD_MB = 15
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

app = FastAPI(title="Pokeflip UI")
templates = Jinja2Templates(directory=str(project_root() / "templates"))

# serve repo files (handy later for thumbs)
app.mount("/static", StaticFiles(directory=str(project_root() / "static")), name="static")
# serve repo files (staged/pending/etc.)
app.mount("/files", StaticFiles(directory=str(project_root().resolve())), name="files")


def file_url(p: Path) -> str:
    rel = relpath(p).replace("\\", "/")   # repo-relative, normalize slashes
    return "/files/" + quote(rel, safe="/")

def _counts():
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

@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    return templates.TemplateResponse("ui/dashboard.html", {"request": request, "counts": _counts()})

@app.post("/upload")
async def upload_post(files: List[UploadFile] = File(...)):
    target = inbox_unsorted_dir(); target.mkdir(parents=True, exist_ok=True)
    saved = skipped_ext = skipped_size = skipped_hidden = 0
    for f in files:
        name = Path(f.filename).name
        if name.startswith("."): skipped_hidden += 1; continue
        ext = Path(name).suffix.lower()
        if ext not in ALLOWED_EXTS: skipped_ext += 1; continue

        dest = target / name
        total = 0
        with dest.open("wb") as out:
            while True:
                chunk = await f.read(8192)
                if not chunk: break
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    out.close()
                    try: dest.unlink()
                    except FileNotFoundError: pass
                    skipped_size += 1
                    while await f.read(8192): pass
                    break
                out.write(chunk)
        if total and total <= MAX_UPLOAD_BYTES:
            saved += 1

    return RedirectResponse(
        url=f"/pending?uploaded={saved}&badext={skipped_ext}&toobig={skipped_size}&hidden={skipped_hidden}",
        status_code=303
    )

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
        front = file_url(imgs[0]) if len(imgs) >= 1 and imgs[0].exists() else None
        back  = file_url(imgs[1]) if len(imgs) >= 2 and imgs[1].exists() else None
        items.append({"uuid": d.name, "front": front, "back": back})

    return templates.TemplateResponse("ui/pending.html", {
        "request": request, "items": items, "moved": moved, "dupes": dupes, "counts": _counts()
    })

@app.get("/review/{uuid}", response_class=HTMLResponse)
def review_get(uuid: str, request: Request):
    pend = inbox_pending_dir() / uuid
    if not pend.exists():
        return RedirectResponse(url="/pending?error=Pending+item+not+found", status_code=303)
    imgs = sorted([p for p in pend.iterdir() if p.is_file()])
    front = file_url(imgs[0]) if len(imgs) >= 1 else None
    back  = file_url(imgs[1]) if len(imgs) >= 2 else None

    return templates.TemplateResponse("ui/review.html",
        {"request": request, "uuid": uuid, "front": front, "back": back, "error": None})


@app.post("/review/{uuid}")
def review_post(uuid: str,
                name: str = Form(""), set_name: str = Form(""),
                set_code: str = Form(""), number: str = Form(""),
                language: str = Form("EN"), rarity: str = Form(""),
                holo: Optional[str] = Form(None), condition: str = Form("NM"),
                request: Request = None):
    pend = inbox_pending_dir() / uuid
    if not pend.exists():
        return RedirectResponse(url="/pending?error=Pending+item+not+found", status_code=303)

    # server-side required fields
    req_missing = []
    for field, val in [("name",name),("set_name",set_name),("set_code",set_code),("number",number)]:
        if not str(val).strip(): req_missing.append(field)
    if req_missing:
        imgs = sorted([p for p in pend.iterdir() if p.is_file()])
        front = f"/files/{relpath(imgs[0])}" if len(imgs) >= 1 else None
        back  = f"/files/{relpath(imgs[1])}" if len(imgs) >= 2 else None
        return templates.TemplateResponse("ui/review.html", {
            "request": request, "uuid": uuid, "front": front, "back": back,
            "error": f"Please complete: {', '.join(req_missing)}",
            "name": name, "set_name": set_name, "set_code": set_code, "number": number,
            "language": language, "rarity": rarity, "holo": holo, "condition": condition
        })

    meta = dict(
        name=name.strip(), set_name=set_name.strip(), set_code=set_code.strip(),
        number=str(number).strip(), language=language.strip().upper() or "EN",
        rarity=rarity.strip(), holo=(str(holo or "").lower() in ("y","yes","true","1","on")),
        condition=condition.strip().upper() or "NM",
    )
    sku = stage_pending(uuid, meta)
    return RedirectResponse(url=f"/pending?staged=1&sku={sku}", status_code=303)


@app.get("/cards", response_class=HTMLResponse)
def cards_view(request: Request, sku: str | None = None, tab: str = "cards", flash: str | None = None):
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""
          SELECT
            c.sku, c.name, c.set_name, c.set_code, c.number, c.language, c.rarity, c.holo, c.condition, c.notes,
            (SELECT status       FROM listings WHERE sku=c.sku ORDER BY id DESC LIMIT 1) AS list_status,
            (SELECT platform     FROM listings WHERE sku=c.sku ORDER BY id DESC LIMIT 1) AS list_platform,
            (SELECT price_listed FROM listings WHERE sku=c.sku ORDER BY id DESC LIMIT 1) AS list_price,
            (SELECT path FROM images WHERE id=c.image_front_id) AS front_path,
            (SELECT path FROM images WHERE id=c.image_back_id)  AS back_path
          FROM cards c
          ORDER BY c.rowid DESC
          LIMIT 100;
        """)
        keys = [
          "sku","name","set_name","set_code","number","language","rarity","holo","condition","notes",
          "list_status","list_platform","list_price","front_path","back_path"
        ]
        cards = []
        for r in cur.fetchall():
            d = dict(zip(keys, r))
            d["front_url"] = file_url(Path(d["front_path"])) if d["front_path"] else None
            d["back_url"]  = file_url(Path(d["back_path"]))  if d["back_path"]  else None
            cards.append(d)

    # Build preview (unchanged)
    preview = None
    if cards:
        selected = next((c for c in cards if c["sku"] == sku), cards[0])
        preview = {"sku": selected["sku"], "title": build_title(selected), "description": render_description(selected)}

    # Images tab data (if you still use it)
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""SELECT id, sku, path FROM images ORDER BY id DESC LIMIT 100;""")
        images = [{"id": r[0], "sku": r[1], "path": r[2], "url": file_url(Path(r[2]))} for r in cur.fetchall()]

    return templates.TemplateResponse(
        "ui/cards.html",
        {"request": request, "cards": cards, "images": images, "preview": preview,
         "counts": _counts(), "flash": flash}
    )


@app.get("/upload", response_class=HTMLResponse)
def upload_get(request: Request):
    return templates.TemplateResponse("ui/upload.html", {"request": request})

@app.post("/listings/mark-active")
def listings_mark_active(
    sku: str = Form(...),
    price: Optional[str] = Form(None),
    platform: str = Form("ebay"),
):
    price_val = None
    if price is not None and str(price).strip():
        try:
            price_val = float(price)
        except ValueError:
            return RedirectResponse(url=f"/cards?sku={sku}&flash=Invalid+price", status_code=303)

    upsert_listing(sku, platform, "active", price_val)

    # move staged → listed immediately (also updates image paths in DB if you added that in watcher)
    msg = move_if_ready(sku, dry_run=False) or "No move needed"
    flash = "Marked active"
    if "moved" in msg: flash += " & moved"
    elif "destination already exists" in msg: flash += " (already listed folder present)"

    return RedirectResponse(url=f"/cards?sku={sku}&flash={flash}", status_code=303)