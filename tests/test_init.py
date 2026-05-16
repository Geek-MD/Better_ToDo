"""Tests for Better To-do integration setup."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from custom_components.better_todo import async_setup, async_setup_entry
from custom_components.better_todo.const import (
    CONF_STORAGE_KEY,
    DATA_FRONTEND_REGISTERED,
    DOMAIN,
    FRONTEND_CARD_MODULE,
    FRONTEND_STATIC_PATH,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_WEB_COMPONENT,
)
from custom_components.better_todo.store import BetterTodoListStore


@pytest.mark.asyncio
async def test_async_setup_registers_frontend_assets(mock_hass, monkeypatch) -> None:
    """async_setup registers static assets, the card module, and the panel."""
    register_panel = AsyncMock()
    add_extra_js_url = MagicMock()

    monkeypatch.setattr(
        "custom_components.better_todo.panel_custom.async_register_panel",
        register_panel,
    )
    monkeypatch.setattr(
        "custom_components.better_todo.frontend.add_extra_js_url",
        add_extra_js_url,
    )

    result = await async_setup(mock_hass, {})

    assert result is True
    mock_hass.http.async_register_static_paths.assert_awaited_once()
    static_paths = mock_hass.http.async_register_static_paths.await_args.args[0]
    assert len(static_paths) == 1
    assert static_paths[0].url_path == FRONTEND_STATIC_PATH
    assert static_paths[0].path.endswith("/custom_components/better_todo/frontend")
    assert static_paths[0].cache_headers is False
    add_extra_js_url.assert_called_once_with(
        mock_hass, f"{FRONTEND_STATIC_PATH}/{FRONTEND_CARD_MODULE}"
    )
    register_panel.assert_awaited_once()
    assert register_panel.await_args.kwargs["frontend_url_path"] == PANEL_URL_PATH
    assert register_panel.await_args.kwargs["webcomponent_name"] == PANEL_WEB_COMPONENT
    assert register_panel.await_args.kwargs["sidebar_title"] == PANEL_TITLE
    assert mock_hass.data[DOMAIN][DATA_FRONTEND_REGISTERED] is True


@pytest.mark.asyncio
async def test_async_setup_entry_registers_frontend_once(mock_hass, monkeypatch) -> None:
    """async_setup_entry reuses the frontend registration across multiple entries."""
    register_panel = AsyncMock()
    add_extra_js_url = MagicMock()
    load_store = AsyncMock(return_value="")

    monkeypatch.setattr(
        "custom_components.better_todo.panel_custom.async_register_panel",
        register_panel,
    )
    monkeypatch.setattr(
        "custom_components.better_todo.frontend.add_extra_js_url",
        add_extra_js_url,
    )
    monkeypatch.setattr(BetterTodoListStore, "async_load", load_store)

    entry_one = SimpleNamespace(
        data={CONF_STORAGE_KEY: "my_tasks"},
        title="My Tasks",
        entry_id="entry-1",
    )
    entry_two = SimpleNamespace(
        data={CONF_STORAGE_KEY: "work"},
        title="Work",
        entry_id="entry-2",
    )

    assert await async_setup_entry(mock_hass, entry_one) is True
    assert await async_setup_entry(mock_hass, entry_two) is True

    mock_hass.http.async_register_static_paths.assert_awaited_once()
    register_panel.assert_awaited_once()
    add_extra_js_url.assert_called_once()
    assert load_store.await_count == 2
    assert entry_one.runtime_data is not None
    assert entry_two.runtime_data is not None
    assert mock_hass.config_entries.async_forward_entry_setups.await_count == 2
