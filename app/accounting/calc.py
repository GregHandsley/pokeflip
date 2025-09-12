from __future__ import annotations
from typing import Dict, Iterable, Tuple
from decimal import Decimal, ROUND_HALF_UP

from app.common.config import load_consumables

STANDARD_ENVELOPE_ITEMS: Tuple[str, ...] = (
    "penny_sleeve",
    "top_loader",
    "team_bag",
    "rigid_mailer",
    "label",
    "envelope",
)

def _to_money(x: float | int | str | Decimal) -> Decimal:
    d = x if isinstance(x, Decimal) else Decimal(str(x))
    return d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

def estimate_consumables_cost(
    items: Iterable[str] = STANDARD_ENVELOPE_ITEMS,
    overrides: Dict[str, float] | None = None,
) -> Decimal:
    costs = load_consumables()
    if overrides:
        costs = {**costs, **overrides}

    total = Decimal("0")
    for key in items:
        val = costs.get(key)
        if val is not None:
            total += _to_money(val)
    return _to_money(total)
