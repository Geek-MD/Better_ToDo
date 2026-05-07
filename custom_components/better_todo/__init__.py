"""The Better To-do integration."""
from __future__ import annotations

from pathlib import Path
from typing import Any

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv
from homeassistant.util import slugify

from .const import (
    CONF_STORAGE_KEY,
    CONF_TODO_LIST_NAME,
    DOMAIN,
    FRONTEND_MODULE,
    PANEL_COMPONENT_NAME,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    STATIC_URL_PATH,
    STORAGE_PATH,
)
from .store import BetterTodoListStore

PLATFORMS: list[Platform] = [Platform.TODO]
_PANEL_REGISTERED = "panel_registered"
_STATIC_REGISTERED = "static_registered"

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type BetterTodoConfigEntry = ConfigEntry[BetterTodoListStore]


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up Better To-do component-level resources."""
    await _async_register_panel(hass)
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

    await _async_register_panel(hass)
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


async def _async_register_panel(hass: HomeAssistant) -> None:
    """Register static frontend assets and the Better To-do panel once."""
    domain_data = hass.data.setdefault(DOMAIN, {})

    if not domain_data.get(_STATIC_REGISTERED):
        frontend_dir = Path(__file__).parent / "frontend"
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    STATIC_URL_PATH,
                    str(frontend_dir),
                    cache_headers=False,
                )
            ]
        )
        domain_data[_STATIC_REGISTERED] = True

    if domain_data.get(_PANEL_REGISTERED):
        return

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_COMPONENT_NAME,
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{STATIC_URL_PATH}/{FRONTEND_MODULE}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={"domain": DOMAIN},
    )
    domain_data[_PANEL_REGISTERED] = True
