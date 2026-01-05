"""The Better ToDo integration.

This integration provides advanced ToDo list management for Home Assistant
with support for recurring tasks, custom dashboards, and sidebar integration.

Sidebar Integration:
-------------------
Better ToDo creates a Lovelace dashboard that appears in the Home Assistant sidebar.
This is achieved through:

1. Dashboard Storage: Creating a Lovelace dashboard in storage mode with
   show_in_sidebar: True that contains custom cards for task management
   and recurrence configuration.

2. Resource Registration: Registering custom JavaScript cards that provide
   the UI for the dashboard.

The dashboard automatically appears in the sidebar when created, making it
easily accessible like other Lovelace dashboards.
"""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import (
    ATTR_RECURRENCE_ENABLED,
    ATTR_RECURRENCE_END_COUNT,
    ATTR_RECURRENCE_END_DATE,
    ATTR_RECURRENCE_END_ENABLED,
    ATTR_RECURRENCE_END_TYPE,
    ATTR_RECURRENCE_INTERVAL,
    ATTR_RECURRENCE_UNIT,
    DOMAIN,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [
    Platform.NUMBER,
    Platform.SELECT,
    Platform.BUTTON,
    Platform.TEXT,
]

# Service names
SERVICE_SET_TASK_RECURRENCE = "set_task_recurrence"
SERVICE_GET_TASK_RECURRENCE = "get_task_recurrence"
SERVICE_APPLY_RECURRENCE_FROM_UI = "apply_recurrence_from_ui"
SERVICE_CREATE_TASK = "create_task"
SERVICE_UPDATE_TASK = "update_task"
SERVICE_DELETE_TASK = "delete_task"
SERVICE_MOVE_TASK = "move_task"

# Service schemas
CREATE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("summary"): cv.string,
        vol.Optional("description"): cv.string,
        vol.Optional("due"): cv.string,
    }
)

UPDATE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("uid"): cv.string,
        vol.Optional("summary"): cv.string,
        vol.Optional("description"): cv.string,
        vol.Optional("due"): cv.string,
        vol.Optional("status"): vol.In(["needs_action", "completed"]),
    }
)

DELETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("uid"): vol.Any(cv.string, [cv.string]),
    }
)

MOVE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("uid"): cv.string,
        vol.Optional("previous_uid"): cv.string,
    }
)

# Service schemas
SET_TASK_RECURRENCE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("task_uid"): cv.string,
        vol.Required(ATTR_RECURRENCE_ENABLED): cv.boolean,
        vol.Optional(ATTR_RECURRENCE_INTERVAL, default=1): cv.positive_int,
        vol.Optional(ATTR_RECURRENCE_UNIT, default="days"): vol.In(
            ["days", "weeks", "months", "years"]
        ),
        vol.Optional(ATTR_RECURRENCE_END_ENABLED, default=False): cv.boolean,
        vol.Optional(ATTR_RECURRENCE_END_TYPE): vol.In(["count", "date"]),
        vol.Optional(ATTR_RECURRENCE_END_COUNT): cv.positive_int,
        vol.Optional(ATTR_RECURRENCE_END_DATE): cv.string,
    }
)

GET_TASK_RECURRENCE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
    }
)

APPLY_RECURRENCE_FROM_UI_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
    }
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Better ToDo from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"config": entry.data, "entities": {}}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(async_update_options))

    # Register JavaScript modules using view_assist pattern (only once for all entries)
    if not hass.data[DOMAIN].get("js_registered"):
        from .javascript import JSModuleRegistration
        js_registration = JSModuleRegistration(hass)
        await js_registration.async_setup()
        hass.data[DOMAIN]["js_registered"] = js_registration
        _LOGGER.info("Registered Better ToDo JavaScript modules")
    
    # Register custom panel with sidebar integration
    # This creates a panel similar to the native To-do lists panel with a sidebar
    # showing all Better ToDo lists and a main content area for task management
    if not hass.data[DOMAIN].get("panel_registered"):
        from .panel import async_register_panel
        await async_register_panel(hass)
        hass.data[DOMAIN]["panel_registered"] = True
        _LOGGER.info("Registered Better ToDo panel")
    
    # Also create/update Lovelace dashboard as an alternative view
    # This creates a sidebar dashboard that dynamically shows native todo-list cards
    # Unlike the panel_custom approach, this uses standard Lovelace dashboards
    if not hass.data[DOMAIN].get("dashboard_created"):
        from .dashboard import async_create_or_update_dashboard
        await async_create_or_update_dashboard(hass)
        hass.data[DOMAIN]["dashboard_created"] = True
        _LOGGER.info("Created/updated Better ToDo dashboard")
    
    # Better ToDo entities no longer inherit from TodoListEntity to prevent
    # them from appearing in the native "To-do lists" dashboard.
    # All functionality is provided through the custom Better ToDo dashboard.

    # Register services
    async def handle_set_task_recurrence(call: ServiceCall) -> None:
        """Handle the set_task_recurrence service call."""
        entity_id = call.data["entity_id"]
        task_uid = call.data["task_uid"]

        # Find the entity in stored entities
        entity = None
        for entry_data in hass.data[DOMAIN].values():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                entity = entry_data["entities"].get(entity_id)
                if entity is not None:
                    break

        if entity is None:
            return

        # Set recurrence
        entity.set_task_recurrence(
            uid=task_uid,
            recurrence_enabled=call.data[ATTR_RECURRENCE_ENABLED],
            recurrence_interval=call.data.get(ATTR_RECURRENCE_INTERVAL),
            recurrence_unit=call.data.get(ATTR_RECURRENCE_UNIT),
            recurrence_end_enabled=call.data.get(ATTR_RECURRENCE_END_ENABLED, False),
            recurrence_end_type=call.data.get(ATTR_RECURRENCE_END_TYPE),
            recurrence_end_count=call.data.get(ATTR_RECURRENCE_END_COUNT),
            recurrence_end_date=call.data.get(ATTR_RECURRENCE_END_DATE),
        )

    async def handle_get_task_recurrence(call: ServiceCall) -> None:
        """Handle the get_task_recurrence service call.
        
        This service triggers an entity state update to ensure the latest
        recurrence data is available in the entity's attributes.
        Access the data via the entity's 'recurrence_data' attribute.
        """
        entity_id = call.data["entity_id"]

        # Find the entity in stored entities
        entity = None
        for entry_data in hass.data[DOMAIN].values():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                entity = entry_data["entities"].get(entity_id)
                if entity is not None:
                    break

        if entity is None:
            return

        # Trigger state update to refresh attributes
        entity.async_write_ha_state()

    async def handle_apply_recurrence_from_ui(call: ServiceCall) -> None:
        """Handle the apply_recurrence_from_ui service call.
        
        This service reads the helper entity values and applies them to the task.
        It uses the following helper entities from the same config entry:
        - text.{list_name}_task_uid: The task to apply recurrence to
        - number.{list_name}_recurrence_interval: The interval value
        - select.{list_name}_recurrence_unit: The time unit (days/months/years)
        - select.{list_name}_recurrence_end_type: How to end (never/count/date)
        - number.{list_name}_recurrence_end_count: Count value if end type is count
        - text.{list_name}_recurrence_end_date: Date value if end type is date
        """
        entity_id = call.data["entity_id"]
        
        # Find the todo entity
        todo_entity = None
        entry_id = None
        for eid, entry_data in hass.data[DOMAIN].items():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                todo_entity = entry_data["entities"].get(entity_id)
                if todo_entity is not None:
                    entry_id = eid
                    break
        
        if todo_entity is None or entry_id is None:
            return
        
        # Get the helper entity IDs based on the entry_id
        task_uid_entity_id = f"text.{todo_entity._entry.data['name'].lower().replace(' ', '_')}_task_uid"
        interval_entity_id = f"number.{todo_entity._entry.data['name'].lower().replace(' ', '_')}_recurrence_interval"
        unit_entity_id = f"select.{todo_entity._entry.data['name'].lower().replace(' ', '_')}_recurrence_unit"
        end_type_entity_id = f"select.{todo_entity._entry.data['name'].lower().replace(' ', '_')}_recurrence_end_type"
        end_count_entity_id = f"number.{todo_entity._entry.data['name'].lower().replace(' ', '_')}_recurrence_end_count"
        end_date_entity_id = f"text.{todo_entity._entry.data['name'].lower().replace(' ', '_')}_recurrence_end_date"
        
        # Get the values from the helper entities
        task_uid = hass.states.get(task_uid_entity_id)
        interval = hass.states.get(interval_entity_id)
        unit = hass.states.get(unit_entity_id)
        end_type = hass.states.get(end_type_entity_id)
        end_count = hass.states.get(end_count_entity_id)
        end_date = hass.states.get(end_date_entity_id)
        
        if task_uid is None or not task_uid.state:
            return
        
        # Determine recurrence settings
        recurrence_enabled = True
        recurrence_interval = int(float(interval.state)) if interval else 1
        recurrence_unit = unit.state if unit else "days"
        recurrence_end_type_value = end_type.state if end_type else "never"
        
        # Apply recurrence
        if recurrence_end_type_value == "never":
            todo_entity.set_task_recurrence(
                uid=task_uid.state,
                recurrence_enabled=recurrence_enabled,
                recurrence_interval=recurrence_interval,
                recurrence_unit=recurrence_unit,
                recurrence_end_enabled=False,
            )
        elif recurrence_end_type_value == "count" and end_count:
            todo_entity.set_task_recurrence(
                uid=task_uid.state,
                recurrence_enabled=recurrence_enabled,
                recurrence_interval=recurrence_interval,
                recurrence_unit=recurrence_unit,
                recurrence_end_enabled=True,
                recurrence_end_type="count",
                recurrence_end_count=int(float(end_count.state)),
            )
        elif recurrence_end_type_value == "date" and end_date:
            todo_entity.set_task_recurrence(
                uid=task_uid.state,
                recurrence_enabled=recurrence_enabled,
                recurrence_interval=recurrence_interval,
                recurrence_unit=recurrence_unit,
                recurrence_end_enabled=True,
                recurrence_end_type="date",
                recurrence_end_date=end_date.state,
            )

    async def handle_create_task(call: ServiceCall) -> None:
        """Handle the create_task service call."""
        from homeassistant.components.todo import TodoItem
        
        entity_id = call.data["entity_id"]
        
        # Find the entity
        entity = None
        for entry_data in hass.data[DOMAIN].values():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                entity = entry_data["entities"].get(entity_id)
                if entity is not None:
                    break
        
        if entity is None:
            _LOGGER.error("Entity %s not found for create_task service", entity_id)
            return
        
        # Create the task
        item = TodoItem(
            summary=call.data["summary"],
            description=call.data.get("description"),
            due=call.data.get("due"),
        )
        await entity.async_create_todo_item(item)

    async def handle_update_task(call: ServiceCall) -> None:
        """Handle the update_task service call."""
        from homeassistant.components.todo import TodoItem
        
        entity_id = call.data["entity_id"]
        uid = call.data["uid"]
        
        # Find the entity
        entity = None
        for entry_data in hass.data[DOMAIN].values():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                entity = entry_data["entities"].get(entity_id)
                if entity is not None:
                    break
        
        if entity is None:
            _LOGGER.error("Entity %s not found for update_task service", entity_id)
            return
        
        # Find the existing task using public method
        existing_item = entity.get_item_by_uid(uid)
        
        if existing_item is None:
            _LOGGER.error("Task with UID %s not found in entity %s", uid, entity_id)
            return
        
        # Update with new values
        updated_item = TodoItem(
            uid=uid,
            summary=call.data.get("summary", existing_item.summary),
            description=call.data.get("description", existing_item.description),
            due=call.data.get("due", existing_item.due),
            status=call.data.get("status", existing_item.status),
        )
        await entity.async_update_todo_item(updated_item)

    async def handle_delete_task(call: ServiceCall) -> None:
        """Handle the delete_task service call."""
        entity_id = call.data["entity_id"]
        uids = call.data["uid"]
        
        # Ensure uids is a list
        if isinstance(uids, str):
            uids = [uids]
        
        # Find the entity
        entity = None
        for entry_data in hass.data[DOMAIN].values():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                entity = entry_data["entities"].get(entity_id)
                if entity is not None:
                    break
        
        if entity is None:
            _LOGGER.error("Entity %s not found for delete_task service", entity_id)
            return
        
        await entity.async_delete_todo_items(uids)

    async def handle_move_task(call: ServiceCall) -> None:
        """Handle the move_task service call."""
        entity_id = call.data["entity_id"]
        uid = call.data["uid"]
        previous_uid = call.data.get("previous_uid")
        
        # Find the entity
        entity = None
        for entry_data in hass.data[DOMAIN].values():
            if isinstance(entry_data, dict) and "entities" in entry_data:
                entity = entry_data["entities"].get(entity_id)
                if entity is not None:
                    break
        
        if entity is None:
            _LOGGER.error("Entity %s not found for move_task service", entity_id)
            return
        
        await entity.async_move_todo_item(uid, previous_uid)

    # Register services only once
    if not hass.services.has_service(DOMAIN, SERVICE_CREATE_TASK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_CREATE_TASK,
            handle_create_task,
            schema=CREATE_TASK_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_UPDATE_TASK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_UPDATE_TASK,
            handle_update_task,
            schema=UPDATE_TASK_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_DELETE_TASK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_DELETE_TASK,
            handle_delete_task,
            schema=DELETE_TASK_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_MOVE_TASK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_MOVE_TASK,
            handle_move_task,
            schema=MOVE_TASK_SCHEMA,
        )

    # Register services only once
    if not hass.services.has_service(DOMAIN, SERVICE_SET_TASK_RECURRENCE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_TASK_RECURRENCE,
            handle_set_task_recurrence,
            schema=SET_TASK_RECURRENCE_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_GET_TASK_RECURRENCE):
        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_TASK_RECURRENCE,
            handle_get_task_recurrence,
            schema=GET_TASK_RECURRENCE_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_APPLY_RECURRENCE_FROM_UI):
        hass.services.async_register(
            DOMAIN,
            SERVICE_APPLY_RECURRENCE_FROM_UI,
            handle_apply_recurrence_from_ui,
            schema=APPLY_RECURRENCE_FROM_UI_SCHEMA,
        )

    return True


async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Update options."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok: bool = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    # Check if this is the last entry being removed
    # We need to check if there are any OTHER entries besides the one being unloaded
    remaining_entries = [
        e for e in hass.config_entries.async_entries(DOMAIN)
        if e.entry_id != entry.entry_id
    ]
    
    # Remove dashboard and services if no more entries will remain
    if not remaining_entries:
        # Remove the panel
        from .panel import async_unregister_panel
        await async_unregister_panel(hass)
        _LOGGER.info("Unregistered Better ToDo panel - no more lists configured")
        
        # Remove the dashboard
        from .dashboard import async_remove_dashboard
        await async_remove_dashboard(hass)
        _LOGGER.info("Removed Better ToDo dashboard - no more lists configured")
        
        # Unregister Better ToDo custom services
        hass.services.async_remove(DOMAIN, SERVICE_SET_TASK_RECURRENCE)
        hass.services.async_remove(DOMAIN, SERVICE_GET_TASK_RECURRENCE)
        hass.services.async_remove(DOMAIN, SERVICE_APPLY_RECURRENCE_FROM_UI)
        hass.services.async_remove(DOMAIN, SERVICE_CREATE_TASK)
        hass.services.async_remove(DOMAIN, SERVICE_UPDATE_TASK)
        hass.services.async_remove(DOMAIN, SERVICE_DELETE_TASK)
        hass.services.async_remove(DOMAIN, SERVICE_MOVE_TASK)

    return unload_ok
