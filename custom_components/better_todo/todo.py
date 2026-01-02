"""Todo platform for Better ToDo integration."""
from __future__ import annotations

from typing import Any

from homeassistant.components.todo import (
    TodoItem,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo todo platform."""
    async_add_entities([BetterTodoEntity(entry)], True)


class BetterTodoEntity(TodoListEntity):
    """A To-do List representation of the Better ToDo integration."""

    _attr_has_entity_name = True
    _attr_supported_features = (
        TodoListEntityFeature.CREATE_TODO_ITEM
        | TodoListEntityFeature.UPDATE_TODO_ITEM
        | TodoListEntityFeature.DELETE_TODO_ITEM
        | TodoListEntityFeature.MOVE_TODO_ITEM
        | TodoListEntityFeature.SET_DUE_DATE_ON_ITEM
        | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
    )

    def __init__(self, entry: ConfigEntry) -> None:
        """Initialize BetterTodoEntity."""
        self._entry = entry
        self._attr_unique_id = entry.entry_id
        self._attr_name = None  # Will use the device name
        self._items: list[TodoItem] = []

    @property
    def todo_items(self) -> list[TodoItem] | None:
        """Return the to-do items."""
        return self._items

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a To-do item."""
        self._items.append(item)
        self.async_write_ha_state()

    async def async_update_todo_item(self, item: TodoItem) -> None:
        """Update a To-do item."""
        # Find and update the item by uid
        for idx, existing_item in enumerate(self._items):
            if existing_item.uid == item.uid:
                self._items[idx] = item
                break
        self.async_write_ha_state()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        """Delete To-do items."""
        self._items = [item for item in self._items if item.uid not in uids]
        self.async_write_ha_state()

    async def async_move_todo_item(
        self, uid: str, previous_uid: str | None = None
    ) -> None:
        """Move a To-do item."""
        # Find the item to move
        item_to_move = None
        for idx, item in enumerate(self._items):
            if item.uid == uid:
                item_to_move = self._items.pop(idx)
                break

        if item_to_move is None:
            return

        # Find the position to insert
        if previous_uid is None:
            # Move to the beginning
            self._items.insert(0, item_to_move)
        else:
            # Find previous item and insert after it
            inserted = False
            for idx, item in enumerate(self._items):
                if item.uid == previous_uid:
                    self._items.insert(idx + 1, item_to_move)
                    inserted = True
                    break
            # If previous_uid not found, append at the end
            if not inserted:
                self._items.append(item_to_move)

        self.async_write_ha_state()

    @property
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Todo List",
            "sw_version": "0.1.0",
        }
