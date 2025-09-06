from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.common.paths import project_root

_LANG_NAMES = {
    "EN":"English","JA":"Japanese","FR":"French","DE":"German",
    "ES":"Spanish","IT":"Italian","PT":"Portuguese","ZH":"Chinese","KO":"Korean"
}

def language_name(code: str) -> str:
    return _LANG_NAMES.get((code or "").upper(), code or "English")

def _holo_tag(card: Dict[str, Any]) -> str:
    rarity = (card.get("rarity") or "").lower()
    if "reverse" in rarity: return "Reverse Holo"
    if "holo" in rarity or bool(card.get("holo")): return "Holo"
    name = (card.get("name") or "")
    if name.endswith(" V") or " V" in name: return "V"
    return ""

def build_title(card: Dict[str, Any]) -> str:
    # Pokémon – {set_name} {name} #{number}/{set_size?} {holo_tag} – {condition} – {Language}
    set_name = card.get("set_name") or "TCG"
    name = card.get("name") or "Pokemon Card"
    number = str(card.get("number") or "")
    set_size = str(card.get("set_size") or "").strip()
    number_full = f"{number}/{set_size}" if set_size else number
    parts = ["Pokémon", "–", f"{set_name} {name}", f"#{number_full}"]
    ht = _holo_tag(card)
    if ht: parts.append(ht)
    parts += ["–", (card.get("condition") or "NM").upper(), "–", language_name(card.get("language") or "EN")]
    return " ".join(" ".join(p for p in parts if p).split())

def render_description(card: Dict[str, Any], template_path: Optional[Path] = None) -> str:
    tpl_dir = project_root() / "templates"
    template_path = template_path or (tpl_dir / "description.md.j2")
    env = Environment(
        loader=FileSystemLoader(str(template_path.parent)),
        autoescape=select_autoescape(enabled_extensions=("html","xml"))
    )
    tpl = env.get_template(template_path.name)
    ctx = {
        "card": card,
        "holo_tag": _holo_tag(card),
        "language_name": language_name(card.get("language") or "EN"),
        "number_full": f"{card.get('number')}/{card.get('set_size')}" if card.get("set_size") else str(card.get("number") or ""),
    }
    return tpl.render(**ctx)
