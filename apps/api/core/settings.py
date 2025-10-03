from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    ENV: str = Field(default="dev")
    DATABASE_URL: str

    S3_ENDPOINT_URL: str
    S3_PUBLIC_ENDPOINT_URL: str = Field(default="")
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: str
    S3_SECRET_ACCESS_KEY: str
    S3_BUCKET: str

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()