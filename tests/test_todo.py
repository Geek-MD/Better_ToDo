"""Tests for Better To-do todo entity (CRUD + recurrence)."""
from __future__ import annotations

import datetime
from pathlib import Path
from types import SimpleNamespace

import pytest
import voluptuous as vol

from ical.calendar_stream import IcsCalendarStream

from custom_components.better_todo.todo import (
    BetterTodoListEntity,
    _EMPTY_ICS,
    _ha_item_to_ical,
    async_setup_entry,
)
from custom_components.better_todo.const import ATTR_ITEM, ATTR_RRULE
from homeassistant.components.todo import TodoItem, TodoItemStatus


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


def test_ha_item_to_ical_basic() -> None:
    """_ha_item_to_ical maps summary, uid, status correctly."""
    item = TodoItem(
        uid="abc",
        summary="Buy milk",
        status=TodoItemStatus.NEEDS_ACTION,
    )
    todo = _ha_item_to_ical(item)
    assert todo.uid == "abc"
    assert todo.summary == "Buy milk"


def test_ha_item_to_ical_with_due_date() -> None:
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
    item = TodoItem(summary="Walk the dog", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    summaries = [t.summary for t in (entity._attr_todo_items or [])]
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

    updated = TodoItem(uid=task.uid, summary=task.summary, status=TodoItemStatus.COMPLETED)
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
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(
        summary="Weekly standup",
        status=TodoItemStatus.NEEDS_ACTION,
        due=datetime.date(2025, 6, 2),
    )
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    await entity._async_set_task_recurrence(
        {ATTR_ITEM: uid, ATTR_RRULE: "FREQ=WEEKLY;BYDAY=MO"}
    )

    attrs = entity.extra_state_attributes
    assert uid in attrs.get("task_recurrence", {})
    assert "WEEKLY" in attrs["task_recurrence"][uid]


@pytest.mark.asyncio
async def test_recurring_task_auto_advances(tmp_path: Path, mock_hass) -> None:
    """Completing a recurring task advances it to the next occurrence."""
    entity = _make_entity(tmp_path, mock_hass)
    today = datetime.date.today()
    item = TodoItem(summary="Daily standup", status=TodoItemStatus.NEEDS_ACTION, due=today)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    await entity._async_set_task_recurrence(
        {ATTR_ITEM: uid, ATTR_RRULE: "FREQ=DAILY;COUNT=10"}
    )

    updated = TodoItem(uid=uid, summary="Daily standup", status=TodoItemStatus.COMPLETED)
    await entity.async_update_todo_item(updated)
    await entity.async_update()

    task = next((t for t in entity._attr_todo_items if t.uid == uid), None)
    assert task is not None, "Task must not be deleted on completion of recurring task"
    assert task.status == TodoItemStatus.NEEDS_ACTION, (
        "Recurring task should reset to NEEDS_ACTION after completion"
    )
    assert task.due is not None
    assert task.due > today, "Due date must advance past today"


@pytest.mark.asyncio
async def test_remove_recurrence(tmp_path: Path, mock_hass) -> None:
    """Passing empty rrule removes recurrence from a task."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(
        summary="Weekly report",
        status=TodoItemStatus.NEEDS_ACTION,
        due=datetime.date(2025, 6, 2),
    )
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    await entity._async_set_task_recurrence(
        {ATTR_ITEM: uid, ATTR_RRULE: "FREQ=WEEKLY"}
    )
    await entity._async_set_task_recurrence(
        {ATTR_ITEM: uid, ATTR_RRULE: ""}
    )

    attrs = entity.extra_state_attributes
    assert uid not in attrs.get("task_recurrence", {})


@pytest.mark.asyncio
async def test_async_setup_entry_registers_entity_service_schema(
    tmp_path: Path, mock_hass, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Entity service registration uses a plain entity-service field schema."""
    from custom_components.better_todo.store import BetterTodoListStore

    store = BetterTodoListStore(mock_hass, tmp_path / "setup.ics")
    config_entry = SimpleNamespace(
        runtime_data=store,
        title="Test List",
        entry_id="test-entry-id",
    )
    registered: dict[str, object] = {}

    class FakePlatform:
        def async_register_entity_service(self, name, schema, method):
            registered["name"] = name
            registered["schema"] = schema
            registered["method"] = method

    added_entities: list[BetterTodoListEntity] = []

    def _add_entities(entities, update_before_add=False):
        added_entities.extend(entities)

    monkeypatch.setattr(
        "custom_components.better_todo.todo.async_get_current_platform",
        lambda: FakePlatform(),
    )

    await async_setup_entry(mock_hass, config_entry, _add_entities)

    assert len(added_entities) == 1
    assert registered["name"] == "set_task_recurrence"
    assert registered["method"] == "_async_set_task_recurrence"
    assert isinstance(registered["schema"], dict)
    schema = registered["schema"]
    assert vol.Required(ATTR_ITEM) in schema
    assert vol.Optional(ATTR_RRULE) in schema
