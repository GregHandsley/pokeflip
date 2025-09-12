# app/cli/build_csv.py
from __future__ import annotations
import argparse, csv
from datetime import datetime as dt
from pathlib import Path

from app.common.paths import project_root
from app.storage.db import connect_db
from app.listing.texts import build_title, render_description
from app.pricing.comps import get_comps  # ← now from the folder

# Simple CSV defaults (kept here; move to YAML later if desired)
CATEGORY_ID_DEFAULT = 183454      # Pokémon TCG Individual Cards
CONDITION_ID_DEFAULT = 3000       # Used
FORMAT = "FixedPrice"
BEST_OFFER = "true"
SHIPPING_DEFAULT = "RM Large Letter"
RETURNS_DEFAULT = "30-day returns"

CSV_COLUMNS = [
    "Title","Description","CategoryID","ConditionID",
    "Name","Set","Number","Rarity","Finish","Language",
    "Quantity","Format","BestOfferEnabled","Shipping","Returns",
    "CustomLabel",
]

def staged_dir_for(sku: str) -> Path:
    return project_root() / "staged" / sku

def fetch_latest_price(sku: str) -> float | None:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT price_listed FROM listings WHERE sku=? ORDER BY id DESC LIMIT 1;",
            (sku,)
        )
        row = cur.fetchone()
    return float(row[0]) if row and row[0] is not None else None

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

# ---------- eBay template support (optional) ----------

def read_template_header(template_path: Path):
    """Return (info_line:str, header_line:str, header_fields:list[str])."""
    with template_path.open("r", encoding="utf-8-sig", newline="") as f:
        rdr = csv.reader(f)
        info_row = next(rdr)      # e.g. Info,Version=...,Template=...
        header = next(rdr)        # actual column names
    return ",".join(info_row), ",".join(header), header

def rows_for_template(header: list[str], cards: list[dict], start_price_default: float | None):
    def find_col(prefix: str) -> str | None:
        for h in header:
            if h.startswith(prefix):
                return h
        return None

    action_col = find_col("*Action(") or "*Action"
    out = []
    for c in cards:
        price = fetch_latest_price(c["sku"])
        if price is None and start_price_default is None:
            comps = get_comps(c)
            print(f"ℹ️  {c['sku']}: no comps (price missing). median={comps['median_sold']} n_30d={comps['n_30d']}")
        start_price_value = price if price is not None else start_price_default

        row = {h: "" for h in header}
        row[action_col] = "Add"
        if "*Title" in row:        row["*Title"] = build_title(c)
        if "*Description" in row:  row["*Description"] = render_description(c)
        if "*ConditionID" in row:  row["*ConditionID"] = "3000"
        if "Category" in row:      row["Category"] = "183454"
        if "Quantity" in row:      row["Quantity"] = "1"
        if "*Format" in row:       row["*Format"] = "FixedPrice"
        if "BestOfferEnabled" in row: row["BestOfferEnabled"] = "true"
        if "CustomLabel" in row:   row["CustomLabel"] = c["sku"]
        if "C:Game" in row:        row["C:Game"] = "Pokémon TCG"
        if "C:Rarity" in row:      row["C:Rarity"] = c["rarity"]
        if "C:Finish" in row:      row["C:Finish"] = ("Holo" if c["holo"] else "Non-Holo")
        if "C:Language" in row:    row["C:Language"] = c["language"]
        if "C:Card Name" in row:   row["C:Card Name"] = c["name"]
        if "*StartPrice" in row:
            row["*StartPrice"] = f"{start_price_value:.2f}" if start_price_value is not None else ""
        out.append(row)
    return out

# ---------------- main ----------------

def main():
    ap = argparse.ArgumentParser(description="Build eBay bulk CSV from staged cards.")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--sku")
    ap.add_argument("--out", help="Output CSV path (default: exports/ebay_bulk_YYYYMMDD.csv)")
    ap.add_argument("--template", help="Path to eBay category template CSV to shape output.")
    ap.add_argument("--start-price", type=float, default=None,
                    help="Optional default price for template CSV when no saved price.")
    ap.add_argument("--no-prompt", action="store_true",
                    help="Do not prompt for price; leave *StartPrice blank if unknown.")
    args = ap.parse_args()

    exports_dir = project_root() / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else exports_dir / f"ebay_bulk_{dt.now():%Y%m%d}.csv"

    cards = list(iter_cards(limit=args.limit, sku=args.sku))

    if args.template:
        info_line, header_line, header = read_template_header(Path(args.template))
        rows = rows_for_template(
            header=header,
            cards=cards,
            start_price_default=None if args.no_prompt else args.start_price
        )
        with out_path.open("w", newline="", encoding="utf-8") as f:
            f.write(info_line + "\n")
            f.write(header_line + "\n")
            w = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
            for r in rows:
                w.writerow(r)
        print(f"🧾 Wrote {len(rows)} row(s) → {out_path}")
        return

    # simple CSV (no price column) — still warn if price missing
    rows_simple = []
    for c in cards:
        price = fetch_latest_price(c["sku"])
        if price is None:
            comps = get_comps(c)
            print(f"ℹ️  {c['sku']}: no comps (price missing). median={comps['median_sold']} n_30d={comps['n_30d']}")
        rows_simple.append(build_row(c))

    with out_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for r in rows_simple:
            w.writerow(r)

    print(f"🧾 Wrote {len(rows_simple)} row(s) → {out_path}")

if __name__ == "__main__":
    main()
