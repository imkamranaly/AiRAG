from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="allow")

    # PostgreSQL
    DATABASE_URL: str = "postgresql://raguser:ragpassword@localhost:5432/ragdb"

    # OpenAI
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSIONS: int = 1536

    # App
    APP_ENV: str = "development"
    CORS_ORIGINS: List[str] = ["http://127.0.0.1:8000"]

    # RAG
    CHUNK_SIZE: int = 1024
    CHUNK_OVERLAP: int = 128
    TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.5

    # File upload
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".txt", ".md", ".docx"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
