"""Application settings loaded from environment variables."""

from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    """
    @brief Runtime configuration for the API

    @return Loaded settings instance
    """

    database_url: str
    cors_origins: tuple[str, ...]


def _read_cors_origins() -> tuple[str, ...]:
    """
    @brief Read comma-separated CORS origins

    @return Configured origins with development defaults
    """

    raw_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    )
    return tuple(
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    )


settings = Settings(
    database_url=os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/lhlord"
    ),
    cors_origins=_read_cors_origins()
)
