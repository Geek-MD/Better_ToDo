"""Tests for the Better To-do integration-level setup."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_async_setup_registers_static_path_and_panel(mock_hass):
    """async_setup must register the static path and the sidebar panel."""
    mock_http = MagicMock()
    mock_http.async_register_static_paths = AsyncMock()
    mock_hass.http = mock_http

    # Patch panel_custom.async_register_panel through the already-imported
    # reference in the better_todo package namespace.
    with patch(
        "custom_components.better_todo.panel_custom.async_register_panel",
        new_callable=AsyncMock,
    ) as mock_register:
        from custom_components.better_todo import async_setup

        result = await async_setup(mock_hass, {})

    assert result is True

    # Static path registered via async_register_static_paths
    mock_http.async_register_static_paths.assert_called_once()
    call_args = mock_http.async_register_static_paths.call_args
    static_configs = call_args[0][0]
    assert len(static_configs) == 1
    static_config = static_configs[0]
    assert static_config.url_path == "/better_todo_static"
    assert Path(static_config.path).is_dir()

    # Panel registered
    mock_register.assert_called_once()
    kwargs = mock_register.call_args.kwargs
    assert kwargs["webcomponent_name"] == "better-todo-panel"
    assert kwargs["frontend_url_path"] == "better-todo"
    assert kwargs["sidebar_title"] == "Better ToDo"
    assert kwargs["js_url"] == "/better_todo_static/better-todo-panel.js"
