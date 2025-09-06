import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from .imaging import image_size

FRONT_TOKENS = {"front", "f", "obv", "obverse"}
BACK_TOKENS  = {"back", "b", "rev", "reverse"}
_token_splitter = re.compile(r"[_\-\s\.]+")

def normalize_stem(name: str) -> str:
    base = name.rsplit(".", 1)[0].lower()
    parts = [t for t in _token_splitter.split(base) if t]
    filtered = []
    for t in parts:
        if t in FRONT_TOKENS or t in BACK_TOKENS:
            continue
        if t.isdigit():
            continue
        filtered.append(t)
    return "-".join(filtered)

def detect_side(name: str) -> Optional[str]:
    base = name.rsplit(".", 1)[0].lower()
    tokens = set(_token_splitter.split(base))
    if tokens & FRONT_TOKENS: return "front"
    if tokens & BACK_TOKENS:  return "back"
    return None

def group_by_stem(files: List[Path]) -> Dict[str, List[Path]]:
    groups: Dict[str, List[Path]] = {}
    for p in files:
        stem = normalize_stem(p.name)
        groups.setdefault(stem, []).append(p)
    return groups

def pair_by_name(groups: Dict[str, List[Path]]) -> Tuple[List[Tuple[Path, Path, str]], List[Path]]:
    pairs: List[Tuple[Path, Path, str]] = []
    leftovers: List[Path] = []
    for _, paths in groups.items():
        if len(paths) == 1:
            leftovers.extend(paths); continue
        front = [p for p in paths if detect_side(p.name) == "front"]
        back  = [p for p in paths if detect_side(p.name) == "back"]
        if front and back:
            f = sorted(front, key=lambda p: p.stat().st_mtime)[-1]
            b = sorted(back,  key=lambda p: p.stat().st_mtime)[-1]
            pairs.append((f, b, "name"))
            used = {f, b}
            leftovers.extend([p for p in paths if p not in used])
        else:
            if len(paths) >= 2:
                cands = sorted(paths, key=lambda p: p.stat().st_mtime)[-2:]
                pairs.append((cands[0], cands[1], "name-weak"))
                used = set(cands)
                leftovers.extend([p for p in paths if p not in used])
            else:
                leftovers.extend(paths)
    return pairs, leftovers

def pair_by_time(files: List[Path], time_window: int = 30) -> Tuple[List[Tuple[Path, Path, str]], List[Path]]:
    unpaired = set(files)
    pairs: List[Tuple[Path, Path, str]] = []
    sizes = {p: image_size(p) for p in files}
    sorted_files = sorted(files, key=lambda p: p.stat().st_mtime)

    for i, p in enumerate(sorted_files):
        if p not in unpaired: continue
        t1 = p.stat().st_mtime
        best = None; best_dt = None
        for q in sorted_files[i+1:i+6]:
            if q not in unpaired: continue
            dt = abs(q.stat().st_mtime - t1)
            if dt > time_window: break
            (w1, h1), (w2, h2) = sizes[p], sizes[q]
            if w1 and h1 and w2 and h2:
                area1, area2 = w1*h1, w2*h2
                ratio = min(area1, area2) / max(area1, area2)
                if ratio < 0.85:  # too different
                    continue
            best = q; best_dt = dt
        if best is not None:
            pairs.append((p, best, f"time({int(best_dt)}s)"))
            unpaired.discard(p); unpaired.discard(best)

    leftovers = list(unpaired)
    return pairs, leftovers
