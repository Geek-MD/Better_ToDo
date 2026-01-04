"""Dashboard management for Better ToDo integration."""
from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from pathlib import Path
from typing import Any, cast

from homeassistant.components.lovelace import CONF_ICON, CONF_REQUIRE_ADMIN, CONF_SHOW_IN_SIDEBAR, CONF_TITLE, CONF_URL_PATH
from homeassistant.const import CONF_ID, CONF_MODE, CONF_TYPE
from homeassistant.core import HomeAssistant
from homeassistant.helpers import storage

from .const import DASHBOARD_ICON, DASHBOARD_TITLE, DASHBOARD_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = "lovelace.better_todo"
STORAGE_VERSION = 1


class MockWSConnection:
    """Mock a websocket connection to call websocket handler functions.
    
    This is used for creating the Better ToDo dashboard programmatically
    by calling the lovelace/dashboards/create websocket endpoint.
    """

    @dataclass
    class MockAdminUser:
        """Mock admin user for use in MockWSConnection."""

        is_admin = True

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the mock connection."""
        self.hass = hass
        self.user = self.MockAdminUser()
        self.failed_request: bool = False

    def send_result(self, id: int, item: Any) -> None:
        """Receive result from websocket handler."""
        self.failed_request = False

    def send_error(self, id: int, code: str, msg: str) -> None:
        """Receive error from websocket handler."""
        self.failed_request = True
        _LOGGER.debug("MockWSConnection error: %s - %s", code, msg)

    def execute_ws_func(self, ws_type: str, msg: dict[str, Any]) -> bool:
        """Execute websocket function.
        
        Args:
            ws_type: The websocket command type (e.g., "lovelace/dashboards/create")
            msg: The message payload with command parameters
            
        Returns:
            True if the command executed successfully, False otherwise
        """
        if self.hass.data.get("websocket_api", {}).get(ws_type):
            try:
                handler, schema = self.hass.data["websocket_api"][ws_type]
                if schema is False:
                    handler(self.hass, self, msg)
                else:
                    handler(self.hass, self, schema(msg))
            except Exception as ex:
                _LOGGER.error("Error calling %s: %s", ws_type, ex)
                return False
            else:
                return not self.failed_request
        _LOGGER.debug("Websocket command %s not found", ws_type)
        return False


async def _async_read_file(hass: HomeAssistant, file_path: Path) -> str:
    """Read a file asynchronously."""
    def _read() -> str:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    
    return cast(str, await hass.async_add_executor_job(_read))


async def _async_write_file(hass: HomeAssistant, file_path: Path, content: str) -> None:
    """Write a file asynchronously."""
    def _write() -> None:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    await hass.async_add_executor_job(_write)


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
                if isinstance(dashboards, dict):
                    # dashboards is a dict - no refresh mechanism needed
                    _LOGGER.debug("Dashboards is a dict, skipping refresh")
                else:
                    # dashboards is a collection object - iterate to trigger refresh
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
    
    Creates a dashboard that replicates the core To-do List integration layout.
    The dashboard uses the better-todo-dashboard-card which shows a two-section layout:
    - Left section: All Better ToDo lists with task counts
    - Right section: Tasks from the selected list with category headers
    
    This implementation uses the websocket API approach (similar to view_assist_integration)
    to programmatically create the dashboard panel.
    """
    # Get all Better ToDo entries
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return
    
    # Create dashboard with the better-todo-dashboard-card that replicates
    # the core To-do List integration layout (two-section: lists on left, tasks on right)
    cards: list[dict[str, Any]] = [
        {
            "type": "custom:better-todo-dashboard-card",
        }
    ]
    
    # Dashboard configuration - includes the main dashboard card
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
    
    # JavaScript resources are now handled by javascript.py module
    # following the view_assist pattern for reliable registration
    
    # Check if dashboard already exists
    dashboard_exists = False
    if "lovelace" in hass.data:
        lovelace_data = hass.data["lovelace"]
        if hasattr(lovelace_data, "dashboards"):
            dashboards = lovelace_data.dashboards
            
            # Handle both dict and collection object types
            if isinstance(dashboards, dict):
                # dashboards is a dict - iterate over values
                for dashboard in dashboards.values():
                    if isinstance(dashboard, dict) and dashboard.get("url_path") == DASHBOARD_URL:
                        dashboard_exists = True
                        _LOGGER.info("Better ToDo dashboard already exists")
                        break
            else:
                # dashboards is a collection object with async methods
                for dashboard_id in dashboards.async_items_ids():
                    dashboard = await dashboards.async_get_item(dashboard_id)
                    if dashboard.get("url_path") == DASHBOARD_URL:
                        dashboard_exists = True
                        _LOGGER.info("Better ToDo dashboard already exists")
                        break
    
    # Create dashboard if it doesn't exist using websocket API
    websocket_success = False
    fallback_success = False
    
    if not dashboard_exists:
        _LOGGER.info("Creating Better ToDo dashboard using websocket API")
        mock_connection = MockWSConnection(hass)
        
        # Use websocket command to create dashboard
        websocket_success = mock_connection.execute_ws_func(
            "lovelace/dashboards/create",
            {
                CONF_ID: 1,
                CONF_TYPE: "lovelace/dashboards/create",
                CONF_ICON: DASHBOARD_ICON,
                CONF_TITLE: DASHBOARD_TITLE,
                CONF_URL_PATH: DASHBOARD_URL,
                CONF_MODE: "storage",
                CONF_SHOW_IN_SIDEBAR: True,
                CONF_REQUIRE_ADMIN: False,
            },
        )
        
        if websocket_success:
            _LOGGER.info("Successfully created Better ToDo dashboard at /%s", DASHBOARD_URL)
        else:
            _LOGGER.debug("Websocket method failed, will use fallback method")
    
    # If websocket approach didn't work, try file storage fallback
    if not dashboard_exists and not websocket_success:
        _LOGGER.info("Using file storage fallback for dashboard creation")
        
        # Fallback: Try direct file creation in .storage
        try:
            config_dir = Path(hass.config.config_dir)
            storage_dir = config_dir / ".storage"
            storage_dir.mkdir(exist_ok=True)
            
            # Create/update the lovelace_dashboards file to register the dashboard before creating the config file
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
            
            # Now create the lovelace dashboard metadata file
            # Home Assistant's lovelace expects the data to have a "config" key
            dashboard_file = storage_dir / f"lovelace.{DASHBOARD_URL}"
            dashboard_metadata = {
                "version": 1,
                "minor_version": 1,
                "key": f"lovelace.{DASHBOARD_URL}",
                "data": {"config": config},
            }
            
            await _async_write_file(hass, dashboard_file, json.dumps(dashboard_metadata, indent=2))
            
            _LOGGER.info("Created/updated Better ToDo dashboard via file storage at /%s", DASHBOARD_URL)
            fallback_success = True
        
        except Exception as err:
            _LOGGER.error("Could not create dashboard via file storage: %s", err)
    
    # Save the dashboard configuration only if dashboard was successfully created
    # Home Assistant's lovelace expects the data to have a "config" key
    if dashboard_exists or websocket_success or fallback_success:
        try:
            store = storage.Store(hass, STORAGE_VERSION, STORAGE_KEY)
            await store.async_save({"config": config})
            _LOGGER.info("Dashboard configuration saved successfully")
        except Exception as err:
            _LOGGER.error("Could not save dashboard configuration: %s", err)
    
    # Reload frontend panels to show the new dashboard without restart
    await _async_reload_frontend_panels(hass)


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
                # Handle both dict and collection object types
                if isinstance(dashboards, dict):
                    # dashboards is a dict - find dashboard by url_path
                    dashboard_id_to_remove = None
                    for dash_id, dashboard in dashboards.items():
                        if isinstance(dashboard, dict) and dashboard.get("url_path") == DASHBOARD_URL:
                            dashboard_id_to_remove = dash_id
                            break
                    
                    if dashboard_id_to_remove:
                        _LOGGER.debug("Found dashboard %s to remove but cannot remove via dict API - falling back to file-based removal", dashboard_id_to_remove)
                        # Fall through to file-based removal
                else:
                    # dashboards is a collection object with async methods
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
            def _unlink() -> None:
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
