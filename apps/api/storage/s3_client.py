import re
import uuid
import boto3
from datetime import timedelta
from apps.api.core.settings import settings

_session = boto3.session.Session(
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    region_name=settings.S3_REGION,
)
_s3 = _session.client("s3", endpoint_url=settings.S3_ENDPOINT_URL)

SAFE = re.compile(r"[^A-Za-z0-9._-]+")

def safe_filename(name: str) -> str:
    return SAFE.sub("_", name).strip("._") or "file"

def make_key(prefix: str, filename: str) -> str:
    uid = uuid.uuid4().hex[:12]
    return f"{prefix.rstrip('/')}/{uid}_{safe_filename(filename)}"

def presign_put(key: str, content_type: str, expires_seconds: int = 3600) -> str:
    # Use public endpoint for presigned URLs if available, otherwise use internal endpoint
    endpoint_url = settings.S3_PUBLIC_ENDPOINT_URL or settings.S3_ENDPOINT_URL
    
    # Create a separate client for presigned URLs with the public endpoint
    presign_client = _session.client("s3", endpoint_url=endpoint_url)
    
    return presign_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "ContentType": content_type or "application/octet-stream",
        },
        ExpiresIn=expires_seconds,
        HttpMethod="PUT",
    )