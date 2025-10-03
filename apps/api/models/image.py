from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, JSON
from .base import Base, TimestampMixin

class Image(Base, TimestampMixin):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku: Mapped[Optional[str]] = mapped_column(ForeignKey("cards.sku", ondelete="SET NULL"))

    key_front: Mapped[Optional[str]] = mapped_column(String(255))
    key_back: Mapped[Optional[str]] = mapped_column(String(255))

    phash_front: Mapped[Optional[str]] = mapped_column(String(32))
    phash_back: Mapped[Optional[str]] = mapped_column(String(32))

    crop_front: Mapped[Optional[dict]] = mapped_column(JSON)  # {x,y,w,h} normalized
    crop_back:  Mapped[Optional[dict]] = mapped_column(JSON)

    qa_score: Mapped[Optional[int]]
    qa_flags: Mapped[Optional[list]] = mapped_column(JSON)     # ["BLUR_LOW", ...]