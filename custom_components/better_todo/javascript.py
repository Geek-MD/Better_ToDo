"""Better ToDo Javascript module registration.

Following the pattern from view_assist_integration for proper JavaScript module registration.
This ensures custom cards are properly registered in Lovelace resources.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace import LovelaceData
from homeassistant.core import HomeAssistant
from homeassistant.helpers.event import async_call_later

from .const import DOMAIN, JSMODULES, URL_BASE

_LOGGER = logging.getLogger(__name__)

JS_URL = f"/{URL_BASE}/js"


class JSModuleRegistration:
    """Register Javascript modules."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialise."""
        self.hass = hass
        self.lovelace: LovelaceData | None = self.hass.data.get("lovelace")

    async def async_setup(self) -> bool:
        """Register better_todo path."""
        await self._async_register_path()
        if self.lovelace and self.lovelace.mode == "storage":
            await self._async_wait_for_lovelace_resources()
        return True

    async def async_unload(self) -> bool:
        """Unload javascript module registration."""
        if self.lovelace and self.lovelace.mode == "storage":
            await self.async_unregister()
        return True

    async def _async_register_path(self) -> None:
        """Register resource path if not already registered."""
        try:
            path = Path(self.hass.config.path(f"custom_components/{DOMAIN}/www"))
            await self.hass.http.async_register_static_paths(
                [StaticPathConfig(JS_URL, path, False)]
            )
            _LOGGER.debug("Registered resource path from %s", path)
        except RuntimeError:
            # Runtime error is likely this is already registered.
            _LOGGER.debug("Resource path already registered")

    async def _async_wait_for_lovelace_resources(self) -> None:
        """Wait for lovelace resources to have loaded."""

        async def _check_lovelace_resources_loaded(now: Any) -> None:
            if self.lovelace and self.lovelace.resources.loaded:
                await self._async_register_modules()
            else:
                _LOGGER.debug(
                    "Unable to install resources because Lovelace resources have not yet loaded. Trying again in 5 seconds"
                )
                async_call_later(self.hass, 5, _check_lovelace_resources_loaded)

        await _check_lovelace_resources_loaded(0)

    async def _async_register_modules(self) -> None:
        """Register modules if not already registered."""
        if not self.lovelace:
            _LOGGER.warning("Lovelace data not available")
            return
            
        _LOGGER.debug("Installing javascript modules")

        # Get resources already registered
        resources = [
            resource
            for resource in self.lovelace.resources.async_items()
            if resource["url"].startswith(JS_URL)
        ]

        for module in JSMODULES:
            url = f"{JS_URL}/{module.get('filename')}"
            version = module.get("version", "0")

            card_registered = False

            for resource in resources:
                if self._get_resource_path(resource["url"]) == url:
                    card_registered = True
                    # check version
                    if self._get_resource_version(resource["url"]) != version:
                        # Update card version
                        _LOGGER.debug(
                            "Updating %s to version %s",
                            module.get("name"),
                            version,
                        )
                        await self.lovelace.resources.async_update_item(
                            resource.get("id"),
                            {
                                "res_type": "module",
                                "url": url + "?v=" + version,
                            },
                        )
                    else:
                        _LOGGER.debug(
                            "%s already registered as version %s",
                            module.get("name"),
                            version,
                        )

            if not card_registered:
                _LOGGER.debug(
                    "Registering %s as version %s",
                    module.get("name"),
                    version,
                )
                await self.lovelace.resources.async_create_item(
                    {"res_type": "module", "url": url + "?v=" + version}
                )

    def _get_resource_path(self, url: str) -> str:
        """Get resource path without version parameter."""
        return url.split("?")[0]

    def _get_resource_version(self, url: str) -> str:
        """Get resource version from URL."""
        parts = url.split("?")
        if len(parts) > 1:
            version = parts[1].replace("v=", "")
            return version
        return "0"

    async def async_unregister(self, url: str = JS_URL) -> None:
        """Unload lovelace module resource."""
        if not self.lovelace:
            return
            
        if self.hass.data["lovelace"].mode == "storage":
            for module in JSMODULES:
                module_url = f"{url}/{module.get('filename')}"
                resources = [
                    resource
                    for resource in self.lovelace.resources.async_items()
                    if str(resource["url"]).startswith(module_url)
                ]
                for resource in resources:
                    await self.lovelace.resources.async_delete_item(resource.get("id"))
