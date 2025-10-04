from fastapi import APIRouter
from pydantic import BaseModel
from rq import Queue
import redis
from apps.api.core.settings import settings
from apps.api.services.ingest import run_ingest

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