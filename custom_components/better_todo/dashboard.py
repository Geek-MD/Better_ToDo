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


async def async_create_or_update_dashboard(hass: HomeAssistant) -> None:
    """Create or update the Better ToDo dashboard.
    
    Creates a dashboard that shows all Better ToDo lists and their
    recurrence configuration entities grouped together.
    """
    # Get all Better ToDo entries
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return
    
    # Build cards for all lists
    cards: list[dict[str, Any]] = []
    
    for entry in entries:
        list_name = entry.data["name"]
        list_slug = list_name.lower().replace(" ", "_")
        
        # Add todo list card
        cards.append({
            "type": "todo-list",
            "entity": f"todo.{list_slug}",
            "title": list_name,
        })
        
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
                return
    except Exception as err:
        _LOGGER.debug("Could not use dashboard collection API: %s", err)
    
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
        
        with open(dashboard_file, "w", encoding="utf-8") as f:
            json.dump(dashboard_metadata, f, indent=2)
        
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
            with open(dashboards_file, "r", encoding="utf-8") as f:
                loaded_data = json.load(f)
                # Type assertion for mypy
                if isinstance(loaded_data, dict):
                    dashboards_data = loaded_data
        
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
                    })
        
        # Save dashboards registry
        with open(dashboards_file, "w", encoding="utf-8") as f:
            json.dump(dashboards_data, f, indent=2)
        
        _LOGGER.info("Created/updated Better ToDo dashboard via file storage at /%s", DASHBOARD_URL)
        
    except Exception as err:
        _LOGGER.warning("Could not create dashboard via file storage: %s", err)


async def async_remove_dashboard(hass: HomeAssistant) -> None:
    """Remove the Better ToDo dashboard when the last entry is removed."""
    try:
        config_dir = Path(hass.config.config_dir)
        storage_dir = config_dir / ".storage"
        
        # Remove dashboard configuration file
        dashboard_file = storage_dir / f"lovelace.{DASHBOARD_URL}"
        if dashboard_file.exists():
            dashboard_file.unlink()
            _LOGGER.info("Removed Better ToDo dashboard configuration")
        
        # Remove from dashboards registry
        dashboards_file = storage_dir / "lovelace_dashboards"
        if dashboards_file.exists():
            with open(dashboards_file, "r", encoding="utf-8") as f:
                dashboards_data = json.load(f)
            
            # Filter out our dashboard
            original_count = len(dashboards_data["data"]["items"])
            dashboards_data["data"]["items"] = [
                item for item in dashboards_data["data"]["items"]
                if item.get("url_path") != DASHBOARD_URL
            ]
            
            if len(dashboards_data["data"]["items"]) < original_count:
                with open(dashboards_file, "w", encoding="utf-8") as f:
                    json.dump(dashboards_data, f, indent=2)
                _LOGGER.info("Removed Better ToDo dashboard from registry")
    
    except Exception as err:
        _LOGGER.debug("Could not remove dashboard: %s", err)
