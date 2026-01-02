"""The Better ToDo integration."""
from __future__ import annotations

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

PLATFORMS: list[Platform] = [
    Platform.TODO,
    Platform.NUMBER,
    Platform.SELECT,
    Platform.BUTTON,
    Platform.TEXT,
]

# Service names
SERVICE_SET_TASK_RECURRENCE = "set_task_recurrence"
SERVICE_GET_TASK_RECURRENCE = "get_task_recurrence"
SERVICE_APPLY_RECURRENCE_FROM_UI = "apply_recurrence_from_ui"

# Service schemas
SET_TASK_RECURRENCE_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Required("task_uid"): cv.string,
        vol.Required(ATTR_RECURRENCE_ENABLED): cv.boolean,
        vol.Optional(ATTR_RECURRENCE_INTERVAL, default=1): cv.positive_int,
        vol.Optional(ATTR_RECURRENCE_UNIT, default="days"): vol.In(
            ["days", "months", "years"]
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

    # Note: Dashboard creation is handled through device grouping
    # All entities are automatically grouped under their device in the UI

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

    # Unregister services if no more entries
    if not hass.config_entries.async_entries(DOMAIN):
        hass.services.async_remove(DOMAIN, SERVICE_SET_TASK_RECURRENCE)
        hass.services.async_remove(DOMAIN, SERVICE_GET_TASK_RECURRENCE)
        hass.services.async_remove(DOMAIN, SERVICE_APPLY_RECURRENCE_FROM_UI)

    return unload_ok
