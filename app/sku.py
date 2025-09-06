# app/sku.py
from __future__ import annotations
from datetime import datetime
import re, sqlite3

def _yymm() -> str:
    now = datetime.now()
    return f"{now.year % 100:02d}{now.month:02d}"

def _next_seq_for_yymm(conn: sqlite3.Connection, yymm: str) -> int:
    cur = conn.execute("SELECT sku FROM cards WHERE sku LIKE ?;", (f"POK/%-{yymm}-%",))
    max_seq = 0
    for (sku,) in cur.fetchall():
        m = re.search(rf"-{re.escape(yymm)}-(\d{{3}})$", sku)
        if m:
            max_seq = max(max_seq, int(m.group(1)))
    return max_seq + 1

def build_sku(conn: sqlite3.Connection, *, language: str, set_code: str, number: str, condition: str) -> str:
    yymm = _yymm()
    seq = _next_seq_for_yymm(conn, yymm)
    return f"POK/{language.upper()}-{set_code.upper()}-{number}-{condition.upper()}-{yymm}-{seq:03d}"