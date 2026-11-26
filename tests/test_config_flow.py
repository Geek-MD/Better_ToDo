"""Tests for Better To-do config flow."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
import voluptuous as vol

from custom_components.better_todo.config_flow import BetterTodoConfigFlow
from custom_components.better_todo.const import (
    CONF_COMPLETED_CLEANUP_ENABLED,
    CONF_COMPLETED_RETENTION_MONTHS,
    CONF_STORAGE_KEY,
    CONF_TODO_LIST_NAME,
)


@pytest.mark.asyncio
async def test_step_user_creates_entry() -> None:
    """Submitting a valid list name creates a config entry."""
    flow = BetterTodoConfigFlow()
    result = await flow.async_step_user(
        user_input={CONF_TODO_LIST_NAME: "My Tasks"}
    )
    assert result["type"] == "create_entry"
    assert result["title"] == "My Tasks"
    assert result["data"][CONF_TODO_LIST_NAME] == "My Tasks"
    assert result["data"][CONF_STORAGE_KEY] == "my_tasks"


@pytest.mark.asyncio
async def test_step_user_shows_form_when_no_input() -> None:
    """With no user input the flow shows a form."""
    flow = BetterTodoConfigFlow()
    result = await flow.async_step_user(user_input=None)
    assert result["type"] == "form"
    assert result["step_id"] == "user"
    assert result["errors"] == {}


@pytest.mark.asyncio
async def test_slugify_storage_key() -> None:
    """Storage key is the slugified version of the list name."""
    flow = BetterTodoConfigFlow()
    result = await flow.async_step_user(
        user_input={CONF_TODO_LIST_NAME: "Shopping List"}
    )
    assert result["data"][CONF_STORAGE_KEY] == "shopping_list"


@pytest.mark.asyncio
async def test_cleanup_options_can_disable_or_choose_a_retention_period() -> None:
    """The options flow preserves prior settings when disabled and can restore the default."""
    entry = SimpleNamespace(options={})
    flow = BetterTodoConfigFlow.async_get_options_flow(entry)
    flow.config_entry = entry
    form = await flow.async_step_init()
    assert form["data_schema"]({}) == {CONF_COMPLETED_CLEANUP_ENABLED: True}

    menu = await flow.async_step_init({CONF_COMPLETED_CLEANUP_ENABLED: True})
    assert menu["type"] == "menu"
    assert menu["menu_options"] == ["default_retention", "custom_retention"]

    custom = await flow.async_step_custom_retention()
    schema = custom["data_schema"]
    assert schema({}) == {CONF_COMPLETED_RETENTION_MONTHS: 1}
    for invalid_value in (0, -1, 1.5):
        with pytest.raises(vol.Invalid):
            schema({CONF_COMPLETED_RETENTION_MONTHS: invalid_value})

    result = await flow.async_step_custom_retention(schema({CONF_COMPLETED_RETENTION_MONTHS: 3}))
    assert result["type"] == "create_entry"
    assert result["data"] == {
        CONF_COMPLETED_CLEANUP_ENABLED: True, CONF_COMPLETED_RETENTION_MONTHS: 3,
    }
    entry.options = result["data"]
    disabled = await flow.async_step_init({CONF_COMPLETED_CLEANUP_ENABLED: False})
    assert disabled["type"] == "create_entry"
    assert disabled["data"] == {
        CONF_COMPLETED_CLEANUP_ENABLED: False, CONF_COMPLETED_RETENTION_MONTHS: 3,
    }
    entry.options = disabled["data"]
    assert (await flow.async_step_init())["data_schema"]({}) == {CONF_COMPLETED_CLEANUP_ENABLED: False}
    assert (await flow.async_step_custom_retention())["data_schema"]({}) == {
        CONF_COMPLETED_RETENTION_MONTHS: 3,
    }
    restored = await flow.async_step_default_retention()
    assert restored["data"] == {
        CONF_COMPLETED_CLEANUP_ENABLED: True, CONF_COMPLETED_RETENTION_MONTHS: 1,
    }

