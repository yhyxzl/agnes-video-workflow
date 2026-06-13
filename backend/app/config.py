"""Application configuration."""
from __future__ import annotations

import os
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    agnes_api_key: str = ""
    agnes_base_url: str = "https://apihub.agnes-ai.com/v1"
    app_port: int = 8090
    app_host: str = "127.0.0.1"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    output_dir: str = ""
    batch_max_concurrent: int = 3
    timezone: str = "Asia/Shanghai"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def __init__(self, **kwargs):
        # Pre-load .env manually to handle fallback
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    key = key.strip()
                    val = val.strip()
                    if key and key not in kwargs:
                        os.environ.setdefault(key, val)
        super().__init__(**kwargs)


def now_bj() -> datetime:
    """Return current time in Beijing timezone (UTC+8)."""
    tz = ZoneInfo("Asia/Shanghai")
    return datetime.now(tz)


def bj_to_utc(dt: datetime) -> datetime:
    """Convert a Beijing-time datetime to UTC."""
    return dt.astimezone(ZoneInfo("Asia/Shanghai")).astimezone(timezone.utc)


def utc_to_bj(dt_utc: datetime) -> datetime:
    """Convert a UTC datetime to Beijing timezone."""
    if dt_utc.tzinfo is None:
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    return dt_utc.astimezone(ZoneInfo("Asia/Shanghai"))


def format_bj(dt: datetime) -> str:
    """Format datetime in Beijing timezone for display."""
    return dt.astimezone(ZoneInfo("Asia/Shanghai")).strftime("%Y-%m-%d %H:%M:%S CST")


settings = Settings()
