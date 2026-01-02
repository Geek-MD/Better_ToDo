"""Todo platform for Better ToDo integration."""
from __future__ import annotations

import uuid
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Any

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_RECURRENCE_CURRENT_COUNT,
    ATTR_RECURRENCE_ENABLED,
    ATTR_RECURRENCE_END_COUNT,
    ATTR_RECURRENCE_END_DATE,
    ATTR_RECURRENCE_END_ENABLED,
    ATTR_RECURRENCE_END_TYPE,
    ATTR_RECURRENCE_INTERVAL,
    ATTR_RECURRENCE_UNIT,
    DOMAIN,
    GROUP_DONE,
    GROUP_FORTHCOMING,
    GROUP_NO_DUE_DATE,
    GROUP_THIS_WEEK,
    RECURRENCE_UNIT_DAYS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo todo platform."""
    entity = BetterTodoEntity(entry)
    async_add_entities([entity], True)
    
    # Store entity reference for service access
    if entry.entry_id in hass.data[DOMAIN]:
        hass.data[DOMAIN][entry.entry_id]["entities"][entity.entity_id] = entity


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
        # Store recurrence metadata for each task (keyed by uid)
        self._recurrence_data: dict[str, dict[str, Any]] = {}

    def _ensure_item_uid(self, item: TodoItem) -> TodoItem:
        """Ensure the TodoItem has a UID, generating one if needed."""
        if item.uid is None:
            return replace(item, uid=str(uuid.uuid4()))
        return item

    def _get_item_group(self, item: TodoItem) -> str:
        """Get the group category for a todo item.
        
        Returns one of: GROUP_DONE, GROUP_NO_DUE_DATE, GROUP_THIS_WEEK, GROUP_FORTHCOMING
        """
        # Check if item is completed
        if item.status == TodoItemStatus.COMPLETED:
            return GROUP_DONE
        
        # Check if item has no due date
        if not item.due:
            return GROUP_NO_DUE_DATE
        
        # Parse the due date
        try:
            # due can be a date string in format YYYY-MM-DD
            if isinstance(item.due, str):
                due_date = datetime.strptime(item.due, "%Y-%m-%d").date()
            else:
                due_date = item.due
            
            # Get current date in the user's timezone
            now = dt_util.now().date()
            
            # Calculate end of this week (Sunday)
            days_until_sunday = (6 - now.weekday()) % 7
            end_of_week = now + timedelta(days=days_until_sunday)
            
            # Categorize
            if due_date <= end_of_week:
                return GROUP_THIS_WEEK
            else:
                return GROUP_FORTHCOMING
        except (ValueError, AttributeError, TypeError):
            # If we can't parse the date, treat as no due date
            return GROUP_NO_DUE_DATE

    def _sort_items(self, items: list[TodoItem]) -> list[TodoItem]:
        """Sort items by group and due date.
        
        Order: No due date -> This week -> Forthcoming -> Done
        Within each group, sort by due date (earliest first).
        """
        # Define group order
        group_order = {
            GROUP_NO_DUE_DATE: 0,
            GROUP_THIS_WEEK: 1,
            GROUP_FORTHCOMING: 2,
            GROUP_DONE: 3,
        }
        
        def sort_key(item: TodoItem) -> tuple[int, str]:
            """Generate sort key for an item."""
            group = self._get_item_group(item)
            group_priority = group_order.get(group, 99)
            
            # For due date, use empty string if no date (will sort first in group)
            due_str = item.due if item.due else ""
            
            return (group_priority, due_str)
        
        return sorted(items, key=sort_key)

    @property
    def todo_items(self) -> list[TodoItem] | None:
        """Return the to-do items sorted by group."""
        return self._sort_items(self._items)

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a To-do item."""
        # Ensure the item has a UID
        item = self._ensure_item_uid(item)
        self._items.append(item)
        self.async_write_ha_state()

    async def async_update_todo_item(self, item: TodoItem) -> None:
        """Update a To-do item."""
        # Ensure the item has a UID
        if item.uid is None:
            # If no UID, we can't update - this shouldn't happen
            return

        # Find and update the item by uid
        for idx, existing_item in enumerate(self._items):
            if existing_item.uid == item.uid:
                self._items[idx] = item
                break
        self.async_write_ha_state()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        """Delete To-do items."""
        self._items = [item for item in self._items if item.uid not in uids]
        # Clean up recurrence data for deleted items
        for uid in uids:
            self._recurrence_data.pop(uid, None)
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

    def set_task_recurrence(
        self,
        uid: str,
        recurrence_enabled: bool,
        recurrence_interval: int | None = None,
        recurrence_unit: str | None = None,
        recurrence_end_enabled: bool = False,
        recurrence_end_type: str | None = None,
        recurrence_end_count: int | None = None,
        recurrence_end_date: str | None = None,
    ) -> None:
        """Set recurrence configuration for a task."""
        # Check if task exists using generator expression for efficiency
        if not any(item.uid == uid for item in self._items):
            return

        if recurrence_enabled:
            self._recurrence_data[uid] = {
                ATTR_RECURRENCE_ENABLED: True,
                ATTR_RECURRENCE_INTERVAL: recurrence_interval or 1,
                ATTR_RECURRENCE_UNIT: recurrence_unit or RECURRENCE_UNIT_DAYS,
                ATTR_RECURRENCE_END_ENABLED: recurrence_end_enabled,
                ATTR_RECURRENCE_END_TYPE: recurrence_end_type,
                ATTR_RECURRENCE_END_COUNT: recurrence_end_count,
                ATTR_RECURRENCE_END_DATE: recurrence_end_date,
                ATTR_RECURRENCE_CURRENT_COUNT: 0,
            }
        else:
            self._recurrence_data.pop(uid, None)

        self.async_write_ha_state()

    def get_task_recurrence(self, uid: str) -> dict[str, Any] | None:
        """Get recurrence configuration for a task."""
        return self._recurrence_data.get(uid)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra state attributes."""
        return {
            "recurrence_data": self._recurrence_data,
        }

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
