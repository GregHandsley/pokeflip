# app/staging.py
from __future__ import annotations
from pathlib import Path
from uuid import uuid4
from typing import List, Tuple

from .paths import inbox_pending_dir, project_root
from .pairing import detect_side
from .db import relpath, update_image_path

def _unique_path(base: Path) -> Path:
    """If base exists, add -1, -2, ... until free."""
    if not base.exists():
        return base
    stem = base.stem
    suffix = base.suffix
    parent = base.parent
    i = 1
    while True:
        cand = parent / f"{stem}-{i}{suffix}"
        if not cand.exists():
            return cand
        i += 1

def move_pairs_to_pending(
    pairs: List[Tuple[Path, Path, str]],
    *, conn
) -> list[tuple[str, Path, Path]]:
    """
    Move each (front, back) pair into inbox/pending/<UUID>/.
    Filenames become <UUID>_front.jpg / _back.jpg when detectable, else _a / _b.
    Updates images.path in DB.
    Returns list of (temp_id, dest_a, dest_b).
    """
    results: list[tuple[str, Path, Path]] = []
    pending_root = inbox_pending_dir()
    pending_root.mkdir(parents=True, exist_ok=True)

    for a, b, _reason in pairs:
        temp_id = uuid4().hex[:12]
        dest_dir = pending_root / temp_id
        dest_dir.mkdir(parents=True, exist_ok=False)

        side_a = detect_side(a.name)
        side_b = detect_side(b.name)

        label_a = "front" if side_a == "front" else ("back" if side_a == "back" else "a")
        label_b = "front" if side_b == "front" else ("back" if side_b == "back" else "b")

        # If both guessed same label, force distinct labels
        if label_a == label_b:
            label_b = "back" if label_a == "front" else ("b" if label_a == "a" else "a")

        dest_a = _unique_path(dest_dir / f"{temp_id}_{label_a}{a.suffix.lower()}")
        dest_b = _unique_path(dest_dir / f"{temp_id}_{label_b}{b.suffix.lower()}")

        # Move on filesystem
        old_a = a
        old_b = b
        a = a.rename(dest_a)
        b = b.rename(dest_b)

        # Update DB image paths (stored relative to project root)
        old_a_rel = relpath(old_a)
        old_b_rel = relpath(old_b)
        new_a_rel = relpath(a)
        new_b_rel = relpath(b)
        update_image_path(conn, old_a_rel, new_a_rel)
        update_image_path(conn, old_b_rel, new_b_rel)

        results.append((temp_id, a, b))

    return results
