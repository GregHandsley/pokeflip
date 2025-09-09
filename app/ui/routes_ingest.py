from __future__ import annotations
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pathlib import Path

from app.storage.db import connect_db, relpath
from app.common.paths import inbox_pending_dir
from app.cli.ingest_cli import scan_unsorted, index_images, filter_duplicates
from app.vision.pairing import group_by_stem, pair_by_name, pair_by_time
from app.pipelines.staging import move_pairs_to_pending
from .deps import templates, counts, file_url

router = APIRouter()

@router.post("/ingest")
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

@router.get("/pending", response_class=HTMLResponse)
def pending(request: Request, moved: int = 0, dupes: int = 0):
    root = inbox_pending_dir(); root.mkdir(parents=True, exist_ok=True)
    items = []
    for d in sorted([p for p in root.iterdir() if p.is_dir()]):
        imgs = sorted([p for p in d.iterdir() if p.is_file()])
        front = file_url(imgs[0]) if len(imgs) >= 1 and imgs[0].exists() else None
        back  = file_url(imgs[1]) if len(imgs) >= 2 and imgs[1].exists() else None
        items.append({"uuid": d.name, "front": front, "back": back})
    return templates.TemplateResponse("ui/pending.html", {
        "request": request, "items": items, "moved": moved, "dupes": dupes, "counts": counts()
    })
