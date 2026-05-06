"""Tests for Better To-do config flow."""
from __future__ import annotations

import pytest

from custom_components.better_todo.config_flow import BetterTodoConfigFlow
from custom_components.better_todo.const import CONF_STORAGE_KEY, CONF_TODO_LIST_NAME


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

