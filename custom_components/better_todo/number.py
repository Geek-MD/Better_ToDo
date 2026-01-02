"""Number platform for Better ToDo integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo number platform."""
    entities = [
        RecurrenceIntervalNumber(entry),
        RecurrenceEndCountNumber(entry),
    ]
    async_add_entities(entities, True)


class RecurrenceIntervalNumber(NumberEntity):
    """Number entity for recurrence interval configuration."""

    _attr_has_entity_name = True
    _attr_native_min_value = 1
    _attr_native_max_value = 365
    _attr_native_step = 1
    _attr_mode = NumberMode.BOX
    _attr_icon = "mdi:calendar-refresh"

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the recurrence interval number entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_recurrence_interval"
        self._attr_name = "Recurrence interval"
        self._attr_native_value = 1

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Todo List",
            "sw_version": "0.4.0",
        }

    async def async_set_native_value(self, value: float) -> None:
        """Set the recurrence interval value."""
        self._attr_native_value = int(value)
        self.async_write_ha_state()


class RecurrenceEndCountNumber(NumberEntity):
    """Number entity for recurrence end count configuration."""

    _attr_has_entity_name = True
    _attr_native_min_value = 1
    _attr_native_max_value = 999
    _attr_native_step = 1
    _attr_mode = NumberMode.BOX
    _attr_icon = "mdi:counter"

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the recurrence end count number entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_recurrence_end_count"
        self._attr_name = "Recurrence end count"
        self._attr_native_value = 10

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Todo List",
            "sw_version": "0.4.0",
        }

    async def async_set_native_value(self, value: float) -> None:
        """Set the recurrence end count value."""
        self._attr_native_value = int(value)
        self.async_write_ha_state()
