import re
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from apps.api.models import Card

SAFE = re.compile(r"[^A-Za-z0-9]+")

def slug(s: str, max_len: int = 16) -> str:
    s = SAFE.sub("-", s or "").strip("-").upper()
    return s[:max_len] or "UNK"

def set_code(set_name: str) -> str:
    # Take alnum initials and first 3 letters; fallback to slug
    initials = "".join([w[0] for w in re.findall(r"[A-Za-z0-9]+", set_name or "")])[:4]
    base = (initials or slug(set_name, 4)).upper()
    return base

def condition_code(cond: Optional[str]) -> str:
    m = {"NM":"NM","LP":"LP","MP":"MP","HP":"HP","DMG":"DMG","GD":"GD"}
    c = (cond or "").upper()
    return m.get(c, "UNK")

def lang_code(lang: Optional[str]) -> str:
    m = {"EN":"EN","JP":"JP","DE":"DE","FR":"FR","ES":"ES","IT":"IT"}
    return m.get((lang or "").upper(), "EN")

def variant_code(holo: Optional[bool]) -> str:
    return "H" if holo else "N"

def make_candidate(set_name: str, number: str, lang: str, cond: str, holo: bool) -> str:
    return f"{set_code(set_name)}-{slug(number, 8)}-{lang_code(lang)}-{condition_code(cond)}-{variant_code(holo)}"

def ensure_unique(db: Session, candidate: str) -> str:
    # If exists, append -A, -B, ... then -2, -3 ...
    suffix = None
    tries = 0
    while True:
        sku = f"{candidate}-{suffix}" if suffix else candidate
        exists = db.execute(select(Card.sku).where(Card.sku == sku)).first()
        if not exists:
            return sku
        tries += 1
        if tries <= 26:
            suffix = chr(64 + tries)  # A, B, ...
        else:
            suffix = str(tries - 26)