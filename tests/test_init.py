"""Tests for Better To-do integration setup."""
from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

import custom_components.better_todo as integration
from custom_components.better_todo.const import (
    CONF_STORAGE_KEY,
    CONF_TODO_LIST_NAME,
    DOMAIN,
)


@pytest.mark.asyncio
async def test_async_setup_registers_panel_once(mock_hass, monkeypatch: pytest.MonkeyPatch):
    """Component async_setup registers static assets and panel a single time."""
    calls = {"panel": 0, "static": 0}

    def _register_panel(*args, **kwargs):
        calls["panel"] += 1

    async def _register_static_paths(paths):
        calls["static"] += 1
        assert len(paths) == 1

    monkeypatch.setattr(
        "custom_components.better_todo.panel_custom.async_register_panel",
        _register_panel,
    )
    mock_hass.http.async_register_static_paths = _register_static_paths

    assert await integration.async_setup(mock_hass, {}) is True
    assert await integration.async_setup(mock_hass, {}) is True

    assert calls["static"] == 1
    assert calls["panel"] == 1
    assert DOMAIN in mock_hass.data


@pytest.mark.asyncio
async def test_async_setup_entry_registers_runtime_data(
    tmp_path: Path, mock_hass, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Entry setup loads store, registers panel, and forwards TODO platform."""
    forwarded: list[object] = []
    mock_hass.config.path = lambda rel_path: str(tmp_path / rel_path)
    async def _forward_entry_setups(entry, _platforms):
        forwarded.append((entry, _platforms))
        return True

    mock_hass.config_entries = SimpleNamespace(
        async_forward_entry_setups=_forward_entry_setups
    )

    panel_calls = 0

    def _register_panel(*args, **kwargs):
        nonlocal panel_calls
        panel_calls += 1

    monkeypatch.setattr(
        "custom_components.better_todo.panel_custom.async_register_panel",
        _register_panel,
    )

    entry = SimpleNamespace(
        data={
            CONF_STORAGE_KEY: "test_list",
            CONF_TODO_LIST_NAME: "Test List",
        },
        runtime_data=None,
    )

    result = await integration.async_setup_entry(mock_hass, entry)
    assert result is True
    assert entry.runtime_data is not None
    assert panel_calls == 1
    assert len(forwarded) == 1
