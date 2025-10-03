from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, JSON
from .base import Base, TimestampMixin

class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    type: Mapped[str] = mapped_column(String(32), index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)   # queued/running/success/failed
    progress: Mapped[Optional[int]]                                # 0-100
    payload: Mapped[Optional[dict]] = mapped_column(JSON)
    result:  Mapped[Optional[dict]] = mapped_column(JSON)