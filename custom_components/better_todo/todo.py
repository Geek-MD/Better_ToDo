"""Custom todo entity for Better ToDo integration (NOT using Platform.TODO)."""
from __future__ import annotations

import logging
import uuid
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timedelta
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import Entity
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers import storage
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
    GROUP_FORTHCOMING,
    GROUP_NO_DUE_DATE,
    GROUP_THIS_WEEK,
    RECURRENCE_UNIT_DAYS,
)

_LOGGER = logging.getLogger(__name__)

# Header prefixes for group identification (used for backward compatibility with standard todo-list card)
# These are removed when using the custom better-todo-card
HEADER_PREFIX = "--- "
HEADER_SUFFIX = " ---"

STORAGE_VERSION = 1

# Task status constants (replicating TodoItemStatus)
STATUS_NEEDS_ACTION = "needs_action"
STATUS_COMPLETED = "completed"


@dataclass
class TodoItem:
    """Represent a todo item (replicate homeassistant.components.todo.TodoItem)."""

    summary: str
    uid: str | None = None
    status: str = STATUS_NEEDS_ACTION
    due: str | None = None
    description: str | None = None


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better ToDo custom entity (NOT using Platform.TODO)."""
    entity = BetterTodoEntity(hass, entry)
    await entity.async_load_data()
    async_add_entities([entity], True)
    
    # Store entity reference for service access
    if entry.entry_id in hass.data[DOMAIN]:
        hass.data[DOMAIN][entry.entry_id]["entities"][entity.entity_id] = entity


class BetterTodoEntity(Entity):
    """A custom To-do List entity that does NOT inherit from TodoListEntity.
    
    This entity replicates all TodoListEntity functionality but is NOT recognized
    by Home Assistant's core Todo integration, so it won't appear in the native
    "To-do lists" dashboard.
    """

    _attr_has_entity_name = True
    _attr_name = None  # Will use the device name
    _attr_icon = "mdi:format-list-checks"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize BetterTodoEntity."""
        self._entry = entry
        self._attr_unique_id = entry.entry_id
        self._attr_name = None  # Will use the device name
        self._items: list[TodoItem] = []
        # Store recurrence metadata for each task (keyed by uid)
        self._recurrence_data: dict[str, dict[str, Any]] = {}
        self._hass = hass
        
        # Storage for persistent task data
        self._store = storage.Store(
            hass,
            STORAGE_VERSION,
            f"{DOMAIN}.{entry.entry_id}.tasks"
        )

    async def async_load_data(self) -> None:
        """Load task data from storage."""
        data = await self._store.async_load()
        if data:
            # Convert stored dicts back to TodoItem objects with error handling
            items_data = data.get("items", [])
            self._items = []
            for item in items_data:
                try:
                    if isinstance(item, dict):
                        # Validate required fields
                        if "summary" not in item:
                            _LOGGER.warning("Skipping item without summary: %s", item)
                            continue
                        self._items.append(TodoItem(**item))
                    else:
                        self._items.append(item)
                except (TypeError, ValueError) as err:
                    _LOGGER.error("Failed to load task item: %s - %s", item, err)
            self._recurrence_data = data.get("recurrence_data", {})

    async def async_save_data(self) -> None:
        """Save task data to storage."""
        from dataclasses import is_dataclass
        
        # Convert TodoItem objects to dicts for JSON serialization
        items_data = []
        for item in self._items:
            if is_dataclass(item):
                items_data.append(asdict(item))
            elif isinstance(item, dict):
                items_data.append(item)
            else:
                _LOGGER.warning("Unknown item type during save: %s", type(item))
        
        await self._store.async_save({
            "items": items_data,
            "recurrence_data": self._recurrence_data,
        })

    @property
    def state(self) -> str:
        """Return the state of the entity (number of active tasks)."""
        active_count = sum(
            1 for item in self._items 
            if item.status != STATUS_COMPLETED
        )
        return str(active_count)

    @property
    def entity_id(self) -> str:
        """Return entity ID using 'todo' domain."""
        # Use 'todo' domain to maintain compatibility
        list_name = self._entry.data.get("name", "tasks")
        slug = list_name.lower().replace(" ", "_")
        return f"todo.{slug}"

    def _ensure_item_uid(self, item: TodoItem) -> TodoItem:
        """Ensure the TodoItem has a UID, generating one if needed."""
        if item.uid is None:
            return replace(item, uid=str(uuid.uuid4()))
        return item

    def _get_group_label(self, group: str) -> str:
        """Get the translated label for a group category.
        
        Returns the appropriate label based on the system language.
        Note: GROUP_DONE is no longer used - completed tasks are handled by HA's native UI.
        """
        if self.hass is None:
            language = "en"
        else:
            language = self.hass.config.language
        
        # Spanish translations
        if language.startswith("es"):
            labels = {
                GROUP_NO_DUE_DATE: "Sin fecha de vencimiento",
                GROUP_THIS_WEEK: "Esta semana",
                GROUP_FORTHCOMING: "Próximamente",
            }
        else:
            # English and other languages default to English
            labels = {
                GROUP_NO_DUE_DATE: "No due date",
                GROUP_THIS_WEEK: "This week",
                GROUP_FORTHCOMING: "Forthcoming",
            }
        
        return labels.get(group, group)

    def _is_header_item(self, item: TodoItem) -> bool:
        """Check if an item is a category header.
        
        Headers are identified by having a summary starting with the header prefix.
        """
        if not item.summary:
            return False
        return bool(item.summary.startswith(HEADER_PREFIX) and item.summary.endswith(HEADER_SUFFIX))

    def _get_header_group(self, item: TodoItem) -> str | None:
        """Extract the group from a header item.
        
        Returns the group key if this is a header, None otherwise.
        Note: GROUP_DONE labels removed - completed tasks use HA's native UI.
        """
        if not self._is_header_item(item):
            return None
        
        # Remove prefix and suffix to get the label
        label = item.summary[len(HEADER_PREFIX):-len(HEADER_SUFFIX)]
        
        # Map back to group keys
        if self.hass is None:
            language = "en"
        else:
            language = self.hass.config.language
        
        if language.startswith("es"):
            label_to_group = {
                "Sin fecha de vencimiento": GROUP_NO_DUE_DATE,
                "Esta semana": GROUP_THIS_WEEK,
                "Próximamente": GROUP_FORTHCOMING,
            }
        else:
            label_to_group = {
                "No due date": GROUP_NO_DUE_DATE,
                "This week": GROUP_THIS_WEEK,
                "Forthcoming": GROUP_FORTHCOMING,
            }
        
        return label_to_group.get(label)

    def _create_header_item(self, group: str) -> TodoItem:
        """Create a header item for a group category."""
        label = self._get_group_label(group)
        return TodoItem(
            uid=f"header_{group}",
            summary=f"{HEADER_PREFIX}{label}{HEADER_SUFFIX}",
            status=STATUS_NEEDS_ACTION,
        )

    def _get_week_start_day(self) -> int:
        """Get the first day of the week based on locale settings.
        
        Returns:
            0 for Monday (used in most locales including Spanish)
            6 for Sunday (used in US English and some other locales)
        
        Home Assistant's language/locale determines the week start:
        - Spanish (es): Monday (0)
        - English (en): Sunday (6) for US, Monday (0) for UK/others
        
        This uses Python's weekday() where Monday=0, Sunday=6
        """
        if self.hass is None:
            # Default to Monday if hass not available
            return 0
        
        # Get the language from Home Assistant configuration
        language = self.hass.config.language
        
        # Map languages to their first weekday
        # Sunday (6) for US English and similar locales
        # Monday (0) for most other locales including Spanish
        sunday_first_locales = ["en-US", "en_US"]
        
        # Check if the language uses Sunday as first day
        if language in sunday_first_locales:
            return 6  # Sunday
        
        # Default to Monday for all other locales (including "es", "en-GB", etc.)
        return 0  # Monday

    def _get_item_group(self, item: TodoItem) -> str:
        """Get the group category for a todo item.
        
        Returns one of: GROUP_NO_DUE_DATE, GROUP_THIS_WEEK, GROUP_FORTHCOMING
        Note: Completed items are not grouped here - they use HA's native "Completed" section
        """
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
            
            # Get the week start day based on locale
            week_start = self._get_week_start_day()
            
            # Calculate the start and end of the current week
            # weekday() returns 0=Monday, 6=Sunday
            current_weekday = now.weekday()
            
            if week_start == 0:  # Week starts on Monday
                # Calculate days since Monday
                days_since_start = current_weekday
                # Calculate days until Sunday (end of week)
                days_until_end = 6 - current_weekday
            else:  # Week starts on Sunday (week_start == 6)
                # Calculate days since Sunday
                days_since_start = (current_weekday + 1) % 7
                # Calculate days until Saturday (end of week)
                days_until_end = 6 - days_since_start
            
            week_start_date = now - timedelta(days=days_since_start)
            week_end_date = now + timedelta(days=days_until_end)
            
            # Categorize: task is "this week" if due date is within current week
            if week_start_date <= due_date <= week_end_date:
                return GROUP_THIS_WEEK
            else:
                return GROUP_FORTHCOMING
        except (ValueError, AttributeError, TypeError):
            # If we can't parse the date, treat as no due date
            return GROUP_NO_DUE_DATE

    def _sort_items(self, items: list[TodoItem]) -> list[TodoItem]:
        """Sort items by group and due date, inserting category headers.
        
        Order: No due date -> This week -> Forthcoming
        Completed items are handled by HA's native "Completed" section.
        Within each group, sort by due date (earliest first).
        Inserts header items between groups for visual separation.
        """
        # Filter out existing header items and only keep active (non-completed) task items
        actual_items = [item for item in items 
                       if not self._is_header_item(item) 
                       and item.status != STATUS_COMPLETED]
        
        if not actual_items:
            return []
        
        # Define group order (only active task groups)
        group_order = {
            GROUP_NO_DUE_DATE: 0,
            GROUP_THIS_WEEK: 1,
            GROUP_FORTHCOMING: 2,
        }
        
        # Group items by category (only active tasks)
        grouped: dict[str, list[TodoItem]] = {
            GROUP_NO_DUE_DATE: [],
            GROUP_THIS_WEEK: [],
            GROUP_FORTHCOMING: [],
        }
        
        for item in actual_items:
            group = self._get_item_group(item)
            if group in grouped:
                grouped[group].append(item)
        
        # Sort items within each group by due date
        for group in grouped:
            grouped[group].sort(key=lambda item: item.due if item.due else "")
        
        # Build final list with headers
        result: list[TodoItem] = []
        
        for group in sorted(group_order.keys(), key=lambda g: group_order[g]):
            group_items = grouped[group]
            if group_items:  # Only add header if group has items
                # Add header
                result.append(self._create_header_item(group))
                # Add items in this group
                result.extend(group_items)
        
        return result

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return extra state attributes including all task data."""
        # Get sorted items for display
        sorted_items = self._sort_items(self._items)
        
        # Get completed items
        completed_items = [
            item for item in self._items 
            if not self._is_header_item(item) and item.status == STATUS_COMPLETED
        ]
        
        # Convert TodoItem objects to dicts for attributes
        sorted_items_dict = [asdict(item) for item in sorted_items]
        completed_items_dict = [asdict(item) for item in completed_items]
        
        return {
            "items": sorted_items_dict,
            "todo_items": sorted_items_dict,  # Alias for custom cards compatibility
            "completed_items": completed_items_dict,
            "recurrence_data": self._recurrence_data,
            "total_tasks": len([i for i in self._items if not self._is_header_item(i)]),
        }

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a To-do item."""
        # Ensure the item has a UID
        item = self._ensure_item_uid(item)
        self._items.append(item)
        await self.async_save_data()
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
        await self.async_save_data()
        self.async_write_ha_state()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        """Delete To-do items."""
        self._items = [item for item in self._items if item.uid not in uids]
        # Clean up recurrence data for deleted items
        for uid in uids:
            self._recurrence_data.pop(uid, None)
        await self.async_save_data()
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

        await self.async_save_data()
        self.async_write_ha_state()

    def get_item_by_uid(self, uid: str) -> TodoItem | None:
        """Get a task item by its UID.
        
        Public method for accessing items without exposing internal list.
        """
        for item in self._items:
            if item.uid == uid:
                return item
        return None

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
    def device_info(self) -> dict[str, Any]:
        """Return device information about this entity."""
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": self._entry.data["name"],
            "manufacturer": "Better ToDo",
            "model": "Task List",
            "sw_version": "0.5.0",
        }

