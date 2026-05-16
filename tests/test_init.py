"""Tests for the Better To-do integration-level setup."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_async_setup_registers_static_paths_and_panel(mock_hass):
    """async_setup must call async_register_static_paths (not register_static_path)."""
    mock_hass.http = MagicMock()
    mock_hass.http.async_register_static_paths = MagicMock(return_value=None)

    with patch(
        "custom_components.better_todo.panel_custom.async_register_panel",
        new_callable=AsyncMock,
    ) as mock_register:
        from custom_components.better_todo import async_setup

        result = await async_setup(mock_hass, {})

    assert result is True

    # Must use async_register_static_paths, NOT register_static_path
    mock_hass.http.async_register_static_paths.assert_called_once()

    # Verify StaticPathConfig passed correctly
    call_args = mock_hass.http.async_register_static_paths.call_args[0][0]
    assert len(call_args) == 1
    static_cfg = call_args[0]
    assert static_cfg.url_path == "/better_todo_static"
    assert Path(static_cfg.path).is_dir()
    assert static_cfg.cache_headers is False

    # Panel registered
    mock_register.assert_awaited_once()
    kwargs = mock_register.call_args.kwargs
    assert kwargs["component_name"] == "better-todo-panel"
    assert kwargs["frontend_url_path"] == "better-todo"
    assert kwargs["sidebar_title"] == "Better ToDo"
    assert kwargs["js_url"] == "/better_todo_static/better-todo-panel.js"
