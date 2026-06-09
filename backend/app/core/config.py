from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    FINNHUB_API_KEY: str
    GCP_PROJECT_ID: str
    GEMINI_API_KEY: Optional[str] = None

    # Security Configuration
    ALLOWED_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://gen-lang-client-0826635932.web.app,https://gen-lang-client-0826635932.firebaseapp.com"
    PUBSUB_VERIFY_TOKEN: bool = True
    PUBSUB_EXPECTED_AUDIENCE: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
