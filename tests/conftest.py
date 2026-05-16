"""Shared pytest fixtures for Better To-do tests.

All Home Assistant stubs are registered here (at collection time) so that
importing any ``custom_components.better_todo.*`` module works without a
running HA instance.
"""
from __future__ import annotations

import datetime
import enum
import dataclasses
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest


# ---------------------------------------------------------------------------
# Register HA stubs BEFORE any test module imports
# ---------------------------------------------------------------------------

def _register_ha_stubs() -> None:
    """Insert minimal HomeAssistant stubs into sys.modules."""

    # --- homeassistant.const ---
    ha_const = types.ModuleType("homeassistant.const")

    class _Platform(str, enum.Enum):
        TODO = "todo"

    ha_const.Platform = _Platform
    sys.modules.setdefault("homeassistant.const", ha_const)

    # --- homeassistant.config_entries ---
    ha_cfg = types.ModuleType("homeassistant.config_entries")

    class ConfigEntry:
        runtime_data = None

        def __init_subclass__(cls, domain=None, **kw):
            cls._domain = domain

    class ConfigFlow:
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

    ha_cfg.ConfigEntry = ConfigEntry
    ha_cfg.ConfigFlow = ConfigFlow
    ha_cfg.ConfigFlowResult = dict
    sys.modules.setdefault("homeassistant.config_entries", ha_cfg)

    # --- homeassistant.exceptions ---
    ha_exc = types.ModuleType("homeassistant.exceptions")

    class ConfigEntryNotReady(Exception):
        pass

    ha_exc.ConfigEntryNotReady = ConfigEntryNotReady
    sys.modules.setdefault("homeassistant.exceptions", ha_exc)

    # --- homeassistant.util ---
    ha_util = types.ModuleType("homeassistant.util")
    ha_util.slugify = lambda s: s.lower().replace(" ", "_")
    sys.modules.setdefault("homeassistant.util", ha_util)

    ha_util_dt = types.ModuleType("homeassistant.util.dt")
    ha_util_dt.now = lambda: datetime.datetime.now(datetime.timezone.utc)
    ha_util_dt.get_default_time_zone = lambda: datetime.timezone.utc
    sys.modules.setdefault("homeassistant.util.dt", ha_util_dt)

    # --- homeassistant.components.todo ---
    class TodoItemStatus(str, enum.Enum):
        NEEDS_ACTION = "needs_action"
        COMPLETED = "completed"

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
            return _IntFlag(int(self) | int(other))

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

        async def async_added_to_hass(self) -> None:
            pass

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
    components_root = sys.modules.setdefault(
        "homeassistant.components", types.ModuleType("homeassistant.components")
    )
    sys.modules.setdefault("homeassistant.components.todo", todo_mod)
    components_root.todo = todo_mod

    # --- homeassistant.components.frontend ---
    ha_frontend = types.ModuleType("homeassistant.components.frontend")
    ha_frontend.add_extra_js_url = lambda hass, url, es5=False: None
    sys.modules.setdefault("homeassistant.components.frontend", ha_frontend)
    components_root.frontend = ha_frontend

    # --- homeassistant.components.panel_custom ---
    ha_panel_custom = types.ModuleType("homeassistant.components.panel_custom")

    async def _async_register_panel(**kwargs):
        return None

    ha_panel_custom.async_register_panel = _async_register_panel
    sys.modules.setdefault("homeassistant.components.panel_custom", ha_panel_custom)
    components_root.panel_custom = ha_panel_custom

    # --- homeassistant.components.http ---
    ha_http = types.ModuleType("homeassistant.components.http")

    @dataclasses.dataclass
    class StaticPathConfig:
        url_path: str
        path: str
        cache_headers: bool

    ha_http.StaticPathConfig = StaticPathConfig
    sys.modules.setdefault("homeassistant.components.http", ha_http)
    components_root.http = ha_http

    # --- homeassistant.core ---
    ha_core = types.ModuleType("homeassistant.core")
    ha_core.HomeAssistant = object

    class ServiceCall:
        def __init__(self, data):
            self.data = data

    ha_core.ServiceCall = ServiceCall
    ha_core.callback = lambda f: f
    sys.modules.setdefault("homeassistant.core", ha_core)

    # --- homeassistant.helpers.entity_platform ---
    ha_hep = types.ModuleType("homeassistant.helpers.entity_platform")
    ha_hep.AddEntitiesCallback = object

    class _FakePlatform:
        def async_register_entity_service(self, *a, **kw):
            pass

    ha_hep.async_get_current_platform = lambda: _FakePlatform()
    sys.modules.setdefault("homeassistant.helpers", types.ModuleType("homeassistant.helpers"))
    sys.modules.setdefault("homeassistant.helpers.entity_platform", ha_hep)

    # --- homeassistant.helpers.config_validation ---
    ha_cv = types.ModuleType("homeassistant.helpers.config_validation")
    ha_cv.string = str
    sys.modules.setdefault("homeassistant.helpers.config_validation", ha_cv)

    ha_typing = types.ModuleType("homeassistant.helpers.typing")
    ha_typing.ConfigType = dict
    sys.modules.setdefault("homeassistant.helpers.typing", ha_typing)

    # --- homeassistant (root) ---
    sys.modules.setdefault("homeassistant", types.ModuleType("homeassistant"))


_register_ha_stubs()


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_ics_path(tmp_path: Path) -> Path:
    """Return a temporary .ics file path."""
    return tmp_path / "better_todo.test_list.ics"


@pytest.fixture
def mock_hass():
    """Return a minimal mock HomeAssistant instance."""
    hass = MagicMock()
    hass.data = {}
    hass.config.path = lambda *parts: str(Path(*parts))
    hass.http.async_register_static_paths = AsyncMock()
    hass.config_entries.async_forward_entry_setups = AsyncMock(return_value=True)
    hass.config_entries.async_unload_platforms = AsyncMock(return_value=True)

    async def _executor(func, *args, **kwargs):
        return func(*args, **kwargs)

    hass.async_add_executor_job = _executor
    return hass
