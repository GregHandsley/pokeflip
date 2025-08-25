import argparse
from typing import List
from pathlib import Path

from .paths import inbox_unsorted_dir, project_root
from .imaging import is_image_file, compute_phash
from .db import (
    connect_db, ensure_images_table, relpath, upsert_image_record,
    get_phash_by_path, find_duplicates_by_phash
)
from .staging import move_pairs_to_pending
from .pairing import group_by_stem, pair_by_name, pair_by_time
from .reporting import print_file_summary, print_pairs_report
from .logger import log_duplicate_skipped


def scan_unsorted(include_hidden: bool = False) -> List[Path]:
    root = inbox_unsorted_dir()
    root.mkdir(parents=True, exist_ok=True)
    files = [p for p in root.iterdir() if is_image_file(p) and (include_hidden or not p.name.startswith("."))]
    files.sort(key=lambda p: p.stat().st_mtime)
    return files


def index_images(files: List[Path]) -> None:
    conn = connect_db()
    ensure_images_table(conn)
    inserted = updated = unchanged = skipped = 0
    for p in files:
        ph = compute_phash(p)
        if ph is None:
            skipped += 1
            continue
        status = upsert_image_record(conn, relpath(p), ph)
        if status == "inserted":
            inserted += 1
        elif status == "updated":
            updated += 1
        elif status == "unchanged":
            unchanged += 1
    conn.close()
    print(f"🧮 Indexed images → inserted: {inserted}, updated: {updated}, unchanged: {unchanged}, skipped: {skipped}")


def filter_duplicates(files: List[Path], allow_duplicates: bool = False):
    """
    Return (safe_files, dupes_map).
    Only flags as duplicates if a same-pHash image exists OUTSIDE this current batch.
    """
    if allow_duplicates:
        return files, {}

    conn = connect_db()
    dupes = {}
    safe: List[Path] = []
    try:
        current_paths = {relpath(p) for p in files}
        for p in files:
            path_rel = relpath(p)
            ph = get_phash_by_path(conn, path_rel)
            if not ph:
                safe.append(p)
                continue
            rows = find_duplicates_by_phash(conn, phash_hex=ph, exclude_path=path_rel)
            prior_rows = [(other_path, other_sku) for (other_path, other_sku) in rows if other_path not in current_paths]
            if prior_rows:
                dupes[p] = prior_rows
            else:
                safe.append(p)
    finally:
        conn.close()
    return safe, dupes


def print_duplicates_warning(dupes_map):
    if not dupes_map:
        return
    print("\n🚩 Potential duplicates detected (same pHash) — these will be skipped:")
    for p, rows in dupes_map.items():
        print(f"  • {p.name}")
        for (other_path, other_sku) in rows[:5]:
            suffix = f"  (SKU {other_sku})" if other_sku else ""
            print(f"      ↳ seen as: {other_path}{suffix}")
        if len(rows) > 5:
            print(f"      … and {len(rows)-5} more")


def write_duplicates_log(dupes_map):
    if not dupes_map:
        return
    conn = connect_db()
    try:
        for p, rows in dupes_map.items():
            path_rel = relpath(p)
            ph = get_phash_by_path(conn, path_rel) or ""
            log_duplicate_skipped(path_rel, ph, rows)
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Ingest: scan, index (pHash), pair, and optionally stage to pending."
    )
    parser.add_argument("--include-hidden", action="store_true", help="Include dotfiles.")
    parser.add_argument("--time-window", type=int, default=30, help="Seconds for time-based pairing (default 30).")
    parser.add_argument("--mode", choices=["auto", "name", "time"], default="auto", help="Pairing mode.")
    parser.add_argument(
        "--stage",
        action="store_true",
        help="Move paired images into inbox/pending/<UUID>/ and update DB paths.",
    )
    parser.add_argument(
        "--allow-duplicates",
        action="store_true",
        help="Include files with duplicate pHash in pairing/staging (default is to skip them).",
    )
    args = parser.parse_args()

    files = scan_unsorted(include_hidden=args.include_hidden)
    print_file_summary(files)
    if not files:
        return

    # Index images (pHash -> DB)
    index_images(files)

    # Duplicate check
    candidate_files, dupes_map = filter_duplicates(files, allow_duplicates=args.allow_duplicates)
    print_duplicates_warning(dupes_map)
    write_duplicates_log(dupes_map)  # <-- log the decision
    if not candidate_files:
        print("\n⚠️  All files were flagged as duplicates. Nothing to pair/stage.")
        return

    # Pair
    groups = group_by_stem(candidate_files)
    if args.mode in ("auto", "name"):
        name_pairs, leftovers = pair_by_name(groups)
        if args.mode == "name":
            print_pairs_report(name_pairs, leftovers)
            pairs = name_pairs
        else:
            time_pairs, leftovers2 = pair_by_time(leftovers, time_window=args.time_window)
            pairs = name_pairs + time_pairs
            print_pairs_report(pairs, leftovers2)
    else:
        time_pairs, leftovers = pair_by_time(candidate_files, time_window=args.time_window)  # <-- use candidate_files
        pairs = time_pairs
        print_pairs_report(pairs, leftovers)

    # Stage to pending if requested
    if args.stage and pairs:
        conn = connect_db()
        try:
            staged = move_pairs_to_pending(pairs, conn=conn)
        finally:
            conn.close()

        print(f"\n📦 Moved {len(staged)} pair(s) to inbox/pending/:")
        for temp_id, pa, pb in staged:
            print(f"  • {temp_id}/")
            print(f"      - {pa.relative_to(project_root())}")
            print(f"      - {pb.relative_to(project_root())}")


if __name__ == "__main__":
    main()
