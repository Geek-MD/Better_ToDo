"""Custom frontend panel for Better ToDo integration."""
from __future__ import annotations

import logging

from homeassistant.components import panel_custom
from homeassistant.core import HomeAssistant

from .const import DASHBOARD_ICON, DASHBOARD_TITLE, DASHBOARD_URL

_LOGGER = logging.getLogger(__name__)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Better ToDo custom frontend panel.
    
    This creates a custom panel (not a Lovelace dashboard) that replicates
    the structure and functionality of the core To-do list integration,
    adjusted for Better ToDo's specific needs.
    """
    # Register custom panel with Home Assistant
    # This creates a sidebar entry that opens a custom frontend panel
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="better-todo-panel",
        frontend_url_path=DASHBOARD_URL,
        sidebar_title=DASHBOARD_TITLE,
        sidebar_icon=DASHBOARD_ICON,
        module_url="/better_todo/js/better-todo-panel.js",
        embed_iframe=False,
        require_admin=False,
        config={},
    )
    
    _LOGGER.info("Registered Better ToDo custom panel at /%s", DASHBOARD_URL)


async def async_unregister_panel(hass: HomeAssistant) -> None:
    """Unregister the Better ToDo custom panel."""
    try:
        # panel_custom doesn't have a direct unregister method
        # The panel is removed when the integration is unloaded
        _LOGGER.info("Better ToDo panel will be removed on integration unload")
    except Exception as err:
        _LOGGER.debug("Error unregistering panel: %s", err)
