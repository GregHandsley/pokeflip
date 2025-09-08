# app/cli/publish_confirm.py
from __future__ import annotations
import argparse, datetime as dt
from typing import Iterable
from app.storage.db import connect_db

def upsert_listing(sku: str, platform: str, status: str, price: float | None):
    now = dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM listings WHERE sku=? AND platform=? ORDER BY id DESC LIMIT 1;",
            (sku, platform),
        )
        row = cur.fetchone()
        if row:
            cur.execute(
                """UPDATE listings
                   SET status=?, published_at=?,
                       price_listed=COALESCE(?, price_listed),
                       custom_label=COALESCE(custom_label, ?)
                   WHERE id=?;""",
                (status, now, price, sku, row[0]),
            )
            action = "updated"
        else:
            cur.execute(
                """INSERT INTO listings
                   (sku, platform, custom_label, title, description,
                    price_listed, status, published_at)
                   VALUES (?, ?, ?, '', '', ?, ?, ?);""",
                (sku, platform, sku, price, status, now),
            )
            action = "inserted"
        conn.commit()
    return action, now

def main():
    ap = argparse.ArgumentParser(description="Mark one or more SKUs as listed/active.")
    ap.add_argument("--sku", nargs="+", required=True, help="One or more SKUs.")
    ap.add_argument("--platform", default="ebay", help="Platform name (default: ebay).")
    ap.add_argument("--status", default="active", choices=["active","draft","sold","ended"])
    ap.add_argument("--price", type=float, help="Optional list price to record.")
    args = ap.parse_args()

    for s in args.sku:
        action, ts = upsert_listing(s, args.platform, args.status, args.price)
        print(f"✅ {s}: {action} → {args.status} @ {ts} ({args.platform})")

if __name__ == "__main__":
    main()
