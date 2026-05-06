"""The Better To-do integration."""
from __future__ import annotations

from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.util import slugify

from .const import CONF_STORAGE_KEY, CONF_TODO_LIST_NAME, STORAGE_PATH
from .store import BetterTodoListStore

PLATFORMS: list[Platform] = [Platform.TODO]

type BetterTodoConfigEntry = ConfigEntry[BetterTodoListStore]


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
