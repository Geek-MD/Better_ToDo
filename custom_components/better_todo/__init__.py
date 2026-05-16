"""The Better To-do integration."""
from __future__ import annotations

from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.util import slugify

from .const import (
    CONF_STORAGE_KEY,
    CONF_TODO_LIST_NAME,
    DATA_FRONTEND_REGISTERED,
    DOMAIN,
    FRONTEND_CARD_MODULE,
    FRONTEND_PANEL_MODULE,
    FRONTEND_STATIC_PATH,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_WEB_COMPONENT,
    STORAGE_PATH,
)
from .store import BetterTodoListStore

PLATFORMS: list[Platform] = [Platform.TODO]

type BetterTodoConfigEntry = ConfigEntry[BetterTodoListStore]
if hasattr(cv, "config_entry_only_config_schema"):
    CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
else:
    CONFIG_SCHEMA = vol.Schema({})


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Better To-do integration."""
    await _async_setup_frontend(hass)
    return True


async def _async_setup_frontend(hass: HomeAssistant) -> None:
    """Register static frontend assets, the panel, and the dashboard card."""
    domain_data = hass.data.setdefault(DOMAIN, {})
    if domain_data.get(DATA_FRONTEND_REGISTERED):
        return

    frontend_dir = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_STATIC_PATH, str(frontend_dir), cache_headers=False)]
    )
    frontend.add_extra_js_url(
        hass, f"{FRONTEND_STATIC_PATH}/{FRONTEND_CARD_MODULE}"
    )
    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path=PANEL_URL_PATH,
        config_panel_domain=DOMAIN,
        webcomponent_name=PANEL_WEB_COMPONENT,
        module_url=f"{FRONTEND_STATIC_PATH}/{FRONTEND_PANEL_MODULE}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
    )

    domain_data[DATA_FRONTEND_REGISTERED] = True


async def async_setup_entry(
    hass: HomeAssistant, entry: BetterTodoConfigEntry
) -> bool:
    """Set up Better To-do from a config entry."""
    await _async_setup_frontend(hass)
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
