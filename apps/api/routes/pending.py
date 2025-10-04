# add if missing:
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
import os, uuid

from apps.api.core.database import SessionLocal
from apps.api.core.settings import settings
from apps.api.models import Image as ImageRow
from apps.api.storage.s3_client import s3_client, presign_get
from apps.api.storage.move import move_object

router = APIRouter(prefix="/pending", tags=["pending"])

class DiscardReq(BaseModel):
    mode: str = "trash" 

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

@router.post("/{id}/discard")
def discard_pending(id: int, body: DiscardReq):
    db: Session = SessionLocal()
    try:
        row: ImageRow | None = db.execute(
            select(ImageRow).where(ImageRow.id == id, ImageRow.sku.is_(None))
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Pending item not found or already processed")

        s3 = s3_client()
        keys = [k for k in (row.key_front, row.key_back) if k]

        if body.mode == "delete":
            for k in keys:
                s3.delete_object(Bucket=settings.S3_BUCKET, Key=k)
        else:
            # move files to trash/ with a short uuid prefix to avoid collisions
            for k in keys:
                dst = f"trash/{uuid.uuid4().hex[:8]}_{os.path.basename(k)}"
                move_object(k, dst)

        db.delete(row)
        db.commit()
        return {"status": "ok", "mode": body.mode, "deleted": len(keys)}
    finally:
        db.close()