from __future__ import annotations
import datetime as dt
from typing import Optional
from app.storage.db import connect_db

def upsert_listing(sku: str, platform: str, status: str, price: Optional[float] = None):
    """Create or update latest listing row for a SKU."""
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
