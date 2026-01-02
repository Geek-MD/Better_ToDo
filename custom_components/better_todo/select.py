"""Select platform for Better ToDo integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo select platform."""
    entities = [
        RecurrenceUnitSelect(entry),
        RecurrenceEndTypeSelect(entry),
    ]
    async_add_entities(entities, True)


class RecurrenceUnitSelect(SelectEntity):
    """Select entity for recurrence unit configuration."""

    _attr_has_entity_name = True
    _attr_options = ["days", "months", "years"]
    _attr_icon = "mdi:calendar-clock"

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the recurrence unit select entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_recurrence_unit"
        self._attr_name = "Recurrence unit"
        self._attr_current_option = "days"

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Todo List",
            "sw_version": "0.3.0",
        }

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        self._attr_current_option = option
        self.async_write_ha_state()


class RecurrenceEndTypeSelect(SelectEntity):
    """Select entity for recurrence end type configuration."""

    _attr_has_entity_name = True
    _attr_options = ["count", "date", "never"]
    _attr_icon = "mdi:calendar-end"

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the recurrence end type select entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_recurrence_end_type"
        self._attr_name = "Recurrence end type"
        self._attr_current_option = "never"

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Todo List",
            "sw_version": "0.3.0",
        }

    async def async_select_option(self, option: str) -> None:
        """Change the selected option."""
        self._attr_current_option = option
        self.async_write_ha_state()
