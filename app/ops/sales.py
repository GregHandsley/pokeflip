# app/ops/sales.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.storage.db import connect_db
from app.common.config import load_fees
from app.accounting import estimate_consumables_cost
from app.ops.listings import upsert_listing  # you already have this

def _money(x) -> Decimal:
    return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

@dataclass
class SaleInput:
    sku: str
    sale_price: Decimal
    shipping_charged: Decimal
    shipping_actual: Decimal
    platform_order_id: Optional[str] = None
    sold_at: datetime = datetime.now(timezone.utc)

@dataclass
class SaleResult:
    sku: str
    sale_price: Decimal
    shipping_charged: Decimal
    shipping_actual: Decimal
    ebay_fee: Decimal
    payment_fee: Decimal
    consumables_cost: Decimal
    acquisition_cost: Decimal
    net_profit: Decimal
    roi_pct: Optional[Decimal]  # % of acquisition cost; None if acquisition=0

def _acquisition_cost(sku: str) -> Decimal:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT acquisition_cost FROM cards WHERE sku=?", (sku,))
        row = cur.fetchone()
    return _money(row[0] or 0)

def _fees_on(gross: Decimal):
    fees = load_fees() or {}
    fv_pct = Decimal(str(fees.get("ebay_final_value_pct", 0))) / Decimal("100")
    fv_fixed = _money(fees.get("ebay_fixed_fee", 0))
    pay_pct = Decimal(str(fees.get("payment_pct", 0))) / Decimal("100")
    ebay_fee = (gross * fv_pct + fv_fixed).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    payment_fee = (gross * pay_pct).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return ebay_fee, payment_fee

def record_sale(s: SaleInput) -> SaleResult:
    acq = _acquisition_cost(s.sku)
    cons = _money(estimate_consumables_cost())
    gross = (s.sale_price + s.shipping_charged)
    ebay_fee, payment_fee = _fees_on(gross)

    costs = s.shipping_actual + ebay_fee + payment_fee + cons + acq
    net = (gross - costs).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    roi = (net / acq * Decimal("100")).quantize(Decimal("0.01")) if acq > 0 else None

    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO sales
              (sku, platform_order_id, sold_at, sale_price, shipping_charged, shipping_actual,
               ebay_fee, payment_fee, consumables_cost, net_profit, roi_pct)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            s.sku, s.platform_order_id, s.sold_at.isoformat(),
            float(s.sale_price), float(s.shipping_charged), float(s.shipping_actual),
            float(ebay_fee), float(payment_fee), float(cons), float(net), float(roi or 0),
        ))
        conn.commit()

    # add a listings row marking it sold (keep price there if you prefer)
    upsert_listing(sku=s.sku, platform="ebay", status="sold", price=float(s.sale_price))

    return SaleResult(
        sku=s.sku, sale_price=s.sale_price, shipping_charged=s.shipping_charged,
        shipping_actual=s.shipping_actual, ebay_fee=ebay_fee, payment_fee=payment_fee,
        consumables_cost=cons, acquisition_cost=acq, net_profit=net, roi_pct=roi
    )
