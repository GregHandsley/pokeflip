from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from app.storage.db import connect_db
from app.listing.texts import build_title, render_description
from app.ops.listings import upsert_listing
from app.ops.state_watcher import move_if_ready
from .deps import templates, counts, file_url

router = APIRouter()

def _get_saved_price(sku: str) -> float | None:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""SELECT price_listed
                       FROM listings
                       WHERE sku=? AND platform='ebay'
                       ORDER BY id DESC LIMIT 1""", (sku,))
        row = cur.fetchone()
        return float(row[0]) if row and row[0] is not None else None

@router.get("/cards", response_class=HTMLResponse)
def cards_view(request: Request, sku: Optional[str] = None, flash: Optional[str] = None):
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
            d["front_url"] = file_url(d["front_path"]) if d["front_path"] else None
            d["back_url"]  = file_url(d["back_path"])  if d["back_path"]  else None
            cards.append(d)

    preview = None
    if cards:
        selected = next((c for c in cards if c["sku"] == sku), cards[0])
        preview = {"sku": selected["sku"], "title": build_title(selected), "description": render_description(selected)}

    return templates.TemplateResponse(
        "ui/cards.html",
        {"request": request, "cards": cards, "preview": preview, "counts": counts(), "flash": flash}
    )

@router.post("/listings/set-price")
def set_price(sku: str = Form(...), price: str = Form(...)):
    try:
        val = float(price)
    except ValueError:
        return RedirectResponse(url=f"/cards?sku={sku}&flash=Invalid+price", status_code=303)
    upsert_listing(sku=sku, platform="ebay", status="draft", price=val)
    return RedirectResponse(url=f"/cards?sku={sku}&flash=Price+saved", status_code=303)

@router.post("/listings/mark-active")
def mark_active(sku: str = Form(...)):
    price = _get_saved_price(sku)
    if price is None:
        return RedirectResponse(url=f"/cards?sku={sku}&flash=Set+price+first", status_code=303)
    upsert_listing(sku, platform="ebay", status="active", price=price)
    msg = move_if_ready(sku, dry_run=False) or ""
    flash = "Marked active" + (" & moved" if "moved" in msg else "")
    return RedirectResponse(url=f"/cards?sku={sku}&flash={flash}", status_code=303)
