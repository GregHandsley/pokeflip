# app/pricing/comps.py
from __future__ import annotations
from typing import Dict, Any

def get_comps(card: dict) -> Dict[str, Any]:
    """
    Placeholder for future pricing comps.
    Shape is stable so callers can rely on keys now.
    """
    return {
        "median_sold": None,
        "last_sold": None,
        "n_30d": 0,
    }
