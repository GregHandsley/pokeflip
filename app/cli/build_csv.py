# app/cli/build_csv.py
from __future__ import annotations
import argparse, csv
from datetime import datetime as dt
from pathlib import Path

from app.common.paths import project_root
from app.storage.db import connect_db
from app.listing.texts import build_title, render_description

# Defaults (move to YAML later if you like)
CATEGORY_ID_DEFAULT = 183454      # Pokémon TCG Individual Cards
CONDITION_ID_DEFAULT = 3000       # Used
FORMAT = "FixedPrice"
BEST_OFFER = "true"
SHIPPING_DEFAULT = "RM Large Letter"
RETURNS_DEFAULT = "30-day returns"

CSV_COLUMNS = [
    "Title", "Description", "CategoryID", "ConditionID",
    "Name", "Set", "Number", "Rarity", "Finish", "Language",
    "Quantity", "Format", "BestOfferEnabled", "Shipping", "Returns",
    "CustomLabel",
]

def staged_dir_for(sku: str) -> Path:
    # staged/<SKU>/
    return project_root() / "staged" / sku

def iter_cards(limit: int | None = None, sku: str | None = None):
    sql = """
      SELECT sku, name, set_name, set_code, number, language, rarity, holo, condition, notes
      FROM cards
      ORDER BY rowid DESC
    """
    params: list = []
    if sku:
        sql = sql.replace("ORDER BY rowid DESC", "WHERE sku = ? ORDER BY rowid DESC")
        params.append(sku)

    with connect_db() as conn:
        cur = conn.cursor()
        rows = cur.execute(sql, params)
        count = 0
        for r in rows:
            card = {
                "sku": r[0],
                "name": r[1] or "",
                "set_name": r[2] or "",
                "set_code": r[3] or "",
                "number": r[4] or "",
                "language": (r[5] or "EN").upper(),
                "rarity": r[6] or "",
                "holo": bool(r[7]),
                "condition": (r[8] or "NM").upper(),
                "notes": r[9] or "",
            }
            # Only export if the staged folder exists
            if not staged_dir_for(card["sku"]).exists():
                continue
            yield card
            count += 1
            if limit and count >= limit:
                break

def build_row(card: dict) -> dict:
    title = build_title(card)
    desc  = render_description(card)
    finish = "Holo" if card["holo"] else "Non-Holo"
    set_label = f'{card["set_name"]} ({card["set_code"]})' if card["set_code"] else card["set_name"]

    return {
        "Title": title,
        "Description": desc,
        "CategoryID": CATEGORY_ID_DEFAULT,
        "ConditionID": CONDITION_ID_DEFAULT,
        "Name": card["name"],
        "Set": set_label,
        "Number": card["number"],
        "Rarity": card["rarity"],
        "Finish": finish,
        "Language": card["language"],
        "Quantity": 1,
        "Format": FORMAT,
        "BestOfferEnabled": BEST_OFFER,
        "Shipping": SHIPPING_DEFAULT,
        "Returns": RETURNS_DEFAULT,
        "CustomLabel": card["sku"],
    }

def main():
    ap = argparse.ArgumentParser(description="Build eBay bulk CSV from staged cards.")
    ap.add_argument("--limit", type=int, help="Max rows to export (default: all staged).")
    ap.add_argument("--sku", help="Export only this SKU.")
    ap.add_argument("--out", help="Output CSV path (default: exports/ebay_bulk_YYYYMMDD.csv)")
    args = ap.parse_args()

    exports_dir = project_root() / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else exports_dir / f"ebay_bulk_{dt.now():%Y%m%d}.csv"

    rows = [build_row(c) for c in iter_cards(limit=args.limit, sku=args.sku)]

    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"🧾 Wrote {len(rows)} row(s) → {out_path}")

if __name__ == "__main__":
    main()
