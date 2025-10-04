from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import select
from apps.api.core.database import SessionLocal
from apps.api.models import Card, Image as ImageRow
from apps.api.storage.s3_client import presign_get

router = APIRouter(prefix="/cards", tags=["cards"])

@router.get("")
def list_cards(limit: int = 100):
    db: Session = SessionLocal()
    try:
        # join to images to get front key for thumbnail
        q = (
            db.query(Card, ImageRow)
            .join(ImageRow, ImageRow.sku == Card.sku, isouter=True)
            .order_by(Card.sku.asc())
            .limit(limit)
            .all()
        )
        out = []
        for c, img in q:
            thumb = presign_get(img.key_front) if img and img.key_front else None
            out.append({
                "sku": c.sku,
                "name": c.name,
                "set": c.set,
                "number": c.number,
                "language": c.language,
                "condition": c.condition,
                "holo": c.holo,
                "thumb_url": thumb,
            })
        return {"items": out}
    finally:
        db.close()