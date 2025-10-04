from __future__ import annotations
import io, os, re, binascii
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass
from PIL import Image
import imagehash
from sqlalchemy.orm import Session
from sqlalchemy import select
from apps.api.core.database import SessionLocal
from apps.api.core.settings import settings
from apps.api.models import Image as ImageRow
from apps.api.storage.s3_client import s3_client

FRONT_RE = re.compile(r"(^|[-_])(f|front)([-_.]|$)", re.I)
BACK_RE  = re.compile(r"(^|[-_])(b|back)([-_.]|$)", re.I)
IMG_EXTS = {".jpg",".jpeg",".png",".webp",".bmp"}

# --- Improved pairing heuristics constants ---
BURST_SECONDS = 8           # images shot within this window are one "burst"
BATCH_DUPE_DISTANCE = 3     # phash Hamming distance to treat two shots as near-duplicates

def _ext(name:str)->str:
    i = name.rfind(".")
    return name[i:].lower() if i>=0 else ""

def _side(name:str):
    base = os.path.basename(name).lower()
    if FRONT_RE.search(base): return "front"
    if BACK_RE.search(base): return "back"
    return None

def _stem(name:str)->str:
    base, ext = os.path.splitext(os.path.basename(name).lower())
    base = FRONT_RE.sub("_", base)
    base = BACK_RE.sub("_", base)
    return re.sub(r"[_\-]+$", "", base)

@dataclass
class Pair:
    front_key: str
    back_key: str
    flags: List[str]

def pair_keys(keys: List[str], *, meta: Dict[str, float] = {}, s3=None) -> List[Pair]:
    """
    Improved pairing:
    1) Group shots into time 'bursts' using LastModified timestamps (meta).
    2) Inside each burst, drop near-duplicates (phash Hamming <= BATCH_DUPE_DISTANCE).
    3) Prefer filename side hints; otherwise pair by nearest-in-time, leaving a SINGLETON if odd.
    Note: requires `meta` = { key: unix_ts } and `s3` client to compute phash for duplicate filtering.
    """
    def _phash_for_key(k: str) -> str:
        obj = s3.get_object(Bucket=settings.S3_BUCKET, Key=k)
        data = obj["Body"].read()
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGB")
            return str(imagehash.phash(im))

    # prepare (key, ts) list and sort by time
    items = [(k, meta.get(k, 0.0)) for k in keys if _ext(k) in IMG_EXTS]
    items.sort(key=lambda x: x[1])

    # split into time bursts
    bursts: List[List[str]] = []
    current: List[str] = []
    prev_ts: float | None = None
    for k, ts in items:
        if prev_ts is None or (ts - prev_ts) <= BURST_SECONDS:
            current.append(k)
        else:
            if current:
                bursts.append(current)
            current = [k]
        prev_ts = ts
    if current:
        bursts.append(current)

    pairs: List[Pair] = []

    for burst in bursts:
        # compute phash for in-burst duplicate filtering
        phashes: Dict[str, str] = {}
        for k in burst:
            try:
                phashes[k] = _phash_for_key(k)
            except Exception:
                phashes[k] = ""

        # remove near-duplicates within the burst (keep earliest)
        unique_keys: List[str] = []
        for k in sorted(burst, key=lambda kk: meta.get(kk, 0.0)):
            is_dupe = False
            for kept in unique_keys:
                if phashes.get(k) and phashes.get(kept):
                    if hamming(phashes[k], phashes[kept]) <= BATCH_DUPE_DISTANCE:
                        is_dupe = True
                        break
            if not is_dupe:
                unique_keys.append(k)

        fronts = [k for k in unique_keys if _side(k) == "front"]
        backs  = [k for k in unique_keys if _side(k) == "back"]

        used: set[str] = set()

        def _closest(a: str, pool: List[str]) -> str | None:
            if not pool:
                return None
            pool_sorted = sorted(pool, key=lambda b: abs(meta.get(a, 0.0) - meta.get(b, 0.0)))
            for cand in pool_sorted:
                if cand not in used and cand != a:
                    return cand
            return None

        # pair explicit fronts with closest backs
        for f in sorted(fronts, key=lambda k: meta.get(k, 0.0)):
            if f in used:
                continue
            b = _closest(f, backs)
            if b:
                used.add(f); used.add(b)
                pairs.append(Pair(f, b, flags=["PAIRED_TIME_BURST"]))

        # pair remaining by nearest-in-time, avoiding near-duplicates
        remaining = [k for k in unique_keys if k not in used]
        remaining.sort(key=lambda k: meta.get(k, 0.0))

        i = 0
        while i < len(remaining):
            a = remaining[i]
            if a in used:
                i += 1
                continue
            partner = None
            best_dt = None
            for j in range(i + 1, len(remaining)):
                b = remaining[j]
                if b in used:
                    continue
                dt = abs(meta.get(a, 0.0) - meta.get(b, 0.0))
                pa, pb = phashes.get(a, ""), phashes.get(b, "")
                if pa and pb and hamming(pa, pb) <= BATCH_DUPE_DISTANCE:
                    continue
                if best_dt is None or dt < best_dt:
                    best_dt = dt
                    partner = b
            if partner:
                used.add(a); used.add(partner)
                pairs.append(Pair(a, partner, flags=["PAIRED_TIME_BURST","SIDE_UNKNOWN"]))
            else:
                used.add(a)
                pairs.append(Pair(a, a, flags=["SINGLETON","SIDE_UNKNOWN"]))
            i += 1

    return pairs

def _phash_from_bytes(buf: bytes) -> str:
    with Image.open(io.BytesIO(buf)) as im:
        im = im.convert("RGB")
        return str(imagehash.phash(im))  # hex string

def hamming(a_hex: str, b_hex: str) -> int:
    # imagehash distance works, but we inline to avoid importing heavy pieces here
    try:
        ai = int(a_hex, 16); bi = int(b_hex, 16)
    except Exception:
        return 999
    return (ai ^ bi).bit_count()

def run_ingest(prefix: str = "inbox/unsorted/", dupe_threshold: int = 5) -> Dict[str, Any]:
    """
    Scans S3 prefix, pairs images, computes pHash, flags dupes, inserts Image rows.
    Returns summary stats.
    """
    s3 = s3_client()

    # 1) list objects under prefix (paginated)
    keys: List[str] = []
    meta: Dict[str, float] = {}
    token = None
    while True:
        kwargs = {"Bucket": settings.S3_BUCKET, "Prefix": prefix, "MaxKeys": 1000}
        if token: kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            if _ext(key) in IMG_EXTS:
                keys.append(key)
            # capture last-modified seconds for time-based pairing
            lm = obj.get("LastModified")
            if lm:
                meta[key] = lm.timestamp() if hasattr(lm, "timestamp") else 0.0
            else:
                meta[key] = 0.0
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break

    if not keys:
        return {"pairs": 0, "inserted": 0, "skipped_existing": 0, "dupes_flagged": 0}

    pairs = pair_keys(keys, meta=meta, s3=s3)

    # 2) load existing phashes from DB into memory
    db: Session = SessionLocal()
    try:
        existing: List[Tuple[int, str|None, str|None, str|None, str|None]] = db.execute(
            select(ImageRow.id, ImageRow.key_front, ImageRow.key_back,
                   ImageRow.phash_front, ImageRow.phash_back)
        ).all()

        # 3) process each pair
        inserted = skipped = dupes = 0
        for p in pairs:
            # skip if this exact pair (or front key) already ingested
            already = db.execute(
                select(ImageRow.id).where(ImageRow.key_front==p.front_key)
            ).first()
            if already:
                skipped += 1
                continue

            # download images
            get = lambda k: s3.get_object(Bucket=settings.S3_BUCKET, Key=k)["Body"].read()
            front_bytes = get(p.front_key)
            back_bytes  = get(p.back_key) if p.back_key else None

            # compute phashes
            ph_f = _phash_from_bytes(front_bytes)
            ph_b = _phash_from_bytes(back_bytes) if back_bytes and p.back_key==p.front_key else \
                   (_phash_from_bytes(back_bytes) if back_bytes else None)

            flags = list(p.flags)

            # dupe detection against existing hashes
            def min_dist(ph: str|None) -> int:
                if not ph: return 999
                dists = []
                for _, _, _, e_f, e_b in existing:
                    if e_f: dists.append(hamming(ph, e_f))
                    if e_b: dists.append(hamming(ph, e_b))
                return min(dists) if dists else 999

            d_f = min_dist(ph_f)
            d_b = min_dist(ph_b) if ph_b else 999
            if d_f <= dupe_threshold: flags.append("DUPLICATE_FRONT")
            if ph_b and d_b <= dupe_threshold: flags.append("DUPLICATE_BACK")
            if ("DUPLICATE_FRONT" in flags) or ("DUPLICATE_BACK" in flags):
                dupes += 1

            # insert
            row = ImageRow(
                sku=None,
                key_front=p.front_key,
                key_back=p.back_key if p.back_key else None,
                phash_front=ph_f,
                phash_back=ph_b,
                qa_score=None,
                qa_flags=flags,
            )
            db.add(row)
            db.commit()
            db.refresh(row)

            # add new to existing list to catch dupes within same batch
            existing.append((row.id, row.key_front, row.key_back, row.phash_front, row.phash_back))
            inserted += 1

        return {"pairs": len(pairs), "inserted": inserted, "skipped_existing": skipped, "dupes_flagged": dupes}
    finally:
        db.close()