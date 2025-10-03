from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Boolean, String, JSON
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin

class Card(Base, TimestampMixin):
    __tablename__ = "cards"

    sku: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    set: Mapped[Optional[str]] = mapped_column(String(120))
    number: Mapped[Optional[str]] = mapped_column(String(40))
    language: Mapped[Optional[str]] = mapped_column(String(8))
    rarity: Mapped[Optional[str]] = mapped_column(String(40))
    holo: Mapped[Optional[bool]] = mapped_column(Boolean)
    condition: Mapped[Optional[str]] = mapped_column(String(8))

    ocr_json: Mapped[Optional[dict]] = mapped_column(JSON)
    qa_json: Mapped[Optional[dict]] = mapped_column(JSON)

    staged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    listed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sold_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))