from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
import os

from apps.api.core.database import SessionLocal
from apps.api.core.settings import settings
from apps.api.models import Image as ImageRow, Card
from apps.api.services.sku import make_candidate, ensure_unique
from apps.api.storage.move import move_object
from apps.api.storage.s3_client import presign_get

router = APIRouter(prefix="/pending", tags=["pending"])

class StageReq(BaseModel):
    name: str
    set: str
    number: str
    language: str = "EN"
    condition: str = "NM"
    holo: bool = False


@router.post("/{id}/stage")
def stage_pending(id: int, body: StageReq):
    db: Session = SessionLocal()
    try:
        row: ImageRow | None = db.execute(select(ImageRow).where(ImageRow.id == id, ImageRow.sku.is_(None))).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Pending item not found or already staged")

        candidate = make_candidate(body.set, body.number, body.language, body.condition, body.holo)
        sku = ensure_unique(db, candidate)

        # source keys
        src_front = row.key_front
        src_back = row.key_back
        
        # decide extensions
        def _ext(k: str) -> str:
            return os.path.splitext(k)[1].lower() if k else ""

        ext_f = _ext(src_front) or ".jpg"
        ext_b = _ext(src_back) or ".jpg"

        # destinations
        dst_front = f"staged/{sku}/front{ext_f}"
        dst_back = f"staged/{sku}/back{ext_b}" if src_back else None

        # move in storage
        move_object(src_front, dst_front)
        if dst_back:
            move_object(src_back, dst_back)

        # upsert Card
        card = Card(
            sku=sku,
            name=body.name,
            set=body.set,
            number=body.number,
            language=body.language,
            condition=body.condition,
            holo=body.holo,
        )
        db.add(card)

        # update DB keys to new staged locations
        row.sku = sku
        row.key_front = dst_front
        row.key_back = dst_back  # may be None when singleton
        row.staged_at = datetime.utcnow()
        
        db.add(row)
        db.commit()
        db.refresh(row)

        # response can include both urls
        front_url = presign_get(row.key_front) if row.key_front else None
        back_url = presign_get(row.key_back) if row.key_back else None
        
        return {
            "sku": sku,
            "front_url": front_url,
            "back_url": back_url,
        }
    finally:
        db.close()