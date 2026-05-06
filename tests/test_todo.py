"""Tests for Better To-do todo entity (CRUD + recurrence)."""
from __future__ import annotations

import asyncio
import datetime
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Minimal stubs so the todo module can be imported outside HA
# ---------------------------------------------------------------------------

def _stub_ha_modules():
    """Register lightweight HA stubs in sys.modules."""

    def _noop(*args, **kwargs):
        pass

    # homeassistant.components.todo stubs
    import enum

    class TodoItemStatus(str, enum.Enum):
        NEEDS_ACTION = "needs_action"
        COMPLETED = "completed"

    import dataclasses

    @dataclasses.dataclass
    class TodoItem:
        summary: str | None = None
        uid: str | None = None
        status: "TodoItemStatus | None" = None
        due: "datetime.date | datetime.datetime | None" = None
        description: str | None = None
        completed: "datetime.datetime | None" = None

    class _IntFlag(int):
        def __or__(self, other):
            v = int(self) | int(other)
            r = _IntFlag(v)
            return r

        def __ror__(self, other):
            return self.__or__(other)

    class TodoListEntityFeature:
        CREATE_TODO_ITEM = _IntFlag(1)
        DELETE_TODO_ITEM = _IntFlag(2)
        UPDATE_TODO_ITEM = _IntFlag(4)
        MOVE_TODO_ITEM = _IntFlag(8)
        SET_DUE_DATE_ON_ITEM = _IntFlag(16)
        SET_DUE_DATETIME_ON_ITEM = _IntFlag(32)
        SET_DESCRIPTION_ON_ITEM = _IntFlag(64)

    class TodoListEntity:
        _attr_todo_items = None
        _attr_has_entity_name = False
        _attr_should_poll = True
        _attr_supported_features = None
        _attr_name = None
        _attr_unique_id = None

        async def async_update_ha_state(self, force_refresh=False):
            if force_refresh:
                await self.async_update()

        async def async_update(self):
            pass

    todo_mod = types.ModuleType("homeassistant.components.todo")
    todo_mod.TodoItem = TodoItem
    todo_mod.TodoItemStatus = TodoItemStatus
    todo_mod.TodoListEntity = TodoListEntity
    todo_mod.TodoListEntityFeature = TodoListEntityFeature

    # homeassistant.core
    ha_core = types.ModuleType("homeassistant.core")
    ha_core.HomeAssistant = object

    class _ServiceCall:
        def __init__(self, data):
            self.data = data

    ha_core.ServiceCall = _ServiceCall
    ha_core.callback = lambda f: f

    # homeassistant.config_entries
    ha_cfg = types.ModuleType("homeassistant.config_entries")
    ha_cfg.ConfigEntry = object

    # homeassistant.helpers.entity_platform
    ha_hep = types.ModuleType("homeassistant.helpers.entity_platform")
    ha_hep.AddEntitiesCallback = object

    class _FakePlatform:
        def async_register_entity_service(self, *a, **kw):
            pass

    ha_hep.async_get_current_platform = lambda: _FakePlatform()

    # homeassistant.helpers.config_validation
    ha_cv = types.ModuleType("homeassistant.helpers.config_validation")
    ha_cv.string = str

    # homeassistant.util
    ha_util = types.ModuleType("homeassistant.util")

    ha_util_dt = types.ModuleType("homeassistant.util.dt")
    import datetime as _dt

    ha_util_dt.now = lambda: _dt.datetime.now(_dt.timezone.utc)
    ha_util_dt.get_default_time_zone = lambda: _dt.timezone.utc

    for name, mod in {
        "homeassistant": types.ModuleType("homeassistant"),
        "homeassistant.components": types.ModuleType("homeassistant.components"),
        "homeassistant.components.todo": todo_mod,
        "homeassistant.core": ha_core,
        "homeassistant.config_entries": ha_cfg,
        "homeassistant.helpers": types.ModuleType("homeassistant.helpers"),
        "homeassistant.helpers.entity_platform": ha_hep,
        "homeassistant.helpers.config_validation": ha_cv,
        "homeassistant.util": ha_util,
        "homeassistant.util.dt": ha_util_dt,
    }.items():
        sys.modules.setdefault(name, mod)


_stub_ha_modules()

# Now safe to import
from custom_components.better_todo.todo import (  # noqa: E402
    BetterTodoListEntity,
    _ha_item_to_ical,
    _EMPTY_ICS,
)
from custom_components.better_todo.const import ATTR_ITEM, ATTR_RRULE  # noqa: E402

# Re-import after stubs are in place
from homeassistant.components.todo import TodoItem, TodoItemStatus  # noqa: E402

# ical imports (real library)
from ical.calendar_stream import IcsCalendarStream  # noqa: E402
from ical.types.recur import Recur  # noqa: E402


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_entity(tmp_path: Path, mock_hass) -> BetterTodoListEntity:
    """Create a BetterTodoListEntity backed by a temp file."""
    from custom_components.better_todo.store import BetterTodoListStore

    path = tmp_path / "test.ics"
    store = BetterTodoListStore(mock_hass, path)
    calendar = IcsCalendarStream.calendar_from_ics(_EMPTY_ICS)
    entity = BetterTodoListEntity(
        store=store,
        calendar=calendar,
        name="Test List",
        unique_id="test-uid-001",
    )
    entity.hass = mock_hass
    return entity


# ---------------------------------------------------------------------------
# Helper conversion tests
# ---------------------------------------------------------------------------


def test_ha_item_to_ical_basic():
    """_ha_item_to_ical maps summary, uid, status correctly."""
    item = TodoItem(
        uid="abc",
        summary="Buy milk",
        status=TodoItemStatus.NEEDS_ACTION,
    )
    todo = _ha_item_to_ical(item)
    assert todo.uid == "abc"
    assert todo.summary == "Buy milk"


def test_ha_item_to_ical_with_due_date():
    """_ha_item_to_ical preserves date-only due."""
    due = datetime.date(2025, 6, 15)
    item = TodoItem(uid="x", summary="Task", due=due, status=TodoItemStatus.NEEDS_ACTION)
    todo = _ha_item_to_ical(item)
    assert todo.due == due


# ---------------------------------------------------------------------------
# CRUD tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_todo_item(tmp_path: Path, mock_hass) -> None:
    """Creating a task adds it to the entity's todo list."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(
        summary="Walk the dog",
        status=TodoItemStatus.NEEDS_ACTION,
    )
    await entity.async_create_todo_item(item)
    await entity.async_update()
    assert entity._attr_todo_items is not None
    summaries = [t.summary for t in entity._attr_todo_items]
    assert "Walk the dog" in summaries


@pytest.mark.asyncio
async def test_delete_todo_item(tmp_path: Path, mock_hass) -> None:
    """Deleting a task removes it from the entity's todo list."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Temporary task", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid
    await entity.async_delete_todo_items([uid])
    await entity.async_update()
    assert entity._attr_todo_items == []


@pytest.mark.asyncio
async def test_update_todo_item_status(tmp_path: Path, mock_hass) -> None:
    """Marking a non-recurring task completed sets its status."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="One-off task", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    task = entity._attr_todo_items[0]

    updated = TodoItem(
        uid=task.uid,
        summary=task.summary,
        status=TodoItemStatus.COMPLETED,
    )
    await entity.async_update_todo_item(updated)
    await entity.async_update()
    completed = next(t for t in entity._attr_todo_items if t.uid == task.uid)
    assert completed.status == TodoItemStatus.COMPLETED


# ---------------------------------------------------------------------------
# Recurrence tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_task_recurrence_service(tmp_path: Path, mock_hass) -> None:
    """set_task_recurrence service sets RRULE on a task."""
    from homeassistant.core import ServiceCall  # type: ignore[attr-defined]

    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(
        summary="Weekly standup",
        status=TodoItemStatus.NEEDS_ACTION,
        due=datetime.date(2025, 6, 2),  # a Monday
    )
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    call = ServiceCall({"item": uid, "rrule": "FREQ=WEEKLY;BYDAY=MO"})
    await entity._async_set_task_recurrence(call)

    attrs = entity.extra_state_attributes
    assert uid in attrs.get("task_recurrence", {})
    assert "WEEKLY" in attrs["task_recurrence"][uid]


@pytest.mark.asyncio
async def test_recurring_task_auto_advances(tmp_path: Path, mock_hass) -> None:
    """Completing a recurring task advances it to the next occurrence."""
    from homeassistant.core import ServiceCall  # type: ignore[attr-defined]

    entity = _make_entity(tmp_path, mock_hass)
    # Create a task due today
    today = datetime.date.today()
    item = TodoItem(
        summary="Daily standup",
        status=TodoItemStatus.NEEDS_ACTION,
        due=today,
    )
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    # Set daily recurrence
    call = ServiceCall({"item": uid, "rrule": "FREQ=DAILY;COUNT=10"})
    await entity._async_set_task_recurrence(call)

    # Mark the task complete — should auto-advance, not complete
    updated = TodoItem(uid=uid, summary="Daily standup", status=TodoItemStatus.COMPLETED)
    await entity.async_update_todo_item(updated)
    await entity.async_update()

    task = next((t for t in entity._attr_todo_items if t.uid == uid), None)
    assert task is not None, "Task should not be deleted on completion of recurring task"
    assert task.status == TodoItemStatus.NEEDS_ACTION, (
        "Recurring task should reset to NEEDS_ACTION after completion"
    )
    assert task.due is not None
    assert task.due > today, "Due date should advance past today"


@pytest.mark.asyncio
async def test_remove_recurrence(tmp_path: Path, mock_hass) -> None:
    """Passing empty rrule removes recurrence from a task."""
    from homeassistant.core import ServiceCall  # type: ignore[attr-defined]

    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(
        summary="Weekly report",
        status=TodoItemStatus.NEEDS_ACTION,
        due=datetime.date(2025, 6, 2),
    )
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    # Set then remove recurrence
    await entity._async_set_task_recurrence(ServiceCall({"item": uid, "rrule": "FREQ=WEEKLY"}))
    await entity._async_set_task_recurrence(ServiceCall({"item": uid, "rrule": ""}))

    attrs = entity.extra_state_attributes
    assert uid not in attrs.get("task_recurrence", {})
