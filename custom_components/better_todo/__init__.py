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

PLATFORMS: list[Platform] = [Platform.TODO]

# Service names
SERVICE_SET_TASK_RECURRENCE = "set_task_recurrence"
SERVICE_GET_TASK_RECURRENCE = "get_task_recurrence"

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
        vol.Required("task_uid"): cv.string,
    }
)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Better ToDo from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = entry.data

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    entry.async_on_unload(entry.add_update_listener(async_update_options))

    # Register services
    async def handle_set_task_recurrence(call: ServiceCall) -> None:
        """Handle the set_task_recurrence service call."""
        entity_id = call.data["entity_id"]
        task_uid = call.data["task_uid"]

        # Get the entity
        entity = hass.data["entity_components"]["todo"].get_entity(entity_id)
        if entity is None or entity.platform.domain != DOMAIN:
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
        """Handle the get_task_recurrence service call."""
        entity_id = call.data["entity_id"]
        # task_uid = call.data["task_uid"]  # Not used, data available in extra_state_attributes

        # Get the entity
        entity = hass.data["entity_components"]["todo"].get_entity(entity_id)
        if entity is None or entity.platform.domain != DOMAIN:
            return

        # Get recurrence - data is available in entity's extra_state_attributes

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

    return unload_ok
