"""File-based storage for Better To-do lists (.ics)."""
from __future__ import annotations

import asyncio
from pathlib import Path

from homeassistant.core import HomeAssistant


class BetterTodoListStore:
    """Manages async read/write of a single iCalendar (.ics) file."""

    def __init__(self, hass: HomeAssistant, path: Path) -> None:
        """Initialize the store."""
        self._hass = hass
        self._path = path
        self._lock = asyncio.Lock()

    async def async_load(self) -> str:
        """Load the .ics content from disk (empty string if file doesn't exist)."""
        async with self._lock:
            return await self._hass.async_add_executor_job(self._load)

    def _load(self) -> str:
        if not self._path.exists():
            return ""
        return self._path.read_text(encoding="utf-8")

    async def async_store(self, ics_content: str) -> None:
        """Write .ics content to disk."""
        async with self._lock:
            await self._hass.async_add_executor_job(self._store, ics_content)

    def _store(self, ics_content: str) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(ics_content, encoding="utf-8")
