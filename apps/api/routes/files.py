from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from apps.api.storage.s3_client import presign_put, make_key

router = APIRouter(prefix="/files", tags=["files"])

class UploadInit(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = "application/octet-stream"

class UploadInitResp(BaseModel):
    key: str
    url: str

@router.post("/upload", response_model=UploadInitResp)
def init_upload(body: UploadInit):
    try:
        key = make_key("inbox/unsorted", body.filename)
        url = presign_put(key, body.content_type)
        return UploadInitResp(key=key, url=url)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Presign failed")