"""The Better To-do integration."""
from __future__ import annotations

from hashlib import sha256
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.auth.permissions.const import POLICY_READ
from homeassistant.components import panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv, entity_registry as er
from homeassistant.util import slugify

from .const import CONF_STORAGE_KEY, CONF_TODO_LIST_NAME, STORAGE_PATH
from .store import BetterTodoListStore

PLATFORMS: list[Platform] = [Platform.TODO]
_PANEL_BUNDLE = Path(__file__).parent / "frontend" / "better-todo-panel.js"

CONFIG_SCHEMA = vol.Schema({}, extra=vol.ALLOW_EXTRA)  # required by hassfest when async_setup is defined

type BetterTodoConfigEntry = ConfigEntry[BetterTodoListStore]


@websocket_api.websocket_command(
    {"type": "better_todo/assignees", "entity_id": cv.entity_id}
)
@websocket_api.async_response
async def _async_assignees(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Return the display names and IDs available for a Better To-do list."""
    entity_id = msg.get("entity_id")
    if not isinstance(entity_id, str):
        connection.send_error(msg["id"], "invalid_format", "Entity ID is required")
        return
    entry = er.async_get(hass).async_get(entity_id)
    if (
        not entry
        or entry.domain != "todo"
        or entry.platform != "better_todo"
        or not connection.user.permissions.check_entity(entity_id, POLICY_READ)
    ):
        connection.send_error(msg["id"], "unauthorized", "List is not accessible")
        return
    connection.send_result(
        msg["id"],
        [
            {"id": user.id, "name": user.name or user.id}
            for user in await hass.auth.async_get_users()
            if user.is_active and not user.system_generated
        ],
    )


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the Better To-do integration (panel + static assets)."""
    bundle = await hass.async_add_executor_job(_PANEL_BUNDLE.read_bytes)
    fingerprint = sha256(bundle).hexdigest()[:16]
    # Change the path itself so caches that ignore query parameters can't serve
    # an older panel bundle after Home Assistant restarts on updated files.
    js_url = f"/better_todo_static/better-todo-panel.{fingerprint}.js"
    websocket_api.async_register_command(hass, _async_assignees)
    await hass.http.async_register_static_paths(
        [StaticPathConfig(
            url_path=js_url,
            path=str(_PANEL_BUNDLE),
            cache_headers=False,
        )]
    )
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path="better-todo",
        webcomponent_name="better-todo-panel",
        sidebar_title="Better ToDo",
        sidebar_icon="mdi:check-circle-outline",
        require_admin=False,
        config={},
        js_url=js_url,
    )
    return True


async def async_setup_entry(
    hass: HomeAssistant, entry: BetterTodoConfigEntry
) -> bool:
    """Set up Better To-do from a config entry."""
    path = Path(
        hass.config.path(STORAGE_PATH.format(key=entry.data[CONF_STORAGE_KEY]))
    )
    store = BetterTodoListStore(hass, path)
    try:
        await store.async_load()
    except OSError as err:
        raise ConfigEntryNotReady(
            f"Failed to load Better To-do file {path}: {err}"
        ) from err

    entry.runtime_data = store
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: BetterTodoConfigEntry
) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(
    hass: HomeAssistant, entry: ConfigEntry
) -> None:
    """Remove a config entry and its storage file."""
    key = slugify(entry.data[CONF_TODO_LIST_NAME])
    path = Path(hass.config.path(STORAGE_PATH.format(key=key)))
    await hass.async_add_executor_job(lambda: path.unlink(missing_ok=True))
