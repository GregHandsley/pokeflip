from __future__ import annotations
from fastapi import APIRouter, Form
from fastapi.responses import RedirectResponse

from app.storage.db import connect_db
from app.ops.listings import upsert_listing
from app.ops.state_watcher import move_if_sold
from app.accounting import estimate_consumables_cost

router = APIRouter()

@router.post("/sales/record")
def sales_record(
    sku: str = Form(...),
    sale_price: float = Form(...),
    shipping_charged: float = Form(...),
    shipping_actual: float = Form(...),
    order_id: str | None = Form(None),
):
    pack = estimate_consumables_cost()
    # simple fees; replace with your real calc
    ebay_fee = round(sale_price * 0.10, 2)
    payment_fee = round(sale_price * 0.029 + 0.30, 2)
    net_profit = sale_price + shipping_charged - (shipping_actual + ebay_fee + payment_fee + pack)
    roi_pct = round((net_profit / max(1e-9, sale_price)) * 100, 2)

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO sales
                (sku, sale_price, shipping_charged, shipping_actual,
                 ebay_fee, payment_fee, consumables_cost, net_profit, roi_pct, order_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (sku, sale_price, shipping_charged, shipping_actual,
              ebay_fee, payment_fee, pack, net_profit, roi_pct, (order_id or None)))

        # IMPORTANT: use the SAME connection to avoid locks
        upsert_listing(sku=sku, platform="ebay", status="sold", price=sale_price, conn=conn)

        # if you auto-move listed → sold:
        try:
            from app.ops.state_watcher import move_if_sold
            msg = move_if_sold(sku, dry_run=False) or ""
        except Exception:
            msg = ""

        conn.commit()

    flash = f"Sale recorded for {sku}."
    if "moved" in msg:
        flash += " Folder moved to /sold."
    return RedirectResponse(url=f"/cards?sku={sku}&flash={flash}", status_code=303)