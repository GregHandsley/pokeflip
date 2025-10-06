from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from apps.api.core.database import SessionLocal
from apps.api.models import Card, Image as ImageRow
from apps.api.storage.s3_client import presign_get
from apps.api.services.templates import render_title, render_description
from apps.api.services.thumbs import ensure_thumbs

router = APIRouter(prefix="/cards", tags=["cards"])


@router.get("")
def list_cards():
    db: Session = SessionLocal()
    try:
        rows = db.execute(
            select(
                Card.sku, Card.name, Card.set, Card.number,
                Card.language, Card.condition, Card.holo,
                ImageRow.key_front, ImageRow.key_back
            ).join(ImageRow, ImageRow.sku == Card.sku, isouter=True)
            .order_by(Card.created_at.desc())
        ).all()

        items = []
        for sku, name, set_, number, language, condition, holo, kf, kb in rows:
            front = ensure_thumbs(kf) if kf else None
            back  = ensure_thumbs(kb) if kb else None

            def urls(bundle):  # presign both formats for <picture>
                return {
                    "list":   {fmt: presign_get(key) for fmt, key in bundle["list"].items()},
                    "detail": {fmt: presign_get(key) for fmt, key in bundle["detail"].items()},
                    "zoom":   {fmt: presign_get(key) for fmt, key in bundle["zoom"].items()},
                }

            items.append({
                "sku": sku,
                "name": name,
                "set": set_,
                "number": number,
                "language": language,
                "condition": condition,
                "holo": bool(holo),
                "thumbs": {
                    "front": urls(front) if front else None,
                    "back":  urls(back)  if back  else None,
                }
            })
        return {"items": items}
    finally:
        db.close()

@router.get("/{sku}")
def get_card_detail(sku: str):
    db: Session = SessionLocal()
    try:
        c: Card | None = db.execute(select(Card).where(Card.sku == sku)).scalar_one_or_none()
        if not c:
            raise HTTPException(status_code=404, detail="Card not found")
        img = db.execute(select(ImageRow).where(ImageRow.sku == sku)).scalar_one_or_none()

        f = ensure_thumbs(img.key_front) if img and img.key_front else None
        b = ensure_thumbs(img.key_back)  if img and img.key_back  else None

        def urls(bundle):
            return {
                "list":   {fmt: presign_get(key) for fmt, key in bundle["list"].items()},
                "detail": {fmt: presign_get(key) for fmt, key in bundle["detail"].items()},
                "zoom":   {fmt: presign_get(key) for fmt, key in bundle["zoom"].items()},
            } if bundle else None

        return {
            "sku": c.sku,
            "name": c.name,
            "set": c.set,
            "number": c.number,
            "language": c.language,
            "condition": c.condition,
            "holo": bool(c.holo),
            "thumbs": {
                "front": urls(f),
                "back":  urls(b),
            },
            # keep existing templated fields
            "title": render_title(c),
            "description": render_description(c),
        }
    finally:
        db.close()