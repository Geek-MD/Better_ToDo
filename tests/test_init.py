"""Tests for the Better To-do integration-level setup."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_async_setup_registers_static_path_and_panel(mock_hass):
    """async_setup must register the static path and the sidebar panel."""
    mock_http = MagicMock()
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

    # Static path registered
    mock_http.register_static_path.assert_called_once()
    path_args = mock_http.register_static_path.call_args
    assert path_args[0][0] == "/better_todo_static"
    frontend_dir = Path(path_args[0][1])
    assert frontend_dir.is_dir()

    # Panel registered
    mock_register.assert_called_once()
    kwargs = mock_register.call_args.kwargs
    assert kwargs["component_name"] == "better-todo-panel"
    assert kwargs["frontend_url_path"] == "better-todo"
    assert kwargs["sidebar_title"] == "Better ToDo"
    assert kwargs["js_url"] == "/better_todo_static/better-todo-panel.js"
