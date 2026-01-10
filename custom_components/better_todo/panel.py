"""Panel management for Better ToDo integration."""
from __future__ import annotations

import logging

from homeassistant.components import frontend, panel_custom
from homeassistant.core import HomeAssistant

from .const import DASHBOARD_ICON, DASHBOARD_TITLE, DASHBOARD_URL

_LOGGER = logging.getLogger(__name__)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Better ToDo custom panel.
    
    This creates a custom frontend panel (not a Lovelace dashboard) that displays
    Better ToDo lists with sidebar navigation, similar to Home Assistant's native
    "To-do lists" panel.
    
    The panel component (better-todo-panel-component.js) provides:
    - Left sidebar: List of all Better ToDo lists with task counts
    - Main content area: Selected list's tasks using better-todo-list-card
    - Full CRUD operations through Better ToDo services
    """
    # Check if panel is already registered
    if DASHBOARD_URL in hass.data.get("panel_custom", {}).get("panels", {}):
        _LOGGER.debug("Better ToDo panel already registered")
        return
    
    # Register the panel with panel_custom
    # The JavaScript module is registered separately via javascript.py
    try:
        await panel_custom.async_register_panel(
            hass=hass,
            frontend_url_path=DASHBOARD_URL,
            webcomponent_name="better-todo-panel",
            sidebar_title=DASHBOARD_TITLE,
            sidebar_icon=DASHBOARD_ICON,
            module_url="/better_todo/js/better-todo-panel-component.js",
            embed_iframe=False,
            require_admin=False,
            config={},
        )
        _LOGGER.info("Registered Better ToDo custom panel at /%s", DASHBOARD_URL)
    except ValueError as err:
        # Panel might already be registered
        if "Overwriting panel" in str(err):
            _LOGGER.debug("Better ToDo panel already registered: %s", err)
        else:
            raise


async def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the Better ToDo custom panel."""
    try:
        # Remove the panel
        if DASHBOARD_URL in hass.data.get("panel_custom", {}).get("panels", {}):
            frontend.async_remove_panel(hass, DASHBOARD_URL)
            _LOGGER.info("Unregistered Better ToDo custom panel")
        else:
            _LOGGER.debug("Better ToDo panel not found for removal")
    except Exception as err:
        _LOGGER.warning("Error unregistering Better ToDo panel: %s", err)
