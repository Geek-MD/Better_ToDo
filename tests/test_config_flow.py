"""Tests for Better To-do config flow."""
from __future__ import annotations

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Stub out homeassistant so the config_flow module can be imported without a
# running HA instance.
# ---------------------------------------------------------------------------

def _make_ha_stubs():
    """Insert minimal HA stubs into sys.modules."""
    ha = types.ModuleType("homeassistant")
    ha_core = types.ModuleType("homeassistant.core")
    ha_core.HomeAssistant = object
    ha_cfg = types.ModuleType("homeassistant.config_entries")

    class _ConfigFlow:
        def __init_subclass__(cls, domain=None, **kw):
            cls._domain = domain

        async def async_step_user(self, user_input=None):
            raise NotImplementedError

        def async_create_entry(self, *, title, data):
            return {"type": "create_entry", "title": title, "data": data}

        def async_show_form(self, *, step_id, data_schema, errors):
            return {"type": "form", "step_id": step_id, "errors": errors}

        def _async_abort_entries_match(self, match):
            pass

    ha_cfg.ConfigFlow = _ConfigFlow
    ha_cfg.ConfigFlowResult = dict

    ha_util = types.ModuleType("homeassistant.util")
    ha_util.slugify = lambda s: s.lower().replace(" ", "_")

    for name, mod in {
        "homeassistant": ha,
        "homeassistant.core": ha_core,
        "homeassistant.config_entries": ha_cfg,
        "homeassistant.util": ha_util,
    }.items():
        sys.modules.setdefault(name, mod)


_make_ha_stubs()

# Now import the module under test
from custom_components.better_todo.config_flow import (  # noqa: E402
    BetterTodoConfigFlow,
)
from custom_components.better_todo.const import (  # noqa: E402
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
