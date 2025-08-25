from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
import imagehash

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tif", ".tiff"}

def is_image_file(p: Path) -> bool:
    return p.is_file() and p.suffix.lower() in IMAGE_EXTS

def compute_phash(p: Path) -> Optional[str]:
    try:
        with Image.open(p) as im:
            im = im.convert("RGB")
            return str(imagehash.phash(im))  # hex string
    except Exception:
        return None

def image_size(p: Path) -> Tuple[int, int]:
    try:
        with Image.open(p) as im:
            return im.size  # (w, h)
    except Exception:
        return (0, 0)
