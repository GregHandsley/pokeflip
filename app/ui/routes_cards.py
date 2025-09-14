# app/ui/routes_cards.py
from __future__ import annotations
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from app.storage.db import connect_db
from app.listing.texts import build_title, render_description
from app.ops.listings import upsert_listing
from app.ops.state_watcher import move_if_active
from app.pricing.comps import get_comps
from app.accounting import estimate_consumables_cost
from .deps import templates, counts, file_url

router = APIRouter()

# ---------- helpers ----------

def _get_saved_price(sku: str) -> float | None:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT price_listed
               FROM listings
               WHERE sku=? AND platform='ebay'
               ORDER BY id DESC LIMIT 1""",
            (sku,),
        )
        row = cur.fetchone()
    return float(row[0]) if row and row[0] is not None else None

def _fetch_cards(limit: int = 100) -> List[Dict[str, Any]]:
    sql = """
      SELECT
        c.sku, c.name, c.set_name, c.set_code, c.number, c.language, c.rarity, c.holo, c.condition, c.notes,
        (SELECT status       FROM listings WHERE sku=c.sku ORDER BY id DESC LIMIT 1) AS list_status,
        (SELECT platform     FROM listings WHERE sku=c.sku ORDER BY id DESC LIMIT 1) AS list_platform,
        (SELECT price_listed FROM listings WHERE sku=c.sku ORDER BY id DESC LIMIT 1) AS list_price,
        (SELECT path FROM images WHERE id=c.image_front_id) AS front_path,
        (SELECT path FROM images WHERE id=c.image_back_id)  AS back_path
      FROM cards c
      ORDER BY c.rowid DESC
      LIMIT ?;
    """
    keys = [
        "sku","name","set_name","set_code","number","language","rarity","holo","condition","notes",
        "list_status","list_platform","list_price","front_path","back_path",
    ]
    out: List[Dict[str, Any]] = []
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(sql, (limit,))
        for row in cur.fetchall():
            d = dict(zip(keys, row))
            # URLs for modal preview (robust: file_url accepts str|Path)
            d["front_url"] = file_url(d["front_path"]) if d["front_path"] else None
            d["back_url"]  = file_url(d["back_path"])  if d["back_path"]  else None
            # If no saved price, attach a simple comps placeholder (for UI badge)
            d["comps"] = get_comps(d) if d["list_price"] is None else None
            out.append(d)
    return out

def _preview_for(cards: List[Dict[str, Any]], sku: Optional[str]) -> Optional[Dict[str, str]]:
    if not cards:
        return None
    selected = next((c for c in cards if c["sku"] == sku), cards[0])
    return {
        "sku": selected["sku"],
        "title": build_title(selected),
        "description": render_description(selected),
    }

# ---------- routes ----------

@router.get("/cards", response_class=HTMLResponse)
def cards_view(request: Request, sku: Optional[str] = None, flash: Optional[str] = None):
    cards = _fetch_cards(limit=100)
    preview = _preview_for(cards, sku)
    cons_cost = float(estimate_consumables_cost())
    return templates.TemplateResponse(
        "ui/cards.html",
    {
        "request": request, 
        "cards": cards, 
        "preview": preview, 
        "counts": counts(), 
        "flash": flash,
        "consumables_cost": cons_cost,
    },
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
    # Move staged → listed if possible
    moved_msg = move_if_active(sku, dry_run=False) or ""
    flash = "Marked active" + (" & moved" if "moved" in moved_msg else "")
    return RedirectResponse(url=f"/cards?sku={sku}&flash={flash}", status_code=303)
