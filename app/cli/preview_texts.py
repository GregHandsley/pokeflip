from __future__ import annotations
import argparse, sqlite3
from typing import Dict, Any
from app.storage.db import connect_db
from app.listing.texts import build_title, render_description

def _fetch_card(conn: sqlite3.Connection, sku: str | None) -> Dict[str, Any]:
    cur = conn.cursor()
    if sku:
        cur.execute("""SELECT sku,name,set_code,set_name,number,language,rarity,holo,condition,notes
                       FROM cards WHERE sku=?;""", (sku,))
    else:
        cur.execute("""SELECT sku,name,set_code,set_name,number,language,rarity,holo,condition,notes
                       FROM cards ORDER BY rowid DESC LIMIT 1;""")
    row = cur.fetchone()
    if not row: raise SystemExit("No cards found. Stage one with `make review` first.")
    keys = ["sku","name","set_code","set_name","number","language","rarity","holo","condition","notes"]
    return dict(zip(keys, row))

def main():
    ap = argparse.ArgumentParser(description="Preview title & description for a staged SKU")
    ap.add_argument("--sku", help="Specific SKU to preview (defaults to most recent)")
    args = ap.parse_args()
    with connect_db() as conn:
        card = _fetch_card(conn, args.sku)
    print("\n=== TITLE ===")
    print(build_title(card))
    print("\n=== DESCRIPTION ===")
    print(render_description(card))

if __name__ == "__main__":
    main()
