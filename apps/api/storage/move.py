from apps.api.storage.s3_client import s3_client
from apps.api.core.settings import settings

def move_object(src_key: str, dst_key: str):
    s3 = s3_client()
    s3.copy_object(
        Bucket=settings.S3_BUCKET,
        CopySource={"Bucket": settings.S3_BUCKET, "Key": src_key},
        Key=dst_key,
    )
    s3.delete_object(Bucket=settings.S3_BUCKET, Key=src_key)