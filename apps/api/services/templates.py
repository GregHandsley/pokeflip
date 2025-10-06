from __future__ import annotations
from pathlib import Path
from typing import Dict, Any
from jinja2 import Environment, FileSystemLoader, TemplateNotFound

from apps.api.models import Card

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
)

DEFAULT_TITLE_TMPL = "{{ name }} #{{ number }} – {{ set }}{% if holo %} Holo{% endif %} ({{ language }}, {{ condition }}) · SKU: {{ sku }}"
DEFAULT_DESC_TMPL = """
{{ name }} • {{ set }} • #{{ number }}{% if holo %} • Holo{% endif %} • {{ language }} • {{ condition }}

Condition
- This card is graded internally as **{{ condition }}** (see photos).
- Please review images before purchase.

Details
- Set: {{ set }}
- Number: {{ number }}
- Language: {{ language }}
- Variant: {% if holo %}Holo{% else %}Normal{% endif %}
- SKU: {{ sku }}

Shipping
- Cards ship sleeved & protected.
- Combined shipping available.

Notes
- Minor factory lines/printing defects can occur.
""".strip()

def _ctx(card: Card) -> Dict[str, Any]:
    # Build template context from Card model
    return {
        "sku": card.sku,
        "name": card.name,
        "set": card.set,
        "number": card.number,
        "language": card.language,
        "condition": card.condition,
        "holo": bool(card.holo),
    }

def render_title(card: Card) -> str:
    try:
        tmpl = _env.get_template("listing_title.j2")
        return tmpl.render(**_ctx(card)).strip()
    except TemplateNotFound:
        return _env.from_string(DEFAULT_TITLE_TMPL).render(**_ctx(card)).strip()

def render_description(card: Card) -> str:
    try:
        tmpl = _env.get_template("listing_description.j2")
        return tmpl.render(**_ctx(card)).strip()
    except TemplateNotFound:
        return _env.from_string(DEFAULT_DESC_TMPL).render(**_ctx(card)).strip()