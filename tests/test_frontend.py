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
