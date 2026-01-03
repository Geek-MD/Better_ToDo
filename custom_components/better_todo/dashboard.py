"""Dashboard management for Better ToDo integration."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import storage

from .const import DASHBOARD_ICON, DASHBOARD_TITLE, DASHBOARD_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = "lovelace.better_todo"
STORAGE_VERSION = 1

# Lovelace resource URLs
CARD_RESOURCE_URL = "/better_todo/better-todo-card.js"
DASHBOARD_CARD_RESOURCE_URL = "/better_todo/better-todo-dashboard-card.js"


async def _async_read_file(hass: HomeAssistant, file_path: Path) -> str:
    """Read a file asynchronously."""
    def _read():
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    
    return await hass.async_add_executor_job(_read)


async def _async_write_file(hass: HomeAssistant, file_path: Path, content: str) -> None:
    """Write a file asynchronously."""
    def _write():
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    await hass.async_add_executor_job(_write)


async def _async_ensure_lovelace_resources(hass: HomeAssistant) -> None:
    """Ensure Lovelace resources are registered for custom cards."""
    try:
        # Try to register resources using the Lovelace resources API
        if "lovelace" in hass.data:
            lovelace_data = hass.data["lovelace"]
            
            # Check if resources collection exists
            if hasattr(lovelace_data, "resources"):
                resources = lovelace_data.resources
                
                # Define resources to add
                resource_configs = [
                    {
                        "url": CARD_RESOURCE_URL,
                        "type": "module",
                    },
                    {
                        "url": DASHBOARD_CARD_RESOURCE_URL,
                        "type": "module",
                    },
                ]
                
                # Check and add each resource if not already present
                for resource_data in resource_configs:
                    resource_exists = False
                    for resource_id in resources.async_items_ids():
                        resource = await resources.async_get_item(resource_id)
                        if resource.get("url") == resource_data["url"]:
                            resource_exists = True
                            break
                    
                    if not resource_exists:
                        await resources.async_create_item(resource_data)
                        _LOGGER.info("Added Lovelace resource: %s", resource_data["url"])
                
                return
    except Exception as err:
        _LOGGER.debug("Could not register Lovelace resources via API: %s", err)
    
    # Fallback: Try direct file creation in .storage
    try:
        config_dir = Path(hass.config.config_dir)
        storage_dir = config_dir / ".storage"
        storage_dir.mkdir(exist_ok=True)
        
        # Load or create lovelace_resources file
        resources_file = storage_dir / "lovelace_resources"
        resources_data = {
            "version": 1,
            "minor_version": 1,
            "key": "lovelace_resources",
            "data": {
                "items": []
            },
        }
        
        if resources_file.exists():
            try:
                content = await _async_read_file(hass, resources_file)
                loaded_data = json.loads(content)
                if isinstance(loaded_data, dict):
                    resources_data = loaded_data
            except (json.JSONDecodeError, ValueError) as err:
                _LOGGER.warning("Could not parse lovelace_resources file: %s", err)
        
        # Define resources to add
        resources_to_add: list[str] = [
            CARD_RESOURCE_URL,
            DASHBOARD_CARD_RESOURCE_URL,
        ]
        
        # Check and add resources
        data_dict = resources_data.get("data")
        if isinstance(data_dict, dict):
            items = data_dict.get("items")
            if isinstance(items, list):
                for resource_url in resources_to_add:
                    resource_exists = any(
                        isinstance(item, dict) and item.get("url") == resource_url
                        for item in items
                    )
                    
                    if not resource_exists:
                        import secrets
                        resource_id = secrets.token_hex(16)
                        items.append({
                            "id": resource_id,
                            "url": resource_url,
                            "type": "module",
                        })
                        _LOGGER.info("Added Lovelace resource to storage: %s", resource_url)
        
        # Save resources file
        await _async_write_file(hass, resources_file, json.dumps(resources_data, indent=2))
    
    except Exception as err:
        _LOGGER.debug("Could not register Lovelace resources via file storage: %s", err)


async def _async_reload_frontend_panels(hass: HomeAssistant) -> None:
    """Reload frontend panels to show new dashboard without restart.
    
    This function attempts to notify the frontend and lovelace system about
    the new dashboard so it appears in the sidebar without requiring a restart.
    """
    try:
        # If we have access to the lovelace data object, trigger a reload
        if "lovelace" in hass.data:
            lovelace_data = hass.data["lovelace"]
            
            # Try to access and trigger dashboard reload if the API is available
            if hasattr(lovelace_data, "dashboards"):
                dashboards = lovelace_data.dashboards
                # Trigger a reload by accessing the dashboards
                # This causes the system to refresh its internal state
                # Note: We call list() to iterate through items as a side effect
                # that triggers the internal dashboard state refresh
                list(dashboards.async_items_ids())
                _LOGGER.debug("Refreshed lovelace dashboards state")
    except Exception as err:
        _LOGGER.debug("Could not refresh lovelace dashboards: %s", err)
    
    try:
        # Reload lovelace resources to ensure custom cards are loaded
        if hass.services.has_service("lovelace", "reload_resources"):
            await hass.services.async_call(
                "lovelace",
                "reload_resources",
                blocking=True,
            )
            _LOGGER.info("Reloaded lovelace resources")
    except Exception as err:
        _LOGGER.debug("Could not reload lovelace resources: %s", err)
    
    try:
        # Fire event to notify frontend of the new dashboard
        # Note: 'lovelace_updated' is a standard Home Assistant event
        # that the frontend listens for to refresh dashboard configuration
        hass.bus.async_fire("lovelace_updated", {"url_path": DASHBOARD_URL})
        _LOGGER.debug("Fired lovelace_updated event for dashboard")
    except Exception as err:
        _LOGGER.debug("Could not fire lovelace_updated event: %s", err)
    
    try:
        # Fire a panels_updated event as an additional notification mechanism
        # This helps ensure the sidebar refreshes to show the new dashboard
        hass.bus.async_fire("panels_updated")
        _LOGGER.debug("Fired panels_updated event")
    except Exception as err:
        _LOGGER.debug("Could not fire panels_updated event: %s", err)


async def async_create_or_update_dashboard(hass: HomeAssistant) -> None:
    """Create or update the Better ToDo dashboard.
    
    Creates a dashboard with a two-section layout:
    - Left section: Shows all Better ToDo lists
    - Right section: Shows tasks from the selected list with category headers
    """
    # Get all Better ToDo entries
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return
    
    # Build cards for the dashboard
    cards: list[dict[str, Any]] = []
    
    # Add the main two-section dashboard card
    cards.append({
        "type": "custom:better-todo-dashboard-card",
    })
    
    # Add recurrence configuration cards for each list
    for entry in entries:
        list_name = entry.data["name"]
        list_slug = list_name.lower().replace(" ", "_")
        
        # Add recurrence configuration card
        cards.append({
            "type": "entities",
            "title": f"{list_name} - Recurrence Settings",
            "state_color": True,
            "entities": [
                {
                    "entity": f"text.{list_slug}_task_uid",
                    "name": "Task UID",
                },
                {
                    "entity": f"number.{list_slug}_recurrence_interval",
                    "name": "Interval",
                },
                {
                    "entity": f"select.{list_slug}_recurrence_unit",
                    "name": "Unit",
                },
                {
                    "entity": f"select.{list_slug}_recurrence_end_type",
                    "name": "End Type",
                },
                {
                    "entity": f"number.{list_slug}_recurrence_end_count",
                    "name": "End Count",
                },
                {
                    "entity": f"text.{list_slug}_recurrence_end_date",
                    "name": "End Date",
                },
                {
                    "entity": f"button.{list_slug}_apply_recurrence_settings",
                    "name": "Apply Settings",
                },
            ],
        })
    
    # Dashboard configuration
    config: dict[str, Any] = {
        "views": [
            {
                "title": "Tasks",
                "path": "tasks",
                "icon": "mdi:format-list-checks",
                "cards": cards,
            }
        ]
    }
    
    # Ensure Lovelace resources are configured
    await _async_ensure_lovelace_resources(hass)
    
    # Try to register the dashboard
    try:
        # First, try using the lovelace dashboards collection API
        if "lovelace" in hass.data:
            lovelace_data = hass.data["lovelace"]
            
            # Check if dashboards collection exists
            if hasattr(lovelace_data, "dashboards"):
                dashboards = lovelace_data.dashboards
                
                # Check if our dashboard exists
                existing_dashboard_id = None
                for dashboard_id in dashboards.async_items_ids():
                    dashboard = await dashboards.async_get_item(dashboard_id)
                    if dashboard.get("url_path") == DASHBOARD_URL:
                        existing_dashboard_id = dashboard_id
                        break
                
                dashboard_data = {
                    "require_admin": False,
                    "show_in_sidebar": True,
                    "icon": DASHBOARD_ICON,
                    "title": DASHBOARD_TITLE,
                    "url_path": DASHBOARD_URL,
                    "mode": "storage",
                }
                
                if existing_dashboard_id:
                    # Update existing dashboard
                    await dashboards.async_update_item(existing_dashboard_id, dashboard_data)
                    _LOGGER.info("Updated Better ToDo dashboard")
                else:
                    # Create new dashboard
                    await dashboards.async_create_item(dashboard_data)
                    _LOGGER.info("Created Better ToDo dashboard at /%s", DASHBOARD_URL)
                
                # Save the dashboard configuration
                store = storage.Store(hass, STORAGE_VERSION, STORAGE_KEY)
                await store.async_save(config)
                _LOGGER.info("Dashboard configuration saved successfully")
                
                # Reload frontend panels to show the new dashboard without restart
                await _async_reload_frontend_panels(hass)
                
                return
    except Exception as err:
        _LOGGER.info("Dashboard collection API not available, using file storage fallback: %s", err)
    
    # Fallback: Try direct file creation in .storage
    try:
        config_dir = Path(hass.config.config_dir)
        storage_dir = config_dir / ".storage"
        storage_dir.mkdir(exist_ok=True)
        
        # Create the lovelace dashboard metadata file
        dashboard_file = storage_dir / f"lovelace.{DASHBOARD_URL}"
        dashboard_metadata = {
            "version": 1,
            "minor_version": 1,
            "key": f"lovelace.{DASHBOARD_URL}",
            "data": config,
        }
        
        await _async_write_file(hass, dashboard_file, json.dumps(dashboard_metadata, indent=2))
        
        # Create/update the lovelace_dashboards file to register the dashboard
        dashboards_file = storage_dir / "lovelace_dashboards"
        dashboards_data = {
            "version": 1,
            "minor_version": 1,
            "key": "lovelace_dashboards",
            "data": {
                "items": []
            },
        }
        
        # Load existing dashboards if file exists
        if dashboards_file.exists():
            try:
                content = await _async_read_file(hass, dashboards_file)
                loaded_data = json.loads(content)
                # Type assertion for mypy
                if isinstance(loaded_data, dict):
                    dashboards_data = loaded_data
            except (json.JSONDecodeError, ValueError) as err:
                _LOGGER.warning("Could not parse lovelace_dashboards file: %s", err)
        
        # Check if our dashboard is already registered
        dashboard_registered = False
        data_dict = dashboards_data.get("data")
        if isinstance(data_dict, dict):
            items = data_dict.get("items")
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("url_path") == DASHBOARD_URL:
                        dashboard_registered = True
                        # Update existing entry
                        item.update({
                            "require_admin": False,
                            "show_in_sidebar": True,
                            "icon": DASHBOARD_ICON,
                            "title": DASHBOARD_TITLE,
                            "url_path": DASHBOARD_URL,
                            "mode": "storage",
                        })
                        break
        
        # Add new dashboard if not registered
        if not dashboard_registered:
            import secrets
            dashboard_id = secrets.token_hex(16)
            data_dict = dashboards_data.get("data")
            if isinstance(data_dict, dict):
                items = data_dict.get("items")
                if isinstance(items, list):
                    items.append({
                        "id": dashboard_id,
                        "require_admin": False,
                        "show_in_sidebar": True,
                        "icon": DASHBOARD_ICON,
                        "title": DASHBOARD_TITLE,
                        "url_path": DASHBOARD_URL,
                        "mode": "storage",
                    })
        
        # Save dashboards registry
        await _async_write_file(hass, dashboards_file, json.dumps(dashboards_data, indent=2))
        
        _LOGGER.info("Created/updated Better ToDo dashboard via file storage at /%s", DASHBOARD_URL)
        
        # Reload frontend panels to show the new dashboard without restart
        await _async_reload_frontend_panels(hass)
        
    except Exception as err:
        _LOGGER.warning("Could not create dashboard via file storage: %s", err)


async def async_remove_dashboard(hass: HomeAssistant) -> None:
    """Remove the Better ToDo dashboard when the last entry is removed."""
    # Try to remove the dashboard using the Lovelace API first
    try:
        if "lovelace" in hass.data:
            lovelace_data = hass.data["lovelace"]
            
            # Check if dashboards collection exists
            if hasattr(lovelace_data, "dashboards"):
                dashboards = lovelace_data.dashboards
                
                # Find and remove our dashboard
                for dashboard_id in dashboards.async_items_ids():
                    dashboard = await dashboards.async_get_item(dashboard_id)
                    if dashboard.get("url_path") == DASHBOARD_URL:
                        await dashboards.async_delete_item(dashboard_id)
                        _LOGGER.info("Removed Better ToDo dashboard via API")
                        
                        # Also remove the dashboard configuration from storage
                        try:
                            store = storage.Store(hass, STORAGE_VERSION, STORAGE_KEY)
                            await store.async_remove()
                        except Exception as err:
                            _LOGGER.debug("Could not remove dashboard storage: %s", err)
                        
                        return
    except Exception as err:
        _LOGGER.debug("Could not use dashboard collection API for removal: %s", err)
    
    # Fallback: Try file-based removal
    try:
        config_dir = Path(hass.config.config_dir)
        storage_dir = config_dir / ".storage"
        
        # Remove dashboard configuration file
        dashboard_file = storage_dir / f"lovelace.{DASHBOARD_URL}"
        if dashboard_file.exists():
            def _unlink():
                dashboard_file.unlink()
            await hass.async_add_executor_job(_unlink)
            _LOGGER.info("Removed Better ToDo dashboard configuration file")
        
        # Remove from dashboards registry
        dashboards_file = storage_dir / "lovelace_dashboards"
        if dashboards_file.exists():
            try:
                content = await _async_read_file(hass, dashboards_file)
                dashboards_data = json.loads(content)
                
                # Filter out our dashboard
                original_count = len(dashboards_data["data"]["items"])
                dashboards_data["data"]["items"] = [
                    item for item in dashboards_data["data"]["items"]
                    if item.get("url_path") != DASHBOARD_URL
                ]
                
                if len(dashboards_data["data"]["items"]) < original_count:
                    await _async_write_file(hass, dashboards_file, json.dumps(dashboards_data, indent=2))
                    _LOGGER.info("Removed Better ToDo dashboard from registry via file storage")
            except (json.JSONDecodeError, ValueError, KeyError) as err:
                _LOGGER.warning("Could not parse or update lovelace_dashboards file: %s", err)
    
    except Exception as err:
        _LOGGER.warning("Could not remove dashboard via file storage: %s", err)
