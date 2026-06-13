"""Launcher script."""
from main import app
from app.config import settings
import uvicorn

if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.app_host, port=settings.app_port, reload=True)
