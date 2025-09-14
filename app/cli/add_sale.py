# app/cli/add_sale.py
from __future__ import annotations
import argparse
from decimal import Decimal
from datetime import datetime, timezone

from app.ops.sales import SaleInput, record_sale
from app.ops.state_watcher import move_if_ready  # will move listed -> sold

def _ask_money(prompt: str) -> Decimal:
    while True:
        val = input(prompt).strip()
        try:
            return Decimal(val)
        except Exception:
            print("Please enter a valid number, e.g. 12.34")

def main():
    ap = argparse.ArgumentParser(description="Record a sale for a SKU.")
    ap.add_argument("sku", help="SKU to mark as sold (e.g., POK/EN-...-001)")
    ap.add_argument("--price", type=str, help="Sale price")
    ap.add_argument("--ship-charged", type=str, help="Shipping charged to buyer")
    ap.add_argument("--ship-actual", type=str, help="Your actual shipping cost")
    ap.add_argument("--order-id", type=str, help="Marketplace order id", default=None)
    args = ap.parse_args()

    sale_price       = Decimal(args.price) if args.price else _ask_money("Sale price £: ")
    shipping_charged = Decimal(args.ship_charged) if args.ship_charged else _ask_money("Shipping charged £: ")
    shipping_actual  = Decimal(args.ship_actual) if args.ship_actual else _ask_money("Shipping actual £: ")

    res = record_sale(SaleInput(
        sku=args.sku,
        sale_price=sale_price,
        shipping_charged=shipping_charged,
        shipping_actual=shipping_actual,
        platform_order_id=args.order_id,
        sold_at=datetime.now(timezone.utc),
    ))

    print("\n=== SALE RECORDED ===")
    print(f"SKU:               {res.sku}")
    print(f"Sale price:        £{res.sale_price:.2f}")
    print(f"Shipping charged:  £{res.shipping_charged:.2f}")
    print(f"Shipping actual:   £{res.shipping_actual:.2f}")
    print(f"eBay fee:          £{res.ebay_fee:.2f}")
    print(f"Payment fee:       £{res.payment_fee:.2f}")
    print(f"Consumables:       £{res.consumables_cost:.2f}")
    print(f"Acquisition:       £{res.acquisition_cost:.2f}")
    print(f"Net profit:        £{res.net_profit:.2f}")
    print(f"ROI % (vs acq):    {res.roi_pct:.2f}%" if res.roi_pct is not None else "ROI %: n/a")

    # move listed -> sold if status now 'sold'
    moved = move_if_ready(args.sku, dry_run=False)
    if moved:
        print(moved)

if __name__ == "__main__":
    main()
