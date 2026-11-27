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
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv, entity_registry as er

from .const import (
    CONF_COMPLETED_CLEANUP_ENABLED,
    CONF_COMPLETED_RETENTION_MONTHS,
    CONF_STORAGE_KEY,
    CONF_TODO_LIST_NAME,
    DEFAULT_COMPLETED_RETENTION_MONTHS,
    DEFAULT_SHOPPING_LIST_KEY,
    DEFAULT_SHOPPING_LIST_NAME,
    DOMAIN,
    STORAGE_PATH,
)
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


@websocket_api.websocket_command({
    vol.Required("type"): "better_todo/list_settings",
    vol.Required("entity_id"): cv.entity_id,
    vol.Optional("settings"): {
        vol.Optional("name"): vol.All(str, str.strip, vol.Length(min=1)),
        vol.Optional("cleanup_enabled"): bool,
        vol.Optional("retention_months"): vol.All(int, vol.Range(min=1), vol.Coerce(int)),
    },
})
@callback
def _async_list_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Read or update an existing Better To-do list without reloading it."""
    if not connection.user.is_admin:
        connection.send_error(msg["id"], "unauthorized", "Administrator access is required")
        return

    entity_id = msg["entity_id"]
    registry = er.async_get(hass)
    entity = registry.async_get(entity_id)
    if (
        entity is None or entity.domain != "todo" or entity.platform != DOMAIN
        or not entity.config_entry_id
    ):
        connection.send_error(msg["id"], "not_found", "Better To-do list not found")
        return
    entry = hass.config_entries.async_get_entry(entity.config_entry_id)
    shopping = entity.unique_id == f"{DOMAIN}_{DEFAULT_SHOPPING_LIST_KEY}"
    if (
        entry is None or entry.domain != DOMAIN
        or (not shopping and entity.unique_id != entry.entry_id)
    ):
        connection.send_error(msg["id"], "not_found", "Better To-do list configuration not found")
        return

    state = hass.states.get(entity_id)
    original_name = DEFAULT_SHOPPING_LIST_NAME if shopping else entry.title
    friendly_name = state.attributes.get("friendly_name") if state is not None else None
    name = entity.name or friendly_name or original_name
    options = dict(entry.options)
    if settings := msg.get("settings"):
        if "cleanup_enabled" in settings:
            options[CONF_COMPLETED_CLEANUP_ENABLED] = settings["cleanup_enabled"]
        if "retention_months" in settings:
            options[CONF_COMPLETED_RETENTION_MONTHS] = settings["retention_months"]

        changes: dict[str, Any] = {"options": options}
        if "name" in settings and settings["name"] != name:
            name = settings["name"]
            registry.async_update_entity(entity_id, name=name)
            if not shopping:
                changes.update(title=name, data={**entry.data, CONF_TODO_LIST_NAME: name})
        hass.config_entries.async_update_entry(entry, **changes)

    connection.send_result(msg["id"], {
        "name": name,
        "cleanup_enabled": options.get(CONF_COMPLETED_CLEANUP_ENABLED, True),
        "retention_months": options.get(
            CONF_COMPLETED_RETENTION_MONTHS, DEFAULT_COMPLETED_RETENTION_MONTHS
        ),
        "shared_cleanup": shopping,
    })


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the Better To-do integration (panel + static assets)."""
    bundle = await hass.async_add_executor_job(_PANEL_BUNDLE.read_bytes)
    fingerprint = sha256(bundle).hexdigest()[:16]
    # Change the path itself so caches that ignore query parameters can't serve
    # an older panel bundle after Home Assistant restarts on updated files.
    js_url = f"/better_todo_static/better-todo-panel.{fingerprint}.js"
    websocket_api.async_register_command(hass, _async_assignees)
    websocket_api.async_register_command(hass, _async_list_settings)
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
        webcomponent_name="better-todo-panel-v091",
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
    key = entry.data[CONF_STORAGE_KEY]
    path = Path(hass.config.path(STORAGE_PATH.format(key=key)))
    await hass.async_add_executor_job(lambda: path.unlink(missing_ok=True))
