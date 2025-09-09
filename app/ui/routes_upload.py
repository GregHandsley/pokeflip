from __future__ import annotations
from pathlib import Path
from typing import List
from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import HTMLResponse, RedirectResponse

from app.common.paths import inbox_unsorted_dir
from .deps import templates, ALLOWED_EXTS, MAX_UPLOAD_BYTES, counts

router = APIRouter()

@router.get("/upload", response_class=HTMLResponse)
def upload_get(request: Request):
    return templates.TemplateResponse("ui/upload.html", {"request": request})

@router.post("/upload")
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
