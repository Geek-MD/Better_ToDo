"""Tests for the Better To-do integration-level setup."""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
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
    bundle = Path(static_config.path)
    assert bundle.name == "better-todo-panel.js"
    fingerprint = sha256(bundle.read_bytes()).hexdigest()[:16]
    assert static_config.url_path == f"/better_todo_static/better-todo-panel.{fingerprint}.js"
    assert static_config.cache_headers is False

    # Panel registered
    mock_register.assert_called_once()
    kwargs = mock_register.call_args.kwargs
    assert kwargs["webcomponent_name"] == "better-todo-panel-v080"
    assert kwargs["frontend_url_path"] == "better-todo"
    assert kwargs["sidebar_title"] == "Better ToDo"
    assert kwargs["js_url"] == static_config.url_path


@pytest.mark.asyncio
async def test_changed_panel_bytes_get_a_new_url_without_a_version_bump(
    mock_hass, tmp_path, monkeypatch
):
    """Updating the actual bundle changes the asset path that clients request."""
    from custom_components import better_todo

    bundle = tmp_path / "better-todo-panel.js"
    monkeypatch.setattr(better_todo, "_PANEL_BUNDLE", bundle)
    mock_hass.http.async_register_static_paths = AsyncMock()
    with patch.object(better_todo.panel_custom, "async_register_panel", new_callable=AsyncMock) as register:
        bundle.write_bytes(b"old panel")
        assert await better_todo.async_setup(mock_hass, {})
        bundle.write_bytes(b"new panel")
        assert await better_todo.async_setup(mock_hass, {})

    first, second = [call.kwargs["js_url"] for call in register.call_args_list]
    assert first != second
    assert "?" not in second


@pytest.mark.asyncio
async def test_assignee_directory_respects_list_access(mock_hass, monkeypatch):
    """List readers only get active human users and no auth details."""
    from custom_components.better_todo import _async_assignees, er

    registry = MagicMock()
    registry.async_get.return_value = SimpleNamespace(domain="todo", platform="better_todo")
    monkeypatch.setattr(er, "async_get", lambda _hass: registry, raising=False)
    mock_hass.auth.async_get_users = AsyncMock(return_value=[
        SimpleNamespace(id="human", name="Ana", is_active=True, system_generated=False),
        SimpleNamespace(id="system", name="System", is_active=True, system_generated=True),
        SimpleNamespace(id="inactive", name="Inactive", is_active=False, system_generated=False),
    ])
    connection = MagicMock()
    msg = {"id": 1, "entity_id": "todo.home"}
    connection.user.permissions.check_entity.return_value = False
    await _async_assignees(mock_hass, connection, msg)
    connection.send_error.assert_called_once()
    mock_hass.auth.async_get_users.assert_not_called()

    connection.user.permissions.check_entity.return_value = True
    await _async_assignees(mock_hass, connection, msg)
    connection.send_result.assert_called_once_with(1, [{"id": "human", "name": "Ana"}])
