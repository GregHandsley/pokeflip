from fastapi import APIRouter
from pydantic import BaseModel
from rq import Queue
import redis
from apps.api.core.settings import settings
from apps.api.services.ingest import run_ingest
from apps.api.storage.s3_client import s3_client

router = APIRouter(prefix="/ingest", tags=["ingest"])

class IngestReq(BaseModel):
    prefix: str = "inbox/unsorted/"
    sync: bool = False

@router.post("/run")
def ingest_run(body: IngestReq):
    # If sync requested or Redis is down, run inline so your flow never blocks
    if body.sync:
        result = run_ingest(prefix=body.prefix)
        return {"mode":"inline","result":result}

    try:
        r = redis.from_url(settings.REDIS_URL)
        q = Queue("default", connection=r)
        job = q.enqueue("apps.api.services.ingest.run_ingest", kwargs={"prefix": body.prefix})
        return {"mode":"queued","job_id": job.id}
    except Exception:
        # anticipated error path (Redis not available): run inline
        result = run_ingest(prefix=body.prefix)
        return {"mode":"inline-fallback","result":result}

@router.get("/check")
def check_unprocessed():
    """Check for unprocessed files in the inbox"""
    try:
        from apps.api.core.database import SessionLocal
        from apps.api.models import Image as ImageRow
        
        # List objects in the inbox/unsorted folder
        response = s3_client().list_objects_v2(
            Bucket=settings.S3_BUCKET,
            Prefix="inbox/unsorted/"
        )
        
        # Get all files in storage
        storage_files = set()
        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                # Only count image files
                if any(key.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp', '.bmp']):
                    storage_files.add(key)
        
        # Get all files that are already in the database
        with SessionLocal() as db:
            existing_files = set()
            images = db.query(ImageRow).all()
            for img in images:
                if img.key_front:
                    existing_files.add(img.key_front)
                if img.key_back:
                    existing_files.add(img.key_back)
        
        # Find files that exist in storage but not in database
        unprocessed_files = storage_files - existing_files
        
        return {
            "count": len(unprocessed_files),
            "files": list(unprocessed_files)[:10]  # Only return first 10 for performance
        }
    except Exception as e:
        return {"count": 0, "files": [], "error": str(e)}
