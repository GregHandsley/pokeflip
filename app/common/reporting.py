from datetime import datetime
from pathlib import Path
from typing import List, Tuple
from .utils import human_size

def print_file_summary(files: List[Path]) -> None:
    if not files:
        print("📂 inbox/unsorted/ is empty (no image files found)."); return
    print(f"📷 Found {len(files)} image file(s) in inbox/unsorted/:")
    print("-" * 88)
    print(f"{'#':>3}  {'Filename':<40}  {'Size':>9}  {'Modified (local time)':>28}")
    print("-" * 88)
    for i, p in enumerate(files, start=1):
        stat = p.stat()
        size = human_size(stat.st_size)
        mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        name = (p.name[:37] + "…") if len(p.name) > 40 else p.name
        print(f"{i:>3}  {name:<40}  {size:>9}  {mtime:>28}")
    print("-" * 88)

def print_pairs_report(pairs: List[Tuple[Path, Path, str]], leftovers: List[Path]) -> None:
    if pairs:
        print(f"🔗 Proposed pairs: {len(pairs)}")
        print("-" * 88)
        print(f"{'#':>3}  {'Left':<34}  {'Right':<34}  {'Reason':<14}")
        print("-" * 88)
        for i, (a, b, reason) in enumerate(pairs, start=1):
            a_name = (a.name[:32] + "…") if len(a.name) > 34 else a.name
            b_name = (b.name[:32] + "…") if len(b.name) > 34 else b.name
            print(f"{i:>3}  {a_name:<34}  {b_name:<34}  {reason:<14}")
        print("-" * 88)
    else:
        print("⚠️  No pairs proposed.")
    if leftovers:
        print(f"\n🧭 Unpaired images: {len(leftovers)}")
        for p in leftovers:
            mtime = datetime.fromtimestamp(p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            print(f"  • {p.name}  ({human_size(p.stat().st_size)}, {mtime})")
    else:
        print("\n✅ No leftovers — all images were paired.")
