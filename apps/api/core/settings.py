from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    ENV: str = Field(default="dev")
    DATABASE_URL: str
    # future: REDIS_URL, S3_* etc.

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()