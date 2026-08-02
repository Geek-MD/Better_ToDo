"""Better To-do platform – TodoListEntity with recurring-task (RRULE) support.

Key design decisions
--------------------
* Storage format: iCalendar (.ics) via the ``ical`` library (same as local_todo).
* Recurrence:  An RRULE is stored directly on the VTODO component.
  When a recurring task is marked *completed*, it is **not** removed; instead
  its due date is automatically advanced to the **next** occurrence and its
  status is reset to NEEDS_ACTION.  This gives a "rolling" behaviour that
  works with the standard HA todo UI.
* Custom service ``better_todo.set_task_recurrence`` lets automations set or
  clear the RRULE string on any task by its UID.
* Extra state attributes expose per-task recurrence info so custom Lovelace
  cards can display/edit it.
"""
from __future__ import annotations

import asyncio
import dataclasses
import datetime
import logging
import re
from pathlib import Path
from typing import Any

import voluptuous as vol
from ical.calendar import Calendar
from ical.calendar_stream import IcsCalendarStream
from ical.exceptions import CalendarError
from ical.store import TodoStore
from ical.todo import Todo

# TodoStatus location changed in ical 13.x (Python ≥3.13)
try:
    from ical.todo_types import TodoStatus  # ical ≥13
except ModuleNotFoundError:
    from ical.todo import TodoStatus  # ical ≤12  # type: ignore[no-redef]

from ical.types.recur import Recur

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.entity_platform import (
    AddEntitiesCallback,
    async_get_current_platform,
)
from homeassistant.util import dt as dt_util

from .const import (
    ATTR_CATEGORY,
    ATTR_ITEM,
    ATTR_NOTES,
    ATTR_QUANTITY,
    ATTR_RRULE,
    ATTR_UNIT,
    DATA_DEFAULT_LIST_ADDED,
    DEFAULT_SHOPPING_LIST_KEY,
    DEFAULT_SHOPPING_LIST_NAME,
    DESC_CATEGORY_PREFIX,
    DESC_QUANTITY_PREFIX,
    DESC_TAG_CATEGORY,
    DESC_TAG_QUANTITY,
    DESC_TAG_REPEAT,
    DESC_TAG_UNIT,
    SERVICE_SET_TASK_DETAILS,
    SERVICE_SET_TASK_RECURRENCE,
    STORAGE_PATH,
)
from .store import BetterTodoListStore

_LOGGER = logging.getLogger(__name__)

# HA status  ←→  iCal status mappings
_ICS_STATUS_TO_HA: dict[TodoStatus, TodoItemStatus] = {
    TodoStatus.IN_PROCESS: TodoItemStatus.NEEDS_ACTION,
    TodoStatus.NEEDS_ACTION: TodoItemStatus.NEEDS_ACTION,
    TodoStatus.COMPLETED: TodoItemStatus.COMPLETED,
    TodoStatus.CANCELLED: TodoItemStatus.COMPLETED,
}
_HA_STATUS_TO_ICS: dict[TodoItemStatus, TodoStatus] = {
    TodoItemStatus.NEEDS_ACTION: TodoStatus.NEEDS_ACTION,
    TodoItemStatus.COMPLETED: TodoStatus.COMPLETED,
}


# ---------------------------------------------------------------------------
# Helper: convert HA TodoItem → ical Todo
# ---------------------------------------------------------------------------

def _ha_item_to_ical(item: TodoItem) -> Todo:
    """Convert a HA ``TodoItem`` to an ``ical.Todo``."""
    todo = Todo()
    if item.uid:
        todo.uid = item.uid
    if item.summary:
        todo.summary = item.summary
    if item.status:
        todo.status = _HA_STATUS_TO_ICS.get(item.status, TodoStatus.NEEDS_ACTION)

    # RFC 5545 §3.8.2.3: DUE is the *exclusive* end – ical adds +1 day for
    # date-only values, so we must pass the raw date here (the library adjusts).
    todo.due = item.due
    todo.description = item.description
    return todo


# ---------------------------------------------------------------------------
# Description field helpers (tag-based metadata encoding)
# ---------------------------------------------------------------------------

_DESC_TAG_RE = re.compile(r"\[(?P<tag>[a-z_]+):(?P<value>[^\]]+)\]")


def _split_quantity_and_unit(quantity: str | None) -> tuple[str | None, str | None]:
    """Split a free-text quantity into quantity and optional unit."""
    if not quantity:
        return None, None
    parts = quantity.strip().split(maxsplit=1)
    if not parts:
        return None, None
    if len(parts) == 1:
        return parts[0], None
    return parts[0], parts[1].strip() or None


def _join_quantity_and_unit(quantity: str | None, unit: str | None) -> str | None:
    """Join quantity and unit for legacy quantity consumers."""
    quantity_str = quantity.strip() if quantity else ""
    unit_str = unit.strip() if unit else ""
    if quantity_str and unit_str:
        return f"{quantity_str} {unit_str}"
    return quantity_str or None


def _try_parse_tag_line(line: str) -> dict[str, str] | None:
    """Parse a line containing only ``[tag:value]`` tokens."""
    matches = list(_DESC_TAG_RE.finditer(line))
    if not matches:
        return None
    consumed = _DESC_TAG_RE.sub("", line).strip()
    if consumed:
        return None
    parsed: dict[str, str] = {}
    for match in matches:
        tag = match.group("tag").strip().lower()
        value = match.group("value").strip()
        if tag and value:
            parsed[tag] = value
    return parsed or None


def _decode_description_structured(
    description: str | None,
) -> tuple[str | None, str | None, str | None, str | None, str | None]:
    """Parse description into ``(quantity, unit, category, repeat, notes)``."""
    if not description:
        return None, None, None, None, None

    quantity: str | None = None
    unit: str | None = None
    category: str | None = None
    repeat: str | None = None
    notes_lines: list[str] = []
    in_metadata = True

    for line in description.splitlines():
        if in_metadata:
            parsed_tags = _try_parse_tag_line(line.strip())
            if parsed_tags is not None:
                if quantity is None and parsed_tags.get(DESC_TAG_QUANTITY):
                    quantity = parsed_tags[DESC_TAG_QUANTITY]
                if unit is None and parsed_tags.get(DESC_TAG_UNIT):
                    unit = parsed_tags[DESC_TAG_UNIT]
                if category is None and parsed_tags.get(DESC_TAG_CATEGORY):
                    category = parsed_tags[DESC_TAG_CATEGORY]
                if repeat is None and parsed_tags.get(DESC_TAG_REPEAT):
                    repeat = parsed_tags[DESC_TAG_REPEAT]
                continue

            if line.startswith(DESC_QUANTITY_PREFIX):
                quantity_legacy, unit_legacy = _split_quantity_and_unit(
                    line[len(DESC_QUANTITY_PREFIX):].strip()
                )
                if quantity is None:
                    quantity = quantity_legacy
                if unit is None:
                    unit = unit_legacy
            elif line.startswith(DESC_CATEGORY_PREFIX):
                if category is None:
                    category = line[len(DESC_CATEGORY_PREFIX):].strip() or None
            elif line.strip() == "":
                in_metadata = False
            else:
                in_metadata = False
                notes_lines.append(line)
        else:
            notes_lines.append(line)

    notes = "\n".join(notes_lines).strip() or None
    return quantity, unit, category, repeat, notes


def _encode_description(
    quantity: str | None,
    category: str | None,
    notes: str | None,
    *,
    unit: str | None = None,
    repeat: str | None = None,
) -> str | None:
    """Build a description string encoding tag metadata and optional notes.

    The result is human-readable in the HA Tasks panel::

        [quantity:2] [unit:kg] [category:Meat] [repeat:FREQ=WEEKLY;BYDAY=MO]

        Notes go here on a separate paragraph.
    """
    tags: list[str] = []

    quantity_value = quantity.strip() if quantity else ""
    unit_value = unit.strip() if unit else ""
    if quantity_value:
        tags.append(f"[{DESC_TAG_QUANTITY}:{quantity_value}]")
    if unit_value:
        tags.append(f"[{DESC_TAG_UNIT}:{unit_value}]")

    category_value = category.strip() if category else ""
    if category_value:
        tags.append(f"[{DESC_TAG_CATEGORY}:{category_value}]")

    repeat_value = repeat.strip() if repeat else ""
    if repeat_value:
        tags.append(f"[{DESC_TAG_REPEAT}:{repeat_value}]")

    metadata = " ".join(tags)
    notes_stripped = notes.strip() if notes else ""
    if metadata and notes_stripped:
        return f"{metadata}\n\n{notes_stripped}"
    return metadata or notes_stripped or None


def _decode_description(
    description: str | None,
) -> tuple[str | None, str | None, str | None]:
    """Legacy-compatible parser returning ``(quantity, category, notes)``."""
    quantity, unit, category, _repeat, notes = _decode_description_structured(description)
    return _join_quantity_and_unit(quantity, unit), category, notes


# ---------------------------------------------------------------------------
# Platform setup
# ---------------------------------------------------------------------------

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Better To-do todo platform."""
    store: BetterTodoListStore = config_entry.runtime_data

    # Load .ics in an executor so we don't block the event loop
    ics_content = await store.async_load()
    calendar = await hass.async_add_executor_job(
        IcsCalendarStream.calendar_from_ics, ics_content or _EMPTY_ICS
    )

    name = config_entry.title
    entity = BetterTodoListEntity(
        store=store,
        calendar=calendar,
        name=name,
        unique_id=config_entry.entry_id,
    )

    entities = [entity]

    domain_data = hass.data.setdefault(config_entry.domain, {})
    if not domain_data.get(DATA_DEFAULT_LIST_ADDED):
        shopping_store = BetterTodoListStore(
            hass,
            Path(hass.config.path(STORAGE_PATH.format(key=DEFAULT_SHOPPING_LIST_KEY))),
        )
        shopping_ics_content = await shopping_store.async_load()
        shopping_calendar = await hass.async_add_executor_job(
            IcsCalendarStream.calendar_from_ics, shopping_ics_content or _EMPTY_ICS
        )
        entities.append(
            ShoppingListTodoListEntity(
                store=shopping_store,
                calendar=shopping_calendar,
                name=DEFAULT_SHOPPING_LIST_NAME,
                unique_id=f"{config_entry.domain}_{DEFAULT_SHOPPING_LIST_KEY}",
            )
        )
        domain_data[DATA_DEFAULT_LIST_ADDED] = True

    async_add_entities(entities, update_before_add=False)

    # Register the custom recurrence service on the todo platform
    platform = async_get_current_platform()
    platform.async_register_entity_service(
        SERVICE_SET_TASK_RECURRENCE,
        {
            vol.Required(ATTR_ITEM): cv.string,
            vol.Optional(ATTR_RRULE): vol.Any(None, cv.string),
        },
        "_async_set_task_recurrence",
    )
    platform.async_register_entity_service(
        SERVICE_SET_TASK_DETAILS,
        {
            vol.Required(ATTR_ITEM): cv.string,
            vol.Optional(ATTR_QUANTITY): vol.Any(None, cv.string),
            vol.Optional(ATTR_UNIT): vol.Any(None, cv.string),
            vol.Optional(ATTR_CATEGORY): vol.Any(None, cv.string),
            vol.Optional(ATTR_NOTES): vol.Any(None, cv.string),
        },
        "_async_set_task_details",
    )


# Minimal valid empty calendar used when no .ics file exists yet
_EMPTY_ICS = (
    "BEGIN:VCALENDAR\r\n"
    "VERSION:2.0\r\n"
    "PRODID:-//better_todo//better_todo 1.0//EN\r\n"
    "END:VCALENDAR\r\n"
)


# ---------------------------------------------------------------------------
# Entity
# ---------------------------------------------------------------------------

_FULL_FEATURES = (
    TodoListEntityFeature.CREATE_TODO_ITEM
    | TodoListEntityFeature.DELETE_TODO_ITEM
    | TodoListEntityFeature.UPDATE_TODO_ITEM
    | TodoListEntityFeature.MOVE_TODO_ITEM
    | TodoListEntityFeature.SET_DUE_DATE_ON_ITEM
    | TodoListEntityFeature.SET_DUE_DATETIME_ON_ITEM
    | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
)

_SHOPPING_LIST_FEATURES = (
    TodoListEntityFeature.CREATE_TODO_ITEM
    | TodoListEntityFeature.DELETE_TODO_ITEM
    | TodoListEntityFeature.UPDATE_TODO_ITEM
    | TodoListEntityFeature.MOVE_TODO_ITEM
    | TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM
)


class BetterTodoListEntity(TodoListEntity):
    """A to-do list backed by a local .ics file with RRULE support."""

    _attr_should_poll = False
    _attr_supported_features = _FULL_FEATURES
    _attr_name: str | None

    def __init__(
        self,
        store: BetterTodoListStore,
        calendar: Calendar,
        name: str,
        unique_id: str,
    ) -> None:
        """Initialize the entity."""
        self._store = store
        self._calendar = calendar
        self._calendar_lock = asyncio.Lock()
        self._attr_name = name
        self._attr_unique_id = unique_id

    # ------------------------------------------------------------------
    # HA lifecycle
    # ------------------------------------------------------------------

    async def async_added_to_hass(self) -> None:
        """Populate todo items from the in-memory calendar when first added."""
        await self.async_update()

    # ------------------------------------------------------------------
    # State helpers
    # ------------------------------------------------------------------

    def _new_todo_store(self) -> TodoStore:
        return TodoStore(self._calendar, tzinfo=dt_util.get_default_time_zone())

    def _find_ical_todo(self, uid: str) -> Todo | None:
        """Return the raw ical.Todo for the given UID, or None."""
        for todo in self._calendar.todos:
            if todo.uid == uid:
                return todo
        return None

    @staticmethod
    def _next_occurrence(todo: Todo) -> datetime.date | datetime.datetime | None:
        """Return the next occurrence date for a recurring todo, or None."""
        if not todo.rrule:
            return None

        anchor: datetime.date | datetime.datetime | None = todo.due
        if anchor is None:
            # No DUE set – cannot advance
            return None

        try:
            occurrences = list(todo.as_rrule() or [])  # type: ignore[arg-type]
        except (CalendarError, ValueError):
            return None

        if not occurrences:
            return None

        now: datetime.date | datetime.datetime
        if isinstance(anchor, datetime.datetime):
            now = dt_util.now()
        else:
            now = dt_util.now().date()

        for occ in sorted(occurrences):
            if occ > now:
                return occ

        return None

    # ------------------------------------------------------------------
    # HA state / extra attributes
    # ------------------------------------------------------------------

    async def async_update(self) -> None:
        """Rebuild ``_attr_todo_items`` from the in-memory calendar."""
        items: list[TodoItem] = []
        for todo in self._calendar.todos:
            items.append(
                TodoItem(
                    uid=todo.uid,
                    summary=todo.summary or "",
                    status=_ICS_STATUS_TO_HA.get(
                        todo.status or TodoStatus.NEEDS_ACTION,
                        TodoItemStatus.NEEDS_ACTION,
                    ),
                    due=todo.due,
                    description=todo.description,
                    completed=todo.completed,
                )
            )
        self._attr_todo_items = items

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Expose per-task recurrence info and description-tag details."""
        recurrence: dict[str, str] = {}
        details: dict[str, dict[str, str]] = {}
        for todo in self._calendar.todos:
            if todo.rrule:
                try:
                    recurrence[todo.uid] = todo.rrule.as_rrule_str()
                except (AttributeError, ValueError):
                    recurrence[todo.uid] = str(todo.rrule)
            quantity, unit, category, repeat, _ = _decode_description_structured(
                todo.description
            )
            if quantity is not None or unit is not None or category is not None or repeat is not None:
                entry: dict[str, str] = {}
                quantity_joined = _join_quantity_and_unit(quantity, unit)
                if quantity_joined is not None:
                    entry["quantity"] = quantity_joined
                if unit is not None:
                    entry["unit"] = unit
                if category is not None:
                    entry["category"] = category
                if repeat is not None:
                    entry["repeat"] = repeat
                details[todo.uid] = entry
        attrs: dict[str, Any] = {}
        if recurrence:
            attrs["task_recurrence"] = recurrence
        if details:
            attrs["task_details"] = details
        return attrs

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------

    async def async_create_todo_item(self, item: TodoItem) -> None:
        """Create a new task."""
        todo = _ha_item_to_ical(item)
        async with self._calendar_lock:
            todo_store = self._new_todo_store()
            await self.hass.async_add_executor_job(todo_store.add, todo)
            await self._async_save()
        await self.async_update_ha_state(force_refresh=True)

    async def async_update_todo_item(self, item: TodoItem) -> None:
        """Update an existing task.

        Special behaviour for recurring tasks
        --------------------------------------
        If the task being completed has an RRULE, instead of marking it
        done we advance its DUE date to the next occurrence and reset the
        status to NEEDS_ACTION.  This gives a "rolling" recurrence that
        works with the standard HA todo UI.
        """
        async with self._calendar_lock:
            existing = self._find_ical_todo(item.uid)  # type: ignore[arg-type]

            # --- Recurrence auto-advance ---
            if (
                item.status == TodoItemStatus.COMPLETED
                and existing is not None
                and existing.rrule is not None
            ):
                next_due = self._next_occurrence(existing)
                if next_due is not None:
                    # Advance instead of completing
                    item = dataclasses.replace(
                        item,
                        status=TodoItemStatus.NEEDS_ACTION,
                        due=next_due,
                    )
                    _LOGGER.debug(
                        "Recurring task '%s' auto-advanced to %s",
                        item.summary,
                        next_due,
                    )

            todo = _ha_item_to_ical(item)

            # Preserve the RRULE on updates that don't touch recurrence
            if existing is not None and existing.rrule is not None and todo.rrule is None:
                todo.rrule = existing.rrule

            todo_store = self._new_todo_store()
            await self.hass.async_add_executor_job(
                todo_store.edit, todo.uid, todo
            )
            await self._async_save()
        await self.async_update_ha_state(force_refresh=True)

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        """Delete tasks by UID."""
        async with self._calendar_lock:
            todo_store = self._new_todo_store()
            for uid in uids:
                await self.hass.async_add_executor_job(todo_store.delete, uid)
            await self._async_save()
        await self.async_update_ha_state(force_refresh=True)

    async def async_move_todo_item(
        self, uid: str, previous_uid: str | None = None
    ) -> None:
        """Reorder a task (move after *previous_uid*, or to the top if None)."""
        async with self._calendar_lock:
            todos: list[Todo] = list(self._calendar.todos)
            idx = next((i for i, t in enumerate(todos) if t.uid == uid), None)
            if idx is None:
                return
            todo = todos.pop(idx)
            if previous_uid is None:
                todos.insert(0, todo)
            else:
                prev_idx = next(
                    (i for i, t in enumerate(todos) if t.uid == previous_uid),
                    len(todos) - 1,
                )
                todos.insert(prev_idx + 1, todo)
            # Rebuild calendar todos in new order
            self._calendar.todos.clear()
            for t in todos:
                self._calendar.todos.append(t)
            await self._async_save()
        await self.async_update_ha_state(force_refresh=True)

    # ------------------------------------------------------------------
    # Custom service: set_task_details
    # ------------------------------------------------------------------

    async def _async_set_task_details(self, call: ServiceCall) -> None:
        """Handle the ``better_todo.set_task_details`` service call.

        Parameters
        ----------
        call.data[ATTR_ITEM]:     UID of the task to update.
        call.data[ATTR_QUANTITY]: Free-text quantity string (e.g. '2 kg').
                                  Omit or ``None`` to leave unchanged.
        call.data[ATTR_UNIT]:     Optional unit string (e.g. 'kg').
                                  Omit or ``None`` to leave unchanged.
        call.data[ATTR_CATEGORY]: Category label (e.g. 'Meat').
                                  Omit or ``None`` to leave unchanged.
        call.data[ATTR_NOTES]:    Optional free-text notes to store alongside
                                  the structured metadata.
                                  Omit or ``None`` to leave unchanged.
        """
        uid: str = call.data[ATTR_ITEM]
        new_quantity: str | None = call.data.get(ATTR_QUANTITY) or None
        new_unit: str | None = call.data.get(ATTR_UNIT) or None
        new_category: str | None = call.data.get(ATTR_CATEGORY) or None
        new_notes: str | None = call.data.get(ATTR_NOTES) or None

        async with self._calendar_lock:
            existing = self._find_ical_todo(uid)
            if existing is None:
                _LOGGER.warning(
                    "set_task_details: task UID '%s' not found", uid
                )
                return

            # Read back whatever was already stored so callers can update
            # individual fields without wiping the others.
            old_quantity, old_unit, old_category, old_repeat, old_notes = (
                _decode_description_structured(
                existing.description
                )
            )

            parsed_new_quantity, parsed_new_unit = _split_quantity_and_unit(new_quantity)
            quantity = (
                parsed_new_quantity if parsed_new_quantity is not None else old_quantity
            )
            unit = new_unit if new_unit is not None else (
                parsed_new_unit if parsed_new_unit is not None else old_unit
            )
            category = new_category if new_category is not None else old_category
            notes = new_notes if new_notes is not None else old_notes

            existing.description = _encode_description(
                quantity,
                category,
                notes,
                unit=unit,
                repeat=old_repeat,
            )
            await self._async_save()

        await self.async_update_ha_state(force_refresh=True)

    # ------------------------------------------------------------------
    # Custom service: set_task_recurrence
    # ------------------------------------------------------------------

    async def _async_set_task_recurrence(
        self, item: str, rrule: str | None = None
    ) -> None:
        """Handle the ``better_todo.set_task_recurrence`` service call.

        Parameters
        ----------
        item:  UID of the task to update.
        rrule: RRULE string (e.g. 'FREQ=WEEKLY;BYDAY=MO') or ``None`` / empty
               string to remove recurrence.

        Home Assistant entity services pass validated service fields as keyword
        arguments to the registered handler, rather than as a ``ServiceCall``.
        """
        uid = item
        rrule_str = rrule or None

        async with self._calendar_lock:
            existing = self._find_ical_todo(uid)
            if existing is None:
                _LOGGER.warning(
                    "set_task_recurrence: task UID '%s' not found", uid
                )
                return

            if rrule_str:
                try:
                    existing.rrule = Recur.from_rrule(rrule_str)
                except ValueError as exc:
                    _LOGGER.error(
                        "set_task_recurrence: invalid RRULE '%s': %s",
                        rrule_str,
                        exc,
                    )
                    return
            else:
                existing.rrule = None

            quantity, unit, category, _repeat, notes = _decode_description_structured(
                existing.description
            )
            existing.description = _encode_description(
                quantity,
                category,
                notes,
                unit=unit,
                repeat=rrule_str,
            )

            await self._async_save()

        await self.async_update_ha_state(force_refresh=True)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    async def _async_save(self) -> None:
        """Serialize the in-memory calendar to the .ics file."""
        content = await self.hass.async_add_executor_job(
            IcsCalendarStream.calendar_to_ics, self._calendar
        )
        await self._store.async_store(content)


# ---------------------------------------------------------------------------
# Shopping List entity (description only – no due date)
# ---------------------------------------------------------------------------

class ShoppingListTodoListEntity(BetterTodoListEntity):
    """Shopping List variant: items have only a description, no due date."""

    _attr_supported_features = _SHOPPING_LIST_FEATURES
    _attr_has_entity_name = True
    _attr_translation_key = "shopping_list"

    def __init__(
        self,
        store: BetterTodoListStore,
        calendar: Calendar,
        name: str,
        unique_id: str,
    ) -> None:
        """Initialize the Shopping List entity with a translated name."""
        super().__init__(store, calendar, name, unique_id)
        # Let HA resolve the friendly name from translations instead of using
        # the hard-coded DEFAULT_SHOPPING_LIST_NAME constant.
        self._attr_name = None
