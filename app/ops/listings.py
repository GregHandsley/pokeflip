from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from app.storage.db import connect_db

def upsert_listing(sku: str, platform: str, status: str, price: float | None = None, conn=None):
    """Insert or update latest listing row. Uses the provided conn if given to avoid SQLite locks."""
    owns_conn = False
    if conn is None:
        conn = connect_db()
        owns_conn = True

    cur = conn.cursor()
    # find latest listing row for this sku+platform
    cur.execute("SELECT id FROM listings WHERE sku=? AND platform=? ORDER BY id DESC LIMIT 1;", (sku, platform))
    row = cur.fetchone()

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    if row:
        # update latest row
        cur.execute("""
            UPDATE listings
               SET status = ?,
                   price_listed = COALESCE(?, price_listed),
                   published_at = CASE WHEN ?='active' AND published_at IS NULL THEN ? ELSE published_at END
             WHERE id = ?;
        """, (status, price, status, now, row[0]))
    else:
        # create new row
        cur.execute("""
            INSERT INTO listings (sku, platform, status, price_listed, published_at)
            VALUES (?, ?, ?, ?, CASE WHEN ?='active' THEN ? ELSE NULL END);
        """, (sku, platform, status, price, status, now))

    if owns_conn:
        conn.commit()
        conn.close()
