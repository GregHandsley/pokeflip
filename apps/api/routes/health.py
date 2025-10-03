from fastapi import APIRouter, Response, status
from sqlalchemy import text
from apps.api.core.database import engine

router = APIRouter(tags=["health"])

@router.get("/health/live")
def live():
    return {"status": "ok"}

@router.get("/health/ready")
def ready():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        return Response(content='{"status":"degraded"}',
                        media_type="application/json",
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE)