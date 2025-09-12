from __future__ import annotations
from pathlib import Path
from typing import Any, Dict
import yaml

from .paths import project_root

def _read_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        return {}
    return data

def load_fees() -> Dict[str, float]:
    """Returns dict with keys: ebay_final_value_pct, ebay_fixed_fee, payment_pct."""
    return _read_yaml(project_root() / "config" / "fees.yaml")

def load_consumables() -> Dict[str, float]:
    """Returns per-unit costs for packaging items."""
    return _read_yaml(project_root() / "config" / "consumables.yaml")
