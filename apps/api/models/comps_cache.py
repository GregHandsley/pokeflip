from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, JSON, Integer
from .base import Base, TimestampMixin

class CompsCache(Base, TimestampMixin):
    __tablename__ = "comps_cache"

    key: Mapped[str] = mapped_column(String(128), primary_key=True)  # hash of normalized query
    query_json: Mapped[Optional[dict]] = mapped_column(JSON)
    sold_stats_json: Mapped[Optional[dict]] = mapped_column(JSON)
    active_stats_json: Mapped[Optional[dict]] = mapped_column(JSON)
    source: Mapped[Optional[str]] = mapped_column(String(32))
    fetched_at_epoch: Mapped[Optional[int]] = mapped_column(Integer)
    ttl_seconds: Mapped[Optional[int]] = mapped_column(Integer)