"""Regression checks for the dependency-free Better To-do panel bundle."""
from __future__ import annotations

from pathlib import Path


PANEL_SOURCE = (
    Path(__file__).parents[1]
    / "custom_components"
    / "better_todo"
    / "frontend"
    / "better-todo-panel.js"
)


def test_panel_refreshes_on_attribute_only_state_updates() -> None:
    """Item details can change without changing the todo entity's state."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert source.count("`${s.last_updated}|${s.state}`") == 2
    assert "`${s.last_changed}|${s.state}`" not in source


def test_panel_guards_against_stale_item_responses() -> None:
    """Both list views must ignore superseded WebSocket responses."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert source.count("const fetchSequence = ++this._fetchSequence;") == 2
    assert source.count("fetchSequence === this._fetchSequence") >= 6


def test_recurrence_targets_the_new_uid_not_a_duplicate_name() -> None:
    """New recurring tasks are identified by UID set difference."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert "new Set((await this._listItemUids()).map((item) => item.uid))" in source
    assert "!previousUids.has(item.uid)" in source
    assert "setTimeout(r, 500)" not in source


def test_panel_caches_sorted_todo_lists() -> None:
    """Unrelated HA state changes must not repeat list sorting."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert "if (!registryChanged && !statesChanged)" in source
    assert "return this._todoListsCache;" in source


def test_task_deletion_handles_stale_rows_and_updates_optimistically() -> None:
    """Deletion must not call remove_item for a row already absent in HA."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert "if (this._deleting.has(uid)) return;" in source
    assert "if (!currentItems.some((item) => item.uid === uid))" in source
    assert "this._items = currentItems.filter((item) => item.uid !== uid);" in source


def test_custom_recurrence_uses_friendly_controls_instead_of_raw_rrule() -> None:
    """Custom recurrence exposes interval/pattern controls and an ending."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert '<label class="lbl">RRULE</label>' not in source
    assert 'value="time" ?selected=${this._customMode === "time"}' in source
    assert 'value="pattern" ?selected=${this._customMode === "pattern"}' in source
    assert "multiple" in source
    assert 'value="-1" ?selected=${this._patternOrdinal === "-1"}' in source
    assert 'value="date" ?selected=${this._endMode === "date"}' in source
    assert 'value="count" ?selected=${this._endMode === "count"}' in source
    assert 'return `COUNT=${count}`;' in source
    assert 'return `UNTIL=${endDate.replaceAll("-", "")}`;' in source


def test_custom_recurrence_builds_and_parses_supported_rrules() -> None:
    """Friendly recurrence values are serialized to interoperable RRULEs."""
    source = PANEL_SOURCE.read_text(encoding="utf-8")

    assert "`FREQ=${_FREQ_BY_UNIT[recurrence.intervalUnit]};INTERVAL=${interval}`" in source
    assert ".map((day) => `${recurrence.patternOrdinal}${day}`)" in source
    assert "const ordinalDays = weekdays.map" in source
