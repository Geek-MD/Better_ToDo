"""Text platform for Better ToDo integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.text import TextEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo text platform."""
    entities = [
        TaskUIDText(entry),
        RecurrenceEndDateText(entry),
    ]
    async_add_entities(entities, True)


class TaskUIDText(TextEntity):
    """Text entity for task UID input."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:identifier"
    _attr_native_min = 0
    _attr_native_max = 255

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the task UID text entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_task_uid"
        self._attr_name = "Task UID"
        self._attr_native_value = ""

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

    async def async_set_value(self, value: str) -> None:
        """Set the task UID value."""
        self._attr_native_value = value
        self.async_write_ha_state()


class RecurrenceEndDateText(TextEntity):
    """Text entity for recurrence end date input."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:calendar-end"
    _attr_native_min = 0
    _attr_native_max = 10

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the recurrence end date text entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_recurrence_end_date"
        self._attr_name = "Recurrence end date"
        self._attr_native_value = ""

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

    async def async_set_value(self, value: str) -> None:
        """Set the recurrence end date value."""
        self._attr_native_value = value
        self.async_write_ha_state()
