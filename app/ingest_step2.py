# app/ingest_step2.py
from __future__ import annotations
import argparse, sqlite3
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

from .paths import project_root, inbox_pending_dir
from .db import connect_db, relpath
from .sku import build_sku
from .sku_suggest import suggest as sku_suggest  # <— NEW

def _find_front_back(folder: Path) -> Tuple[Path, Path]:
    imgs = sorted([p for p in folder.iterdir() if p.is_file()])
    if not imgs:
        raise RuntimeError(f"No files in {folder}")
    front = next((p for p in imgs if "_front" in p.name.lower()), None)
    back  = next((p for p in imgs if "_back"  in p.name.lower()), None)
    if front and back:
        return front, back
    if len(imgs) >= 2:
        return imgs[0], imgs[1]
    raise RuntimeError(f"Need two images in {folder}, found {len(imgs)}")

def _prompt(label: str, default: Optional[str] = None) -> str:
    s = f"{label}" + (f" [{default}]" if default else "") + ": "
    v = input(s).strip()
    return v or (default or "")

def _update_image_row_paths_and_sku(conn: sqlite3.Connection, old_rel: str, new_rel: str, sku: str) -> int:
    cur = conn.cursor()
    cur.execute("UPDATE images SET path = ?, sku = ? WHERE path = ?;", (new_rel, sku, old_rel))
    conn.commit()
    cur.execute("SELECT id FROM images WHERE path = ?;", (new_rel,))
    row = cur.fetchone()
    return int(row[0]) if row else 0

def _upsert_card(conn: sqlite3.Connection, **kw) -> None:
    conn.execute("""
    INSERT INTO cards
      (sku,name,set_code,set_name,number,language,rarity,holo,condition,notes,image_front_id,image_back_id)
    VALUES
      (:sku,:name,:set_code,:set_name,:number,:language,:rarity,:holo,:condition,:notes,:image_front_id,:image_back_id)
    ON CONFLICT(sku) DO UPDATE SET
      name=excluded.name,set_code=excluded.set_code,set_name=excluded.set_name,number=excluded.number,
      language=excluded.language,rarity=excluded.rarity,holo=excluded.holo,condition=excluded.condition,
      notes=excluded.notes,image_front_id=excluded.image_front_id,image_back_id=excluded.image_back_id
    """, kw)
    conn.commit()

def _print_candidates(cands: list[dict[str, Any]]) -> None:
    print("\n🔎 SKU-suggest candidates:")
    for i, c in enumerate(cands[:3], start=1):
        conf = f" ({c.get('confidence'):.2f})" if isinstance(c.get("confidence"), (int, float)) else ""
        print(f"  {i}) {c.get('name','?')} — {c.get('set_name','?')} "
              f"[{c.get('set_code','?')} #{c.get('number','?')} {c.get('language','?')}]"
              f" {c.get('rarity','?')} {'Holo' if c.get('holo') else ''}{conf}")
    print("  0) Enter manually")

def _apply_candidate(c: Dict[str, Any]) -> Dict[str, Any]:
    # Normalize + defaults
    return {
        "name":      str(c.get("name","")).strip() or "Unknown",
        "set_name":  str(c.get("set_name","")).strip() or "Unknown",
        "set_code":  str(c.get("set_code","")).strip() or "UNK",
        "number":    str(c.get("number","")).strip() or "0",
        "language":  str(c.get("language","EN")).strip().upper() or "EN",
        "rarity":    str(c.get("rarity","")).strip() or "",
        "holo":      bool(c.get("holo", False)),
        "condition": str(c.get("condition","NM")).strip().upper() or "NM",
    }

def review_one(temp_id: str, use_sku_suggest: bool) -> None:
    pend = inbox_pending_dir() / temp_id
    if not pend.exists():
        raise SystemExit(f"Pending folder not found: {pend}")

    front_src, back_src = _find_front_back(pend)

    # Try SKU-suggest first (if requested)
    chosen: Dict[str, Any] | None = None
    if use_sku_suggest:
        cands = sku_suggest(front_src, back_src) or []
        if cands:
            _print_candidates(cands)
            while True:
                choice = input("Pick 1-3 (or 0 to type manually): ").strip()
                if choice.isdigit() and 0 <= int(choice) <= min(3, len(cands)):
                    idx = int(choice)
                    break
                print("Please enter 0, 1, 2, or 3.")
            if idx != 0:
                chosen = _apply_candidate(cands[idx-1])
        else:
            print("ℹ️  No suggestions returned; falling back to manual entry.")

    if chosen is None:
        print("\n== Enter card metadata ==")
        name      = _prompt("Name", "Charizard")
        set_name  = _prompt("Set Name", "Base Set")
        set_code  = _prompt("Set Code", "BS")
        number    = _prompt("Collector Number (no slash)", "4")
        language  = _prompt("Language (EN/JA/DE/FR/...)", "EN").upper()
        rarity    = _prompt("Rarity (Common/Uncommon/Rare/Secret Rare/...)", "Holo Rare")
        holo      = _prompt("Holo? (y/n)", "y").lower().startswith("y")
        condition = _prompt("Condition (NM/LP/MP/HP/DMG)", "NM").upper()
    else:
        # Use suggestion values (still print a one-liner for clarity)
        name      = chosen["name"]
        set_name  = chosen["set_name"]
        set_code  = chosen["set_code"]
        number    = chosen["number"]
        language  = chosen["language"]
        rarity    = chosen["rarity"]
        holo      = chosen["holo"]
        condition = chosen["condition"]
        print(f"\n✅ Using suggestion: {name} — {set_name} [{set_code} #{number} {language}] {rarity} {'Holo' if holo else ''} ({condition})")

    notes = ""

    with connect_db() as conn:
        # Build SKU
        sku = build_sku(conn, language=language, set_code=set_code, number=number, condition=condition)

        # Prepare staged/<SKU>/ and filenames (slash-safe for files)
        staged_dir = project_root() / "staged" / sku
        staged_dir.mkdir(parents=True, exist_ok=True)
        sku_safe = sku.replace("/", "-")
        front_dst = staged_dir / f"{sku_safe}_front{front_src.suffix.lower()}"
        back_dst  = staged_dir / f"{sku_safe}_back{back_src.suffix.lower()}"

        # Move files and update DB
        old_front_rel, old_back_rel = relpath(front_src), relpath(back_src)
        front_src = front_src.rename(front_dst)
        back_src  = back_src.rename(back_dst)
        new_front_rel, new_back_rel = relpath(front_dst), relpath(back_dst)

        front_id = _update_image_row_paths_and_sku(conn, old_front_rel, new_front_rel, sku)
        back_id  = _update_image_row_paths_and_sku(conn, old_back_rel,  new_back_rel,  sku)

        _upsert_card(conn,
            sku=sku, name=name, set_code=set_code, set_name=set_name, number=number, language=language,
            rarity=rarity, holo=1 if holo else 0, condition=condition, notes=notes,
            image_front_id=front_id, image_back_id=back_id
        )

    try:
        pend.rmdir()
    except OSError:
        pass

    print(f"\n✅ Staged {sku}")
    print(f"   → {front_dst.relative_to(project_root())}")
    print(f"   → {back_dst.relative_to(project_root())}")

def list_pending_ids() -> list[str]:
    root = inbox_pending_dir()
    root.mkdir(parents=True, exist_ok=True)
    return sorted([d.name for d in root.iterdir() if d.is_dir()])

def main():
    ap = argparse.ArgumentParser(description="Review pending, prompt minimal metadata, generate SKU, move to staged/")
    ap.add_argument("--uuid", help="Pending UUID to review (folder under inbox/pending). If omitted, review all.")
    ap.add_argument("--sku-suggest", action="store_true", help="Try image-based SKU suggestion before prompting.")  # <— NEW
    args = ap.parse_args()

    ids = [args.uuid] if args.uuid else list_pending_ids()
    if not ids:
        print("No pending items found.")
        return
    for tid in ids:
        print(f"\n== Reviewing {tid} ==")
        review_one(tid, use_sku_suggest=args["sku_suggest"] if isinstance(args, dict) else args.sku_suggest)

if __name__ == "__main__":
    main()
