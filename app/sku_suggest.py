# app/sku_suggest.py
from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any

def suggest(front_path: Path, back_path: Path) -> List[Dict[str, Any]]:
    """
    FUTURE: return ranked metadata candidates inferred from the images.

    Expected shape (example for later):
    [
      {
        "name": "Charizard",
        "set_name": "Base Set",
        "set_code": "BS",
        "number": "4",
        "language": "EN",
        "rarity": "Holo Rare",
        "holo": True,
        "condition": "NM",
        "confidence": 0.93,
      },
      ...
    ]

    For now we return an empty list so the CLI falls back to manual entry.
    """
    return []
