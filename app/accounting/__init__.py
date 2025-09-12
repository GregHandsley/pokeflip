# app/accounting/__init__.py
from __future__ import annotations
from pathlib import Path
from typing import Iterable
import yaml

from app.common.paths import project_root

# default parts for a standard envelope shipment
DEFAULT_ITEMS: tuple[str, ...] = (
    "penny_sleeve", "top_loader", "team_bag", "rigid_mailer", "label", "envelope"
)

def _load_yaml(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing config file: {path}")
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

def estimate_consumables_cost(
    items: Iterable[str] | None = None,
    config_path: Path | None = None,
    profile: str = "standard_envelope",
) -> float:
    """
    Sum per-unit costs from config/consumables.yaml.
    - Supports either a flat mapping of item->price, or profiles:
        profiles:
          standard_envelope:
            penny_sleeve: 0.01
            ...
    """
    cfg = config_path or (project_root() / "config" / "consumables.yaml")
    data = _load_yaml(cfg)

    # Flat file (top-level keys) or profile-based
    if isinstance(data, dict) and all(isinstance(v, (int, float)) for v in data.values()):
        price_map = data
    else:
        price_map = (
            data.get("profiles", {}).get(profile)
            or data.get(profile)  # allow top-level profile block
            or {}
        )

    parts = list(items or DEFAULT_ITEMS)
    total = 0.0
    for k in parts:
        v = price_map.get(k, 0)
        total += float(v)
    return round(total, 2)

__all__ = ["estimate_consumables_cost"]
