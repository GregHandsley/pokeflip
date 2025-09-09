from __future__ import annotations
from typing import Optional
from pathlib import Path
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from app.common.paths import inbox_pending_dir
from app.storage.db import relpath
from app.pipelines.review import stage_pending
from app.ops.listings import upsert_listing
from .deps import templates, counts, file_url

router = APIRouter()

@router.get("/review/{uuid}", response_class=HTMLResponse)
def review_get(uuid: str, request: Request):
    pend = inbox_pending_dir() / uuid
    if not pend.exists():
        return RedirectResponse(url="/pending?error=Pending+item+not+found", status_code=303)
    imgs = sorted([p for p in pend.iterdir() if p.is_file()])
    front = file_url(imgs[0]) if len(imgs) >= 1 else None
    back  = file_url(imgs[1]) if len(imgs) >= 2 else None
    return templates.TemplateResponse("ui/review.html",
        {"request": request, "uuid": uuid, "front": front, "back": back, "error": None})

@router.post("/review/{uuid}")
def review_post(uuid: str,
                name: str = Form(""), set_name: str = Form(""),
                set_code: str = Form(""), number: str = Form(""),
                language: str = Form("EN"), rarity: str = Form(""),
                holo: Optional[str] = Form(None), condition: str = Form("NM"),
                price: Optional[str] = Form(None),
                request: Request = None):

    pend = inbox_pending_dir() / uuid
    if not pend.exists():
        return RedirectResponse(url="/pending?error=Pending+item+not+found", status_code=303)

    req_missing = []
    for field, val in [("name",name),("set_name",set_name),("set_code",set_code),("number",number)]:
        if not str(val).strip(): req_missing.append(field)
    if req_missing:
        imgs = sorted([p for p in pend.iterdir() if p.is_file()])
        front = file_url(imgs[0]) if len(imgs) >= 1 else None
        back  = file_url(imgs[1]) if len(imgs) >= 2 else None
        return templates.TemplateResponse("ui/review.html", {
            "request": request, "uuid": uuid, "front": front, "back": back,
            "error": f"Please complete: {', '.join(req_missing)}",
            "name": name, "set_name": set_name, "set_code": set_code, "number": number,
            "language": language, "rarity": rarity, "holo": holo, "condition": condition,
            "price": price,
        })

    meta = dict(
        name=name.strip(), set_name=set_name.strip(), set_code=set_code.strip(),
        number=str(number).strip(), language=language.strip().upper() or "EN",
        rarity=rarity.strip(), holo=(str(holo or "").lower() in ("y","yes","true","1","on")),
        condition=condition.strip().upper() or "NM",
    )
    sku = stage_pending(uuid, meta)

    if price is not None and str(price).strip():
        try:
            upsert_listing(sku=sku, platform="ebay", status="draft", price=float(price))
        except ValueError:
            pass

    return RedirectResponse(url=f"/pending?staged=1&sku={sku}", status_code=303)
