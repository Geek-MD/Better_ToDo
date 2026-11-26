"""Tests for Better To-do todo entity (CRUD + recurrence)."""
from __future__ import annotations

import datetime
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from ical.calendar_stream import IcsCalendarStream

from custom_components.better_todo.const import (
    ATTR_ITEM,
    ATTR_QUANTITY,
    ATTR_UNIT,
    ATTR_CATEGORY,
    ATTR_NOTES,
    CONF_COMPLETED_CLEANUP_ENABLED,
    CONF_COMPLETED_RETENTION_MONTHS,
    CONF_STORAGE_KEY,
)
from custom_components.better_todo.todo import (
    BetterTodoListEntity,
    ShoppingListTodoListEntity,
    _EMPTY_ICS,
    _encode_description,
    _decode_description,
    _ha_item_to_ical,
    async_setup_entry,
)
from homeassistant.components.todo import TodoItem, TodoItemStatus
from homeassistant.core import ServiceCall
from homeassistant.exceptions import ServiceValidationError


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


@pytest.mark.asyncio
async def test_assignment_survives_reload_and_completion(tmp_path, mock_hass, monkeypatch):
    """Assignments use the task UID and survive reopening its calendar."""
    from custom_components.better_todo import todo as todo_module

    monkeypatch.setattr(
        todo_module.dt_util, "now",
        lambda: datetime.datetime(2026, 11, 25, 12, tzinfo=datetime.UTC),
    )
    mock_hass.auth.async_get_user = AsyncMock(
        return_value=SimpleNamespace(is_active=True, system_generated=False)
    )
    entity = _make_entity(tmp_path, mock_hass)
    await entity.async_create_todo_item(TodoItem(summary="Clean"))
    await entity._async_add_assigned_task("Clean", "user-one")
    await entity._async_add_assigned_task(
        "Water plants", "user-two", due_date=datetime.date(2026, 11, 25),
        rrule="FREQ=DAILY;COUNT=3",
    )
    first, assigned, recurring = entity._attr_todo_items
    assert entity.extra_state_attributes["task_assignees"] == {
        assigned.uid: "user-one", recurring.uid: "user-two",
    }

    await entity.async_update_todo_item(
        TodoItem(uid=recurring.uid, summary=recurring.summary,
                 due=recurring.due, status=TodoItemStatus.COMPLETED)
    )
    await entity._async_set_task_assignee(assigned.uid, "user-two")
    await entity._async_set_task_assignee(first.uid, "user-one")
    await entity._async_set_task_assignee(first.uid)
    entity._calendar = IcsCalendarStream.calendar_from_ics(
        (tmp_path / "test.ics").read_text(encoding="utf-8")
    )
    await entity.async_update()
    completed = next(
        task for task in entity._attr_todo_items if task.status is TodoItemStatus.COMPLETED
    )
    assert entity.extra_state_attributes["task_assignees"] == {
        assigned.uid: "user-two", recurring.uid: "user-two", completed.uid: "user-two",
    }
    assert completed.due == recurring.due
    active = next(task for task in entity._attr_todo_items if task.uid == recurring.uid)
    assert active.status is TodoItemStatus.NEEDS_ACTION


@pytest.mark.asyncio
async def test_invalid_assignee_does_not_create_task(tmp_path, mock_hass):
    """Inactive or unknown users cannot receive new tasks."""
    mock_hass.auth.async_get_user = AsyncMock(return_value=None)
    entity = _make_entity(tmp_path, mock_hass)
    with pytest.raises(ServiceValidationError):
        await entity._async_add_assigned_task("Clean", "missing-user")
    assert not entity._calendar.todos


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
async def test_async_added_to_hass_initialises_todo_items(tmp_path: Path, mock_hass) -> None:
    """async_added_to_hass must populate _attr_todo_items so the panel sees the entity."""
    entity = _make_entity(tmp_path, mock_hass)
    # Before async_added_to_hass the items must be None (nothing has run yet)
    assert entity._attr_todo_items is None
    await entity.async_added_to_hass()
    # After async_added_to_hass items must be a list (possibly empty) – never None
    assert entity._attr_todo_items is not None
    assert isinstance(entity._attr_todo_items, list)


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
    assert completed.completed is not None


@pytest.mark.asyncio
async def test_completed_task_cleanup_runs_at_startup_and_daily(tmp_path, mock_hass, monkeypatch):
    """Purge only expired completed tasks and persist the result."""
    from custom_components.better_todo import todo as todo_module

    entity = _make_entity(tmp_path, mock_hass)
    now = datetime.datetime(2028, 2, 29, 10, tzinfo=datetime.UTC)
    monkeypatch.setattr(todo_module.dt_util, "now", lambda: now)
    unsubscribe = MagicMock()
    schedule = MagicMock(return_value=unsubscribe)
    entity.async_on_remove = MagicMock()
    monkeypatch.setattr(todo_module, "async_track_time_interval", schedule)

    def stored_task(uid, status, completion=None):
        task = _ha_item_to_ical(TodoItem(uid=uid, summary=uid, status=status))
        task.completed = completion
        return task

    complete = TodoItemStatus.COMPLETED
    open_status = TodoItemStatus.NEEDS_ACTION
    january = datetime.datetime(2028, 1, 31, 10, tzinfo=datetime.UTC)
    entity._calendar.todos.extend([
        stored_task("expired", complete, january - datetime.timedelta(minutes=1)),
        stored_task("limit", complete, january),
        stored_task("legacy", complete),
        stored_task("open", open_status, january),
    ])
    await entity.async_added_to_hass()
    assert [item.uid for item in entity._attr_todo_items] == ["limit", "legacy", "open"]
    entity.async_on_remove.assert_called_once_with(unsubscribe)
    _, callback, interval = schedule.call_args.args
    assert interval == datetime.timedelta(days=1)
    await callback(now + interval)
    assert [item.uid for item in entity._attr_todo_items] == ["legacy", "open"]
    restored = IcsCalendarStream.calendar_from_ics(await entity._store.async_load())
    assert [item.uid for item in restored.todos] == ["legacy", "open"]


@pytest.mark.asyncio
async def test_failed_cleanup_keeps_the_completed_task(tmp_path, mock_hass):
    """A failed write leaves the calendar intact."""
    entity = _make_entity(tmp_path, mock_hass)
    task = _ha_item_to_ical(TodoItem(uid="old", status=TodoItemStatus.COMPLETED))
    task.completed = datetime.datetime(2026, 1, 1, tzinfo=datetime.UTC)
    entity._calendar.todos.append(task)
    await entity._async_save()
    original = await entity._store.async_load()
    entity._store.async_store = AsyncMock(side_effect=OSError("write failed"))

    assert not await entity._async_purge_completed(datetime.datetime(2026, 3, 1, tzinfo=datetime.UTC))
    assert entity._calendar.todos == [task]
    assert await entity._store.async_load() == original


@pytest.mark.asyncio
async def test_disabled_cleanup_preserves_tasks_until_reenabled(tmp_path, mock_hass, monkeypatch):
    """Both startup and daily cleanup respect changes to the enabled option."""
    from custom_components.better_todo import todo as todo_module

    entry = SimpleNamespace(options={CONF_COMPLETED_CLEANUP_ENABLED: False})
    entity = _make_entity(tmp_path, mock_hass)
    entity._config_entry = entry
    now = datetime.datetime(2026, 11, 25, 12, tzinfo=datetime.UTC)
    monkeypatch.setattr(todo_module.dt_util, "now", lambda: now)
    task = _ha_item_to_ical(TodoItem(uid="old", status=TodoItemStatus.COMPLETED))
    task.completed = now.replace(month=7)
    entity._calendar.todos.append(task)
    await entity._async_save()
    saved = await entity._store.async_load()

    await entity.async_added_to_hass()
    await entity._async_cleanup_completed(now + datetime.timedelta(days=1))
    assert [item.uid for item in entity._attr_todo_items] == ["old"]
    assert await entity._store.async_load() == saved

    entry.options = {CONF_COMPLETED_CLEANUP_ENABLED: True}
    await entity._async_cleanup_completed(now + datetime.timedelta(days=2))
    assert entity._attr_todo_items == []
    assert IcsCalendarStream.calendar_from_ics(await entity._store.async_load()).todos == []


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
        item=uid, rrule="FREQ=WEEKLY;BYDAY=MO"
    )

    attrs = entity.extra_state_attributes
    assert uid in attrs.get("task_recurrence", {})
    assert "WEEKLY" in attrs["task_recurrence"][uid]


@pytest.mark.asyncio
@pytest.mark.parametrize("timed", [False, True])
async def test_recurring_task_auto_advances(tmp_path: Path, mock_hass, monkeypatch, timed) -> None:
    """Completing an unbounded series records each occurrence and advances it."""
    from custom_components.better_todo import todo as todo_module

    entity = _make_entity(tmp_path, mock_hass)
    now = datetime.datetime(2026, 11, 25, 12, tzinfo=datetime.UTC)
    monkeypatch.setattr(todo_module.dt_util, "now", lambda: now)
    due = now if timed else now.date()
    day = datetime.timedelta(days=1)
    item = TodoItem(
        summary="Daily standup", status=TodoItemStatus.NEEDS_ACTION, due=due,
        description="[category:Work]\n\nPrepare notes",
    )
    await entity.async_create_todo_item(item)
    uid = entity._attr_todo_items[0].uid

    await entity._async_set_task_recurrence(item=uid, rrule="FREQ=DAILY")

    # Complete one due today and another early. Both should advance forward.
    for _ in range(2):
        active = next(task for task in entity._attr_todo_items if task.uid == uid)
        await entity.async_update_todo_item(replace(active, status=TodoItemStatus.COMPLETED))

    active, *completed = entity._attr_todo_items
    assert active.uid == uid
    assert active.status is TodoItemStatus.NEEDS_ACTION
    assert active.due == due + 2 * day
    assert entity.extra_state_attributes["task_recurrence"].keys() == {uid}
    assert len({task.uid for task in entity._attr_todo_items}) == 3
    assert [task.due for task in completed] == [due, due + day]
    for task in completed:
        assert task.summary == active.summary
        assert task.status is TodoItemStatus.COMPLETED
        assert task.completed == now
        assert task.description == item.description

    await entity._async_cleanup_completed(now.replace(month=12, day=26))
    assert [task.uid for task in entity._attr_todo_items] == [uid]


@pytest.mark.asyncio
async def test_final_recurring_occurrence_is_only_completed_once(tmp_path, mock_hass, monkeypatch):
    """A series with no future occurrence keeps a single completed record."""
    from custom_components.better_todo import todo as todo_module

    now = datetime.datetime(2026, 11, 25, 12, tzinfo=datetime.UTC)
    monkeypatch.setattr(todo_module.dt_util, "now", lambda: now)
    entity = _make_entity(tmp_path, mock_hass)
    await entity.async_create_todo_item(TodoItem(summary="Last task", due=now.date()))
    uid = entity._attr_todo_items[0].uid
    await entity._async_set_task_recurrence(item=uid, rrule="FREQ=DAILY;COUNT=1")
    updated = replace(entity._attr_todo_items[0], status=TodoItemStatus.COMPLETED)
    await entity.async_update_todo_item(updated)
    await entity.async_update_todo_item(updated)

    [completed] = entity._attr_todo_items
    assert completed.uid == uid
    assert completed.due == now.date()
    assert completed.status is TodoItemStatus.COMPLETED
    assert completed.completed is not None


@pytest.mark.asyncio
async def test_failed_recurring_completion_rolls_back(tmp_path, mock_hass, monkeypatch):
    """A failed write keeps both the saved calendar and the active occurrence intact."""
    from custom_components.better_todo import todo as todo_module

    now = datetime.datetime(2026, 11, 25, 12, tzinfo=datetime.UTC)
    monkeypatch.setattr(todo_module.dt_util, "now", lambda: now)
    entity = _make_entity(tmp_path, mock_hass)
    await entity.async_create_todo_item(TodoItem(summary="Repeat task", due=now.date()))
    await entity._async_set_task_recurrence(item=entity._attr_todo_items[0].uid, rrule="FREQ=DAILY")
    [active] = entity._attr_todo_items
    original = await entity._store.async_load()
    entity._store.async_store = AsyncMock(side_effect=OSError("write failed"))

    with pytest.raises(OSError, match="write failed"):
        await entity.async_update_todo_item(replace(active, status=TodoItemStatus.COMPLETED))

    await entity.async_update()
    assert entity._attr_todo_items == [active]
    assert await entity._store.async_load() == original


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

    await entity._async_set_task_recurrence(item=uid, rrule="FREQ=WEEKLY")
    await entity._async_set_task_recurrence(item=uid, rrule="")

    attrs = entity.extra_state_attributes
    assert uid not in attrs.get("task_recurrence", {})


@pytest.mark.asyncio
async def test_setup_entry_adds_default_shopping_list_once(tmp_path, mock_hass) -> None:
    """Setting up entries always includes one default Shopping List entity."""
    mock_hass.data = {}
    mock_hass.config.path = lambda *parts: str(tmp_path.joinpath(*parts))
    added_entities: list[list[BetterTodoListEntity]] = []

    def _add_entities(entities, update_before_add=False) -> None:  # noqa: ANN001, ARG001
        added_entities.append(list(entities))

    entry_one = SimpleNamespace(
        runtime_data=_make_entity(tmp_path / "my_tasks", mock_hass)._store,
        title="My Tasks",
        entry_id="entry-1",
        domain="better_todo",
        data={CONF_STORAGE_KEY: "my_tasks"},
        options={},
    )
    await async_setup_entry(mock_hass, entry_one, _add_entities)

    entry_two = SimpleNamespace(
        runtime_data=_make_entity(tmp_path / "work", mock_hass)._store,
        title="Work",
        entry_id="entry-2",
        domain="better_todo",
        data={CONF_STORAGE_KEY: "work"},
        options={},
    )
    await async_setup_entry(mock_hass, entry_two, _add_entities)

    first_names = [entity._attr_name for entity in added_entities[0]]
    second_names = [entity._attr_name for entity in added_entities[1]]
    assert "My Tasks" in first_names
    assert any(
        isinstance(e, ShoppingListTodoListEntity) for e in added_entities[0]
    ), "First setup must include a ShoppingListTodoListEntity"
    assert second_names == ["Work"]

    # Change the first entry's options after setup and run the next daily cleanup.
    entry_one.options = {CONF_COMPLETED_RETENTION_MONTHS: 2}
    completed_at = datetime.datetime(2028, 1, 31, 10, tzinfo=datetime.UTC)
    for entity in [*added_entities[0], *added_entities[1]]:
        entity.hass = mock_hass
        task = _ha_item_to_ical(TodoItem(summary="Done", status=TodoItemStatus.COMPLETED))
        task.completed = completed_at
        entity._calendar.todos.append(task)
        await entity._async_cleanup_completed(datetime.datetime(2028, 3, 1, tzinfo=datetime.UTC))
        assert bool(entity._calendar.todos) == (entity in added_entities[0])

    limit = datetime.datetime(2028, 3, 31, 10, tzinfo=datetime.UTC)
    for entity in added_entities[0]:
        assert not await entity._async_purge_completed(limit)
        assert await entity._async_purge_completed(limit + datetime.timedelta(seconds=1))


# ---------------------------------------------------------------------------
# Description encode/decode helper tests
# ---------------------------------------------------------------------------


def test_encode_description_quantity_and_category() -> None:
    """Encoding quantity and category produces the expected format."""
    result = _encode_description("2 kg", "Meat", None)
    assert result == "[quantity:2 kg] [category:Meat]"


def test_encode_description_with_notes() -> None:
    """Notes are appended after a blank line."""
    result = _encode_description("500 g", "Dairy", "Pick up at the corner shop")
    assert result == "[quantity:500 g] [category:Dairy]\n\nPick up at the corner shop"


def test_encode_description_with_unit_and_repeat() -> None:
    """Unit and repeat tags are encoded when provided."""
    result = _encode_description(
        "2",
        "Meat",
        "Pick up at the corner shop",
        unit="kg",
        repeat="FREQ=WEEKLY;BYDAY=MO",
    )
    assert (
        result
        == "[quantity:2] [unit:kg] [category:Meat] [repeat:FREQ=WEEKLY;BYDAY=MO]\n\n"
        "Pick up at the corner shop"
    )


def test_encode_description_notes_only() -> None:
    """When only notes are provided the result is just the notes string."""
    result = _encode_description(None, None, "Remember to check expiry date")
    assert result == "Remember to check expiry date"


def test_encode_description_all_none_returns_none() -> None:
    """Encoding nothing returns None."""
    assert _encode_description(None, None, None) is None


def test_decode_description_quantity_and_category() -> None:
    """Decoding a fully-encoded description returns all fields."""
    desc = "[quantity:2] [unit:kg] [category:Meat]\n\nPick up at the butcher"
    qty, cat, notes = _decode_description(desc)
    assert qty == "2 kg"
    assert cat == "Meat"
    assert notes == "Pick up at the butcher"


def test_decode_description_metadata_only() -> None:
    """Decoding metadata-only description leaves notes as None."""
    desc = "[quantity:1] [unit:L] [category:Beverages]"
    qty, cat, notes = _decode_description(desc)
    assert qty == "1 L"
    assert cat == "Beverages"
    assert notes is None


def test_decode_description_legacy_format() -> None:
    """Legacy Quantity/Category lines remain supported."""
    desc = "Quantity: 2 kg\nCategory: Meat\n\nLegacy note"
    qty, cat, notes = _decode_description(desc)
    assert qty == "2 kg"
    assert cat == "Meat"
    assert notes == "Legacy note"


def test_decode_description_none_input() -> None:
    """Decoding None returns a triple of None."""
    assert _decode_description(None) == (None, None, None)


def test_decode_description_plain_notes() -> None:
    """A plain description with no markers is treated as notes."""
    desc = "Just a plain note"
    qty, cat, notes = _decode_description(desc)
    assert qty is None
    assert cat is None
    assert notes == "Just a plain note"


def test_encode_decode_roundtrip() -> None:
    """Encoding then decoding preserves all fields."""
    qty_in, cat_in, notes_in = "3 units", "Electronics", "Handle with care"
    encoded = _encode_description(qty_in, cat_in, notes_in)
    qty_out, cat_out, notes_out = _decode_description(encoded)
    assert qty_out == qty_in
    assert cat_out == cat_in
    assert notes_out == notes_in


# ---------------------------------------------------------------------------
# set_task_details service tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_set_task_details_quantity_and_category(tmp_path: Path, mock_hass) -> None:
    """set_task_details sets quantity and category on the description field."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Buy groceries", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    call = ServiceCall({ATTR_ITEM: uid, ATTR_QUANTITY: "2 kg", ATTR_CATEGORY: "Meat"})
    await entity._async_set_task_details(call)
    await entity.async_update()

    task = next(t for t in entity._attr_todo_items if t.uid == uid)
    assert task.description is not None
    assert "[quantity:2]" in task.description
    assert "[unit:kg]" in task.description
    assert "[category:Meat]" in task.description


@pytest.mark.asyncio
async def test_set_task_details_exposed_in_attributes(tmp_path: Path, mock_hass) -> None:
    """set_task_details makes quantity/category available via extra_state_attributes."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Pick up parcel", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    call = ServiceCall({ATTR_ITEM: uid, ATTR_QUANTITY: "1", ATTR_CATEGORY: "Logistics"})
    await entity._async_set_task_details(call)

    attrs = entity.extra_state_attributes
    details = attrs.get("task_details", {})
    assert uid in details
    assert details[uid]["quantity"] == "1"
    assert details[uid]["category"] == "Logistics"


@pytest.mark.asyncio
async def test_set_task_details_explicit_unit(tmp_path: Path, mock_hass) -> None:
    """set_task_details supports explicit unit and exposes it in attributes."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Buy flour", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    call = ServiceCall(
        {ATTR_ITEM: uid, ATTR_QUANTITY: "2", ATTR_UNIT: "kg", ATTR_CATEGORY: "Bakery"}
    )
    await entity._async_set_task_details(call)
    await entity.async_update()

    task = next(t for t in entity._attr_todo_items if t.uid == uid)
    assert task.description is not None
    assert "[quantity:2]" in task.description
    assert "[unit:kg]" in task.description
    attrs = entity.extra_state_attributes
    details = attrs.get("task_details", {})
    assert details[uid]["quantity"] == "2 kg"
    assert details[uid]["unit"] == "kg"


@pytest.mark.asyncio
async def test_set_task_details_preserves_unchanged_fields(tmp_path: Path, mock_hass) -> None:
    """Calling set_task_details with one field does not wipe the others."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Monthly budget", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    # First call: set both quantity and category
    await entity._async_set_task_details(
        ServiceCall({ATTR_ITEM: uid, ATTR_QUANTITY: "5", ATTR_CATEGORY: "Finance"})
    )
    # Second call: update only the category
    await entity._async_set_task_details(
        ServiceCall({ATTR_ITEM: uid, ATTR_CATEGORY: "Accounting"})
    )

    attrs = entity.extra_state_attributes
    details = attrs.get("task_details", {})
    assert details[uid]["quantity"] == "5"        # preserved
    assert details[uid]["category"] == "Accounting"  # updated


@pytest.mark.asyncio
async def test_set_task_details_with_notes(tmp_path: Path, mock_hass) -> None:
    """Notes are stored alongside structured metadata."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Team lunch", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    call = ServiceCall(
        {ATTR_ITEM: uid, ATTR_CATEGORY: "Work", ATTR_NOTES: "Book the usual place"}
    )
    await entity._async_set_task_details(call)
    await entity.async_update()

    task = next(t for t in entity._attr_todo_items if t.uid == uid)
    assert task.description is not None
    assert "[category:Work]" in task.description
    assert "Book the usual place" in task.description


@pytest.mark.asyncio
async def test_set_task_recurrence_updates_repeat_tag(tmp_path: Path, mock_hass) -> None:
    """set_task_recurrence syncs [repeat:*] in task description."""
    entity = _make_entity(tmp_path, mock_hass)
    item = TodoItem(summary="Weekly standup", status=TodoItemStatus.NEEDS_ACTION)
    await entity.async_create_todo_item(item)
    await entity.async_update()
    uid = entity._attr_todo_items[0].uid

    await entity._async_set_task_recurrence(
        item=uid, rrule="FREQ=WEEKLY;BYDAY=MO"
    )
    await entity.async_update()
    task = next(t for t in entity._attr_todo_items if t.uid == uid)
    assert task.description is not None
    assert "[repeat:FREQ=WEEKLY;BYDAY=MO]" in task.description


@pytest.mark.asyncio
async def test_set_task_details_unknown_uid_logs_warning(
    tmp_path: Path, mock_hass, caplog
) -> None:
    """set_task_details logs a warning when the UID does not exist."""
    import logging

    entity = _make_entity(tmp_path, mock_hass)
    call = ServiceCall({ATTR_ITEM: "nonexistent-uid", ATTR_QUANTITY: "1"})
    with caplog.at_level(logging.WARNING):
        await entity._async_set_task_details(call)
    assert "nonexistent-uid" in caplog.text


# ---------------------------------------------------------------------------
# Shopping List entity feature tests
# ---------------------------------------------------------------------------


def test_shopping_list_entity_has_no_due_date_features(tmp_path: Path, mock_hass) -> None:
    """ShoppingListTodoListEntity must not advertise due-date features."""
    from custom_components.better_todo.store import BetterTodoListStore
    from homeassistant.components.todo import TodoListEntityFeature

    path = tmp_path / "shopping.ics"
    store = BetterTodoListStore(mock_hass, path)
    calendar = IcsCalendarStream.calendar_from_ics(_EMPTY_ICS)
    entity = ShoppingListTodoListEntity(
        store=store,
        calendar=calendar,
        name="Shopping List",
        unique_id="shopping-uid-001",
    )

    features = entity._attr_supported_features
    assert not (features & TodoListEntityFeature.SET_DUE_DATE_ON_ITEM), (
        "Shopping List must not support SET_DUE_DATE_ON_ITEM"
    )
    assert not (features & TodoListEntityFeature.SET_DUE_DATETIME_ON_ITEM), (
        "Shopping List must not support SET_DUE_DATETIME_ON_ITEM"
    )
    assert features & TodoListEntityFeature.SET_DESCRIPTION_ON_ITEM, (
        "Shopping List must still support SET_DESCRIPTION_ON_ITEM"
    )


def test_shopping_list_entity_uses_translation_key_for_name(tmp_path: Path, mock_hass) -> None:
    """ShoppingListTodoListEntity must rely on translation key for friendly name."""
    from custom_components.better_todo.store import BetterTodoListStore

    path = tmp_path / "shopping.ics"
    store = BetterTodoListStore(mock_hass, path)
    calendar = IcsCalendarStream.calendar_from_ics(_EMPTY_ICS)
    entity = ShoppingListTodoListEntity(
        store=store,
        calendar=calendar,
        name="Shopping List",
        unique_id="shopping-uid-translation",
    )

    assert entity._attr_translation_key == "shopping_list"
    assert entity._attr_name is None
    assert entity._attr_has_entity_name is True


@pytest.mark.asyncio
async def test_setup_entry_shopping_list_uses_shopping_entity(tmp_path, mock_hass) -> None:
    """The default Shopping List entity must be a ShoppingListTodoListEntity."""
    mock_hass.data = {}
    added_entities: list[list[BetterTodoListEntity]] = []

    def _add_entities(entities, update_before_add=False) -> None:  # noqa: ANN001, ARG001
        added_entities.append(list(entities))

    entry = SimpleNamespace(
        runtime_data=_make_entity(tmp_path, mock_hass)._store,
        title="My Tasks",
        entry_id="entry-shopping-test",
        domain="better_todo",
        data={CONF_STORAGE_KEY: "my_tasks"},
        options={},
    )
    await async_setup_entry(mock_hass, entry, _add_entities)

    all_entities = added_entities[0]
    shopping = next(
        (e for e in all_entities if isinstance(e, ShoppingListTodoListEntity)), None
    )
    assert shopping is not None, "Default Shopping List entity must be created"
    assert isinstance(shopping, ShoppingListTodoListEntity), (
        "Default Shopping List must be a ShoppingListTodoListEntity"
    )
