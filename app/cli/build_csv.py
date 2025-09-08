# app/cli/build_csv.py
from __future__ import annotations
import argparse
import csv
from datetime import datetime as dt
from pathlib import Path

from app.common.paths import project_root
from app.storage.db import connect_db
from app.listing.texts import build_title, render_description

# Defaults (could be moved to YAML later)
CATEGORY_ID_DEFAULT = 183454      # eBay: Pokémon TCG Individual Cards
CONDITION_ID_DEFAULT = 3000       # "Used"
FORMAT = "FixedPrice"
BEST_OFFER = "true"
SHIPPING_DEFAULT = "RM Large Letter"
RETURNS_DEFAULT = "30-day returns"

# Our simple CSV shape
CSV_COLUMNS = [
    "Title", "Description", "CategoryID", "ConditionID",
    "Name", "Set", "Number", "Rarity", "Finish", "Language",
    "Quantity", "Format", "BestOfferEnabled", "Shipping", "Returns",
    "CustomLabel",
]

def staged_dir_for(sku: str) -> Path:
    """staged/<SKU>/"""
    return project_root() / "staged" / sku

def iter_cards(limit: int | None = None, sku: str | None = None):
    """
    Yield card dicts from DB, newest first.
    Only yields rows whose staged/<SKU>/ folder exists.
    """
    base_sql = """
      SELECT sku, name, set_name, set_code, number, language, rarity, holo, condition, notes
      FROM cards
    """
    params: list = []
    if sku:
        sql = base_sql + " WHERE sku = ? ORDER BY rowid DESC"
        params.append(sku)
    else:
        sql = base_sql + " ORDER BY rowid DESC"

    n = 0
    with connect_db() as conn:
        cur = conn.cursor()
        for r in cur.execute(sql, params):
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
            if not staged_dir_for(card["sku"]).exists():
                continue
            yield card
            n += 1
            if limit and n >= limit:
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
        "Shipping": SHIPPING_DEFAULT,   # ← correct key/value
        "Returns": RETURNS_DEFAULT,
        "CustomLabel": card["sku"],
    }


def read_template_header(template_path: Path) -> tuple[str, str, list[str]]:
    """
    Read the **first two lines** of the eBay category template verbatim
    and also parse the header into a field list.

    Returns: (info_line_raw, header_line_raw, header_fields_list)
    """
    with template_path.open("r", encoding="utf-8-sig", newline="") as f:
        info_line = f.readline().rstrip("\r\n")    # keep exactly as-is
        header_line = f.readline().rstrip("\r\n")
    # Parse the header line to a list of fields
    header_fields = next(csv.reader([header_line]))
    return info_line, header_line, header_fields

def rows_for_template(header: list[str], cards: list[dict], start_price: float) -> list[dict]:
    """
    Map our card dict to the eBay template header. Only fills columns that exist.
    Leaves all other columns blank.
    """
    # The first header often looks like "*Action(SiteID=UK|Country=GB|Currency=GBP|...)".
    # Use a startswith match to find it robustly.
    action_col = next((h for h in header if h.startswith("*Action(")), "*Action")

    out_rows: list[dict] = []
    for c in cards:
        title = build_title(c)
        desc  = render_description(c)
        finish = "Holo" if c["holo"] else "Non-Holo"
        set_label = f'{c["set_name"]} ({c["set_code"]})' if c["set_code"] else c["set_name"]

        row = {h: "" for h in header}  # default blanks
        if action_col in row:            row[action_col] = "Add"
        if "Category" in row:            row["Category"] = str(CATEGORY_ID_DEFAULT)
        if "*Title" in row:              row["*Title"] = title
        if "*Description" in row:        row["*Description"] = desc
        if "*ConditionID" in row:        row["*ConditionID"] = str(CONDITION_ID_DEFAULT)
        if "Quantity" in row:            row["Quantity"] = "1"
        if "*Format" in row:             row["*Format"] = FORMAT
        if "BestOfferEnabled" in row:    row["BestOfferEnabled"] = BEST_OFFER
        if "CustomLabel" in row:         row["CustomLabel"] = c["sku"]
        if "C:Game" in row:              row["C:Game"] = "Pokémon TCG"
        if "C:Rarity" in row:            row["C:Rarity"] = c["rarity"]
        if "C:Finish" in row:            row["C:Finish"] = finish
        if "C:Language" in row:          row["C:Language"] = c["language"]
        if "C:Card Name" in row:         row["C:Card Name"] = c["name"]
        if "*StartPrice" in row:         row["*StartPrice"] = f"{start_price:.2f}"  # required by template

        out_rows.append(row)
    return out_rows

def main():
    ap = argparse.ArgumentParser(description="Build eBay bulk CSV from staged cards.")
    ap.add_argument("--limit", type=int, help="Max rows to export (default: all staged).")
    ap.add_argument("--sku", help="Export only this SKU.")
    ap.add_argument("--out", help="Output CSV path (default: exports/ebay_bulk_YYYYMMDD.csv)")
    ap.add_argument("--template", help="Path to eBay category template CSV to shape output.")
    ap.add_argument("--start-price", type=float, default=0.99,
                    help="Required by eBay template; placeholder is fine.")
    args = ap.parse_args()

    exports_dir = project_root() / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    default_name = "ebay_bulk_{:%Y%m%d}.csv".format(dt.now())
    out_path = Path(args.out) if args.out else exports_dir / default_name

    cards = list(iter_cards(limit=args.limit, sku=args.sku))

    if args.template:
        # Emit an eBay-identifiable CSV (keeps the template’s first two lines exactly)
        info_line, header_line, header_fields = read_template_header(Path(args.template))
        shaped_rows = rows_for_template(header_fields, cards, args.start_price)
        with out_path.open("w", newline="", encoding="utf-8") as f:
            # write the exact first two lines so Seller Hub recognizes the template
            f.write(info_line + "\n")
            f.write(header_line + "\n")
            w = csv.DictWriter(f, fieldnames=header_fields, lineterminator="\n")
            for r in shaped_rows:
                w.writerow(r)
        print(f"🧾 Wrote {len(shaped_rows)} row(s) (eBay template format) → {out_path}")
    else:
        # Our simple CSV (good for internal review or other tooling)
        rows = [build_row(c) for c in cards]
        with out_path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, lineterminator="\n")
            w.writeheader()
            for r in rows:
                w.writerow(r)
        print(f"🧾 Wrote {len(rows)} row(s) → {out_path}")

if __name__ == "__main__":
    main()
