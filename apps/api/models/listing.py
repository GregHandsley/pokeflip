from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey
from .base import Base, TimestampMixin

class Listing(Base, TimestampMixin):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(ForeignKey("cards.sku", ondelete="CASCADE"), index=True, unique=True)
    title: Mapped[Optional[str]] = mapped_column(String(300))
    description_md: Mapped[Optional[str]]
    price_listed: Mapped[Optional[float]]
    marketplace: Mapped[Optional[str]] = mapped_column(String(32))
    offer_id: Mapped[Optional[str]] = mapped_column(String(64))
    listing_id: Mapped[Optional[str]] = mapped_column(String(64))
    last_synced_at: Mapped[Optional[str]] = mapped_column(String(64))