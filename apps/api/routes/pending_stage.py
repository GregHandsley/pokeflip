from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime
import os

from apps.api.core.database import SessionLocal
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

def _ext(key: str) -> str:
    _, ext = os.path.splitext(key)
    return ext.lower() or ".jpg"

@router.post("/{id}/stage")
def stage_pending(id: int, body: StageReq):
    db: Session = SessionLocal()
    try:
        row: ImageRow | None = db.execute(select(ImageRow).where(ImageRow.id == id, ImageRow.sku.is_(None))).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Pending item not found or already staged")

        candidate = make_candidate(body.set, body.number, body.language, body.condition, body.holo)
        sku = ensure_unique(db, candidate)

        # compute destination keys
        dst_prefix = f"staged/{sku}"
        fext = _ext(row.key_front) if row.key_front else ".jpg"
        bext = _ext(row.key_back) if row.key_back else fext
        dst_front = f"{dst_prefix}/front{fext}"
        dst_back  = f"{dst_prefix}/back{bext}" if row.key_back else None

        # move objects (source may be inbox/unsorted or inbox/pending)
        if row.key_front:
            move_object(row.key_front, dst_front)
        if row.key_back and dst_back:
            move_object(row.key_back, dst_back)

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

        # update Image row to link to card + new keys
        row.sku = sku
        row.key_front = dst_front
        row.key_back = dst_back
        row.staged_at = datetime.utcnow()
        db.commit()

        return {
            "sku": sku,
            "front_url": presign_get(dst_front),
            "back_url": presign_get(dst_back) if dst_back else None,
        }
    finally:
        db.close()