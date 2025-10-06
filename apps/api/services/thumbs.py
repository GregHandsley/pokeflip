from __future__ import annotations
import io, os, hashlib
from typing import Tuple, Dict, Optional
from PIL import Image, ImageOps, ImageFilter
from apps.api.storage.s3_client import s3_client
from apps.api.core.settings import settings

# 3:4 aspect presets (width, height)
PRESETS: Dict[str, Tuple[int, int]] = {
    "list": (352, 469),   # Cards grid
    "detail": (512, 682), # Card detail pane
    "zoom": (1024, 1365), # Lightbox
}
BG = (246, 247, 248)     # neutral pad (uses your tokens' vibe)

def _dst_key(src_key: str, size: Tuple[int,int], fmt: str, v: int = 1) -> str:
    base, _ = os.path.splitext(src_key)
    sig = hashlib.md5(f"{base}-{size[0]}x{size[1]}-v{v}".encode()).hexdigest()[:8]
    ext = "webp" if fmt == "webp" else "jpg"
    return f"thumbs/{base}_{size[0]}x{size[1]}_{sig}.{ext}"

def _make_thumb(data: bytes, size: Tuple[int,int]) -> Image.Image:
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert("RGB")        # autorotate
    # Smart sharpen a touch, then pad to exact 3:4
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=3))
    return ImageOps.pad(im, size, method=Image.Resampling.LANCZOS, color=BG)

def _put(s3, key: str, im: Image.Image, fmt: str):
    buf = io.BytesIO()
    if fmt == "webp":
        im.save(buf, format="WEBP", quality=82, method=6)
        ct = "image/webp"
    else:
        im.save(buf, format="JPEG", quality=85, optimize=True, progressive=True)
        ct = "image/jpeg"
    buf.seek(0)
    s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=buf.getvalue(), ContentType=ct)

def ensure_thumbs(src_key: str) -> Dict[str, Dict[str, str]]:
    """
    Returns object keys for jpeg/webp variants across presets:
    {
      'list':   {'webp': 'thumbs/...webp', 'jpeg': 'thumbs/...jpg'},
      'detail': {'webp': '...', 'jpeg': '...'},
      'zoom':   {'webp': '...', 'jpeg': '...'}
    }
    """
    s3 = s3_client()

    # fetch original
    obj = s3.get_object(Bucket=settings.S3_BUCKET, Key=src_key)
    data = obj["Body"].read()

    out: Dict[str, Dict[str, str]] = {}
    for name, sz in PRESETS.items():
        webp_key = _dst_key(src_key, sz, "webp")
        jpg_key  = _dst_key(src_key, sz, "jpeg")

        # create only if missing
        def _exists(key: str) -> bool:
            try:
                s3.head_object(Bucket=settings.S3_BUCKET, Key=key); return True
            except Exception:
                return False

        if not (_exists(webp_key) and _exists(jpg_key)):
            im = _make_thumb(data, sz)
            if not _exists(webp_key):
                try: _put(s3, webp_key, im, "webp")
                except Exception: pass
            if not _exists(jpg_key):
                _put(s3, jpg_key, im, "jpeg")

        out[name] = {"webp": webp_key, "jpeg": jpg_key}
    return out