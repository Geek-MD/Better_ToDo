"""Shared pytest fixtures for Better To-do tests."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture
def tmp_ics_path(tmp_path: Path) -> Path:
    """Return a temporary .ics file path."""
    return tmp_path / "better_todo.test_list.ics"


@pytest.fixture
def mock_hass():
    """Return a minimal mock HomeAssistant instance."""
    hass = MagicMock()
    hass.config.path = lambda *parts: str(Path(*parts))
    # async_add_executor_job: run the callable synchronously in tests
    async def _executor(func, *args, **kwargs):
        return func(*args, **kwargs)

    hass.async_add_executor_job = _executor
    return hass
