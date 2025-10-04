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

def pair_keys(keys: List[str]) -> List[Pair]:
    # Heuristic 1: by normalized stem with explicit side markers
    buckets: Dict[str, Dict[str,str]] = {}
    leftovers: List[str] = []
    for k in keys:
        if _ext(k) not in IMG_EXTS: continue
        s = _side(k)
        if s:
            buckets.setdefault(_stem(k), {})
            buckets[_stem(k)][s] = k
        else:
            leftovers.append(k)

    pairs: List[Pair] = []
    for stem, sides in buckets.items():
        if "front" in sides and "back" in sides:
            pairs.append(Pair(sides["front"], sides["back"], flags=["PAIRED_BY_STEM"]))
        else:
            # push any singletons into leftovers
            leftovers.extend(list(sides.values()))

    # Heuristic 2: pair leftovers sequentially
    leftovers.sort()
    for i in range(0, len(leftovers), 2):
        if i+1 < len(leftovers):
            pairs.append(Pair(leftovers[i], leftovers[i+1], flags=["PAIRED_SEQUENTIAL","SIDE_UNKNOWN"]))
        else:
            # odd tail: treat as single; put as front only (will still show in pending)
            pairs.append(Pair(leftovers[i], leftovers[i], flags=["SINGLETON","SIDE_UNKNOWN"]))

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
    token = None
    while True:
        kwargs = {"Bucket": settings.S3_BUCKET, "Prefix": prefix, "MaxKeys": 1000}
        if token: kwargs["ContinuationToken"] = token
        resp = s3.list_objects_v2(**kwargs)
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            if _ext(key) in IMG_EXTS:
                keys.append(key)
        if resp.get("IsTruncated"):
            token = resp.get("NextContinuationToken")
        else:
            break

    if not keys:
        return {"pairs": 0, "inserted": 0, "skipped_existing": 0, "dupes_flagged": 0}

    pairs = pair_keys(keys)

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