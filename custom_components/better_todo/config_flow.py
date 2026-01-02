"""Config flow for Better ToDo integration."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

CONFIG_SCHEMA = vol.Schema({vol.Required("name", default="Better ToDo"): cv.string})


class BetterTodoConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):  # type: ignore[call-arg]
    """Handle a config flow for Better ToDo."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Check if already configured
            await self.async_set_unique_id(user_input["name"])
            self._abort_if_unique_id_configured()

            return self.async_create_entry(
                title=user_input["name"],
                data=user_input,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=CONFIG_SCHEMA,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> BetterTodoOptionsFlow:
        """Get the options flow for this handler."""
        return BetterTodoOptionsFlow(config_entry)


class BetterTodoOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for Better ToDo."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            # Check if the new name conflicts with other entries
            new_name = user_input["name"]
            for entry in self.hass.config_entries.async_entries(DOMAIN):
                if entry.entry_id != self.config_entry.entry_id and entry.data.get("name") == new_name:
                    return self.async_show_form(
                        step_id="init",
                        data_schema=vol.Schema(
                            {
                                vol.Required(
                                    "name", default=self.config_entry.data.get("name", "")
                                ): cv.string,
                            }
                        ),
                        errors={"name": "already_configured"},
                    )
            
            # Update the config entry with new data
            self.hass.config_entries.async_update_entry(
                self.config_entry,
                data=user_input,
                title=user_input["name"],
            )
            return self.async_create_entry(title="", data={})

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        "name", default=self.config_entry.data.get("name", "")
                    ): cv.string,
                }
            ),
        )
