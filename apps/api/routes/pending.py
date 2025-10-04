from fastapi import APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import select
from apps.api.core.database import SessionLocal
from apps.api.models import Image as ImageRow
from apps.api.storage.s3_client import presign_get

router = APIRouter(prefix="/pending", tags=["pending"])

@router.get("")
def list_pending(limit: int = 100):
    db: Session = SessionLocal()
    try:
        rows = db.execute(
            select(ImageRow).where(ImageRow.sku.is_(None)).order_by(ImageRow.created_at.desc()).limit(limit)
        ).scalars().all()
        out = []
        for r in rows:
            dupes = bool(r.qa_flags and any(f.startswith("DUPLICATE") for f in r.qa_flags))
            out.append({
                "id": r.id,
                "key_front": r.key_front,
                "key_back": r.key_back,
                "front_url": presign_get(r.key_front) if r.key_front else None,
                "back_url": presign_get(r.key_back) if r.key_back else None,
                "qa_flags": r.qa_flags or [],
                "dupes": dupes,
            })
        return {"items": out}
    finally:
        db.close()