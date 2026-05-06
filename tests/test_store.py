"""Tests for Better To-do store."""
from __future__ import annotations

from pathlib import Path

import pytest

from custom_components.better_todo.store import BetterTodoListStore


@pytest.mark.asyncio
async def test_store_load_missing_file(tmp_ics_path: Path, mock_hass) -> None:
    """Loading a non-existent file returns an empty string."""
    store = BetterTodoListStore(mock_hass, tmp_ics_path)
    content = await store.async_load()
    assert content == ""


@pytest.mark.asyncio
async def test_store_round_trip(tmp_ics_path: Path, mock_hass) -> None:
    """Content written with async_store can be read back with async_load."""
    store = BetterTodoListStore(mock_hass, tmp_ics_path)
    ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
    await store.async_store(ics)
    # Python text-mode read normalises \r\n → \n; compare without CR
    result = await store.async_load()
    assert result.replace("\r\n", "\n") == ics.replace("\r\n", "\n")


@pytest.mark.asyncio
async def test_store_creates_parent_dirs(tmp_path: Path, mock_hass) -> None:
    """async_store creates missing parent directories."""
    deep_path = tmp_path / "a" / "b" / "c" / "list.ics"
    store = BetterTodoListStore(mock_hass, deep_path)
    ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
    await store.async_store(ics)
    assert deep_path.exists()
    content = deep_path.read_text(encoding="utf-8")
    assert content.replace("\r\n", "\n") == ics.replace("\r\n", "\n")
