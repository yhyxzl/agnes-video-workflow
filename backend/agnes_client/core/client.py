"""Agnes AI API client — unified interface for chat, image, and video generation."""
from __future__ import annotations

import aiohttp
from typing import Any, Optional


class AgnesAPIError(Exception):
    """Raised when the Agnes API returns an error."""


class AgnesClient:
    """Lightweight async client for the Agnes AI API (OpenAI-compatible interface)."""

    def __init__(self, api_key: str, base_url: str = "https://apihub.agnes-ai.com/v1"):
        cleaned = api_key.strip().strip("'\"\n\r")
        if not cleaned:
            raise AgnesAPIError("AGNES_API_KEY is not set")
        self.api_key = cleaned
        self.base_url = base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _post(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._headers()
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=120)) as resp:
                body = await resp.text()
                if resp.status != 200:
                    raise AgnesAPIError(f"API error ({resp.status}): {body}")
                return await resp.json()

    async def _get(self, endpoint: str) -> dict[str, Any]:
        """Perform a GET request to the Agnes API under the v1 base URL."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = self._headers()
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                body = await resp.text()
                if resp.status != 200:
                    raise AgnesAPIError(f"API error ({resp.status}): {body}")
                return await resp.json()

    async def _get_agnesapi(self, full_url: str) -> dict[str, Any]:
        """Perform a GET request to a full URL (for /agnesapi?video_id=XXX endpoint)."""
        headers = self._headers()
        async with aiohttp.ClientSession() as session:
            async with session.get(full_url, headers=headers, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                body = await resp.text()
                if resp.status != 200:
                    raise AgnesAPIError(f"API error ({resp.status}): {body}")
                return await resp.json()
