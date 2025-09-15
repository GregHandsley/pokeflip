# app/ui/routes_sales.py
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from app.storage.db import connect_db
from app.ops.listings import upsert_listing
from app.ops.state_watcher import move_if_sold
from app.accounting import estimate_consumables_cost
from .deps import templates, counts, file_url

router = APIRouter()

@router.get("/sales", response_class=HTMLResponse)
def sales_page(request: Request, flash: Optional[str] = None):
    """
    Show SKUs whose latest listing is 'sold', enriched with last sale row if present.
    """
    with connect_db() as conn:
        cur = conn.cursor()
        # latest sold listing per SKU
        cur.execute("""
          WITH last_sold AS (
            SELECT l1.*
            FROM listings l1
            JOIN (
              SELECT sku, MAX(id) AS max_id
              FROM listings
              WHERE status='sold'
              GROUP BY sku
            ) lm ON lm.max_id = l1.id
          ),
          last_sale AS (
            SELECT s1.*
            FROM sales s1
            JOIN (
              SELECT sku, MAX(id) AS max_id
              FROM sales
              GROUP BY sku
            ) sm ON sm.max_id = s1.id
          )
          SELECT
            c.sku, c.name, c.set_name, c.set_code, c.number, c.language, c.condition,
            (SELECT path FROM images WHERE id=c.image_front_id) AS front_path,
            (SELECT path FROM images WHERE id=c.image_back_id)  AS back_path,
            ls.price_listed, ls.created_at,
            s.sale_price, s.shipping_charged, s.shipping_actual,
            s.ebay_fee, s.payment_fee, s.consumables_cost, s.net_profit, s.roi_pct, s.created_at
          FROM last_sold ls
          JOIN cards c ON c.sku = ls.sku
          LEFT JOIN last_sale s ON s.sku = c.sku
          ORDER BY COALESCE(s.created_at, ls.created_at) DESC
          LIMIT 200;
        """)
        rows = cur.fetchall()

    # map to dicts + image URLs
    sold = []
    for r in rows:
        (sku, name, set_name, set_code, number, language, condition,
         front_path, back_path, price_listed, listed_ts,
         sale_price, ship_chg, ship_act, ebay_fee, pay_fee, pack_cost,
         net_profit, roi_pct, sale_ts) = r
        sold.append({
            "sku": sku,
            "name": name,
            "set": f"{set_name} ({set_code})" if set_code else set_name,
            "number": number,
            "language": language,
            "condition": condition,
            "front_url": file_url(front_path) if front_path else None,
            "back_url":  file_url(back_path)  if back_path  else None,
            "price_listed": price_listed,
            "listed_at": listed_ts,
            "sale_price": sale_price,
            "shipping_charged": ship_chg,
            "shipping_actual":  ship_act,
            "ebay_fee": ebay_fee,
            "payment_fee": pay_fee,
            "pack_cost": pack_cost,
            "net_profit": net_profit,
            "roi_pct": roi_pct,
            "sold_at": sale_ts,
        })

    return templates.TemplateResponse(
        "ui/sales.html",
        {"request": request, "sold": sold, "counts": counts(), "flash": flash}
    )

@router.post("/sales/record")
def sales_record(
    sku: str = Form(...),
    sale_price: float = Form(...),
    shipping_charged: float = Form(0),
    shipping_actual: float = Form(0),
    order_id: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
):
    pack = estimate_consumables_cost()
    # super-simple fee model placeholders (replace with your real calc if you’ve added it)
    ebay_fee = round(0.12 * (sale_price + shipping_charged), 2)
    payment_fee = round(0.029 * sale_price + 0.30, 2)
    net_profit = round(sale_price + shipping_charged - shipping_actual - ebay_fee - payment_fee - pack, 2)
    roi_pct = round((net_profit / max(0.01, pack)) * 100, 2)  # placeholder baseline

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""
          INSERT INTO sales (sku, sale_price, shipping_charged, shipping_actual,
                             ebay_fee, payment_fee, consumables_cost, net_profit, roi_pct,
                             order_id, notes, created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?, strftime('%Y-%m-%dT%H:%M:%S','now'))
        """, (sku, sale_price, shipping_charged, shipping_actual,
              ebay_fee, payment_fee, pack, net_profit, roi_pct,
              (order_id or None), (notes or None)))
        # mark listing sold
        upsert_listing(sku=sku, platform="ebay", status="sold", price=sale_price, conn=conn)
        conn.commit()

    # move listed → sold if folder exists
    move_if_sold(sku, dry_run=False)
    return RedirectResponse(url=f"/sales?flash=Sale+recorded+for+{sku}.", status_code=303)
