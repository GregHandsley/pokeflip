# app/ops/state_watcher.py
from __future__ import annotations
import argparse, time, shutil
from pathlib import Path

from app.storage.db import connect_db
from app.common.paths import project_root

# ---------- paths ----------
def _folder(root: str, sku: str) -> Path:
    return project_root() / root / sku

# ---------- DB helpers ----------
def _update_image_paths_after_move(sku: str, old_root: str, new_root: str) -> None:
    old_prefix = f"{old_root}/{sku}/"
    new_prefix = f"{new_root}/{sku}/"
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE images SET path = REPLACE(path, ?, ?) WHERE path LIKE ?;",
            (old_prefix, new_prefix, old_prefix + "%"),
        )
        cur.execute(
            "UPDATE images SET sku = COALESCE(sku, ?) WHERE path LIKE ?;",
            (sku, new_prefix + "%"),
        )
        conn.commit()

def active_skus() -> list[str]:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT sku FROM listings WHERE status='active';")
        return [r[0] for r in cur.fetchall()]

def sold_skus() -> list[str]:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT sku FROM listings WHERE status='sold';")
        return [r[0] for r in cur.fetchall()]

# ---------- movers ----------
def _move(sku: str, old_root: str, new_root: str, *, dry_run: bool = False) -> str | None:
    src = _folder(old_root, sku)
    dst = _folder(new_root, sku)
    if not src.exists() or not src.is_dir():
        return None
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return f"⚠️  {sku}: destination already exists; skipping"
    if dry_run:
        return f"DRY-RUN: would move {src} → {dst}"
    shutil.move(str(src), str(dst))
    _update_image_paths_after_move(sku, old_root, new_root)
    return f"📦 moved {sku}: {old_root} → {new_root}"

def move_if_active(sku: str, *, dry_run: bool = False) -> str | None:
    """staged → listed (when listing is active)"""
    return _move(sku, "staged", "listed", dry_run=dry_run)

def move_if_sold(sku: str, *, dry_run: bool = False) -> str | None:
    """listed → sold (when listing is sold)"""
    return _move(sku, "listed", "sold", dry_run=dry_run)

# ---------- watcher loop ----------
def loop(interval: float, once: bool, dry_run: bool) -> None:
    while True:
        moved = 0
        for sku in active_skus():
            msg = move_if_active(sku, dry_run=dry_run)
            if msg:
                print(msg)
                if not msg.startswith(("⚠️", "DRY-RUN")):
                    moved += 1
        for sku in sold_skus():
            msg = move_if_sold(sku, dry_run=dry_run)
            if msg:
                print(msg)
                if not msg.startswith(("⚠️", "DRY-RUN")):
                    moved += 1
        if once:
            print(f"✅ watcher pass complete; moved {moved} folder(s).")
            return
        time.sleep(interval)

def main():
    ap = argparse.ArgumentParser(description="Move folders based on listing status.")
    ap.add_argument("--interval", type=float, default=2.0, help="Seconds between checks.")
    ap.add_argument("--once", action="store_true", help="Run a single scan and exit.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    loop(args.interval, args.once, args.dry_run)

if __name__ == "__main__":
    main()
