"""Button platform for Better ToDo integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo button platform."""
    entity = ApplyRecurrenceButton(entry)
    async_add_entities([entity], True)


class ApplyRecurrenceButton(ButtonEntity):
    """Button entity for applying recurrence settings to a task."""

    _attr_has_entity_name = True
    _attr_icon = "mdi:refresh-auto"

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize the apply recurrence button entity."""
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_apply_recurrence"
        self._attr_name = "Apply recurrence settings"

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Todo List",
            "sw_version": "0.3.1",
        }

    async def async_press(self) -> None:
        """Handle the button press.
        
        This button triggers the apply_recurrence_from_ui service which reads
        the helper entity values and applies them to the task specified in the
        task UID text entity.
        """
        # Call the apply_recurrence_from_ui service
        todo_entity_id = f"todo.{self._entry.data['name'].lower().replace(' ', '_')}"
        
        await self.hass.services.async_call(
            "better_todo",
            "apply_recurrence_from_ui",
            {"entity_id": todo_entity_id},
            blocking=True,
        )
