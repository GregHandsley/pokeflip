# app/pipelines/review.py
from __future__ import annotations
from pathlib import Path
import sqlite3
from typing import Tuple, Dict, Any
from app.common.paths import project_root, inbox_pending_dir
from app.storage.db import connect_db, relpath
from app.sku.sku import build_sku

def _find_front_back(folder: Path) -> Tuple[Path, Path]:
    imgs = sorted([p for p in folder.iterdir() if p.is_file()])
    if len(imgs) < 2:
        raise RuntimeError(f"Need two images in {folder}")
    f = next((p for p in imgs if "_front" in p.name.lower()), imgs[0])
    b = next((p for p in imgs if "_back" in p.name.lower()), imgs[1 if imgs[1] != f else -1])
    return f, b

def _update_image_row(conn: sqlite3.Connection, old_rel: str, new_rel: str, sku: str) -> int:
    cur = conn.cursor()
    cur.execute("UPDATE images SET path=?, sku=? WHERE path=?", (new_rel, sku, old_rel))
    conn.commit()
    cur.execute("SELECT id FROM images WHERE path=?", (new_rel,))
    row = cur.fetchone()
    return int(row[0]) if row else 0

def _upsert_card(conn: sqlite3.Connection, **kw) -> None:
    conn.execute("""
    INSERT INTO cards (sku,name,set_code,set_name,number,language,rarity,holo,condition,notes,image_front_id,image_back_id)
    VALUES (:sku,:name,:set_code,:set_name,:number,:language,:rarity,:holo,:condition,:notes,:image_front_id,:image_back_id)
    ON CONFLICT(sku) DO UPDATE SET
      name=excluded.name,set_code=excluded.set_code,set_name=excluded.set_name,number=excluded.number,
      language=excluded.language,rarity=excluded.rarity,holo=excluded.holo,condition=excluded.condition,
      notes=excluded.notes,image_front_id=excluded.image_front_id,image_back_id=excluded.image_back_id
    """, kw)
    conn.commit()

def stage_pending(temp_id: str, meta: Dict[str, Any]) -> str:
    pend = inbox_pending_dir() / temp_id
    if not pend.exists(): raise RuntimeError(f"Pending not found: {pend}")
    front_src, back_src = _find_front_back(pend)
    with connect_db() as conn:
        sku = build_sku(conn,
            language=meta["language"], set_code=meta["set_code"],
            number=str(meta["number"]), condition=meta["condition"]
        )
        staged_dir = project_root() / "staged" / sku
        staged_dir.mkdir(parents=True, exist_ok=True)
        sku_safe = sku.replace("/", "-")
        front_dst = staged_dir / f"{sku_safe}_front{front_src.suffix.lower()}"
        back_dst  = staged_dir / f"{sku_safe}_back{back_src.suffix.lower()}"

        of, ob = relpath(front_src), relpath(back_src)
        front_src.rename(front_dst); back_src.rename(back_dst)
        nf, nb = relpath(front_dst), relpath(back_dst)
        front_id = _update_image_row(conn, of, nf, sku)
        back_id  = _update_image_row(conn, ob, nb, sku)

        _upsert_card(conn,
            sku=sku, name=meta["name"], set_code=meta["set_code"], set_name=meta["set_name"],
            number=str(meta["number"]), language=meta["language"],
            rarity=meta.get("rarity",""), holo=1 if meta.get("holo") else 0,
            condition=meta["condition"], notes=meta.get("notes",""),
            image_front_id=front_id, image_back_id=back_id
        )
    try: pend.rmdir()
    except OSError: pass
    return sku
