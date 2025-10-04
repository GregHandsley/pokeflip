import re, uuid, boto3
from apps.api.core.settings import settings

_session = boto3.session.Session(
    aws_access_key_id=settings.S3_ACCESS_KEY_ID,
    aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    region_name=settings.S3_REGION,
)

# Internal client
_s3 = _session.client("s3", endpoint_url=settings.S3_ENDPOINT_URL)

# Public client for presigned URLs usable by browser (fallbacks to internal if not set)
_public_endpoint = getattr(settings, "S3_PUBLIC_ENDPOINT_URL", settings.S3_ENDPOINT_URL)
_s3_public = _session.client("s3", endpoint_url=_public_endpoint)

SAFE = re.compile(r"[^A-Za-z0-9._-]+")

def safe_filename(name: str) -> str:
    return SAFE.sub("_", name).strip("._") or "file"

def make_key(prefix: str, filename: str) -> str:
    return f"{prefix.rstrip('/')}/{uuid.uuid4().hex[:12]}_{safe_filename(filename)}"

def presign_put(key: str, content_type: str, expires_seconds: int = 3600) -> str:
    return _s3_public.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key, "ContentType": content_type or "application/octet-stream"},
        ExpiresIn=expires_seconds,
        HttpMethod="PUT",
    )

def presign_get(key: str, expires_seconds: int = 900) -> str:
    return _s3_public.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expires_seconds,
        HttpMethod="GET",
    )

def s3_client():
    return _s3