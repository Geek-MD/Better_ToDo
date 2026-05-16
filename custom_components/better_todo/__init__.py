"""The Better To-do integration."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.util import slugify

from .const import CONF_STORAGE_KEY, CONF_TODO_LIST_NAME, STORAGE_PATH
from .store import BetterTodoListStore

PLATFORMS: list[Platform] = [Platform.TODO]

CONFIG_SCHEMA = vol.Schema({}, extra=vol.ALLOW_EXTRA)  # required by hassfest when async_setup is defined

type BetterTodoConfigEntry = ConfigEntry[BetterTodoListStore]


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up the Better To-do integration (panel + static assets)."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(
            "/better_todo_static",
            str(Path(__file__).parent / "frontend"),
            cache_headers=False,
        )]
    )
    await panel_custom.async_register_panel(
        hass,
        component_name="better-todo-panel",
        sidebar_title="Better ToDo",
        sidebar_icon="mdi:check-circle-outline",
        frontend_url_path="better-todo",
        require_admin=False,
        config={},
        js_url="/better_todo_static/better-todo-panel.js",
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
