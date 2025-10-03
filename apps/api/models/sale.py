from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, DateTime, Float
from .base import Base, TimestampMixin

class Sale(Base, TimestampMixin):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(ForeignKey("cards.sku", ondelete="CASCADE"), index=True)
    sold_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    price_sold: Mapped[Optional[float]] = mapped_column(Float)
    fee_total: Mapped[Optional[float]] = mapped_column(Float)
    consumables_cost: Mapped[Optional[float]] = mapped_column(Float)
    net: Mapped[Optional[float]] = mapped_column(Float)
    roi: Mapped[Optional[float]] = mapped_column(Float)