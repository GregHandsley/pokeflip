# app/ops/state_watcher.py
from __future__ import annotations
import argparse, time, shutil
from pathlib import Path
from app.storage.db import connect_db
from app.common.paths import project_root

def staged_dir(sku: str) -> Path:
    return project_root() / "staged" / sku

def listed_dir(sku: str) -> Path:
    return project_root() / "listed" / sku

def active_skus() -> list[str]:
    with connect_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT sku FROM listings WHERE status='active';")
        return [r[0] for r in cur.fetchall()]

def move_if_ready(sku: str, dry_run=False) -> str | None:
    src = staged_dir(sku)
    dst = listed_dir(sku)
    if not src.exists() or not src.is_dir():
        return None
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return f"⚠️  {sku}: destination already exists; skipping"
    if dry_run:
        return f"DRY-RUN: would move {src} → {dst}"
    shutil.move(str(src), str(dst))
    return f"📦 moved {sku}: staged → listed"

def loop(interval: float, once: bool, dry_run: bool):
    while True:
        moved = 0
        for sku in active_skus():
            msg = move_if_ready(sku, dry_run=dry_run)
            if msg:
                print(msg)
                if not msg.startswith("⚠️") and not msg.startswith("DRY-RUN"):
                    moved += 1
        if once:
            print(f"✅ watcher pass complete; moved {moved} folder(s).")
            return
        time.sleep(interval)

def main():
    ap = argparse.ArgumentParser(description="Move staged/<SKU>/ → listed/<SKU>/ for active listings.")
    ap.add_argument("--interval", type=float, default=2.0, help="Seconds between checks.")
    ap.add_argument("--once", action="store_true", help="Run a single scan and exit.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    loop(args.interval, args.once, args.dry_run)

if __name__ == "__main__":
    main()

def update_image_paths_after_move(sku: str, old_root="staged", new_root="listed"):
    old_prefix = f"{old_root}/{sku}/"
    new_prefix = f"{new_root}/{sku}/"
    with connect_db() as conn:
        cur = conn.cursor()
        # Update the stored file paths
        cur.execute(
            "UPDATE images SET path = REPLACE(path, ?, ?) WHERE path LIKE ?;",
            (old_prefix, new_prefix, old_prefix + "%"),
        )
        # Ensure images are associated to the SKU
        cur.execute(
            "UPDATE images SET sku = COALESCE(sku, ?) WHERE path LIKE ?;",
            (sku, new_prefix + "%"),
        )
        conn.commit()

def move_if_ready(sku: str, dry_run=False) -> str | None:
    src = staged_dir(sku)
    dst = listed_dir(sku)
    if not src.exists() or not src.is_dir():
        return None
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return f"⚠️  {sku}: destination already exists; skipping"
    if dry_run:
        return f"DRY-RUN: would move {src} → {dst}"
    shutil.move(str(src), str(dst))
    update_image_paths_after_move(sku)   # ← update DB after successful move
    return f"📦 moved {sku}: staged → listed"