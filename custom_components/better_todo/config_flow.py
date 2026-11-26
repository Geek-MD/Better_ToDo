"""Config flow for Better To-do integration."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.util import slugify

from .const import (
    CONF_COMPLETED_CLEANUP_ENABLED,
    CONF_COMPLETED_RETENTION_MONTHS,
    CONF_STORAGE_KEY,
    CONF_TODO_LIST_NAME,
    DEFAULT_COMPLETED_RETENTION_MONTHS,
    DOMAIN,
)

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_TODO_LIST_NAME): str,
    }
)


class BetterTodoConfigFlow(ConfigFlow, domain=DOMAIN):  # type: ignore[call-arg]
    """Handle the config flow for Better To-do."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> BetterTodoOptionsFlow:
        """Open the options for an existing list."""
        return BetterTodoOptionsFlow()

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step where the user names their list."""
        errors: dict[str, str] = {}

        if user_input is not None:
            key = slugify(user_input[CONF_TODO_LIST_NAME])
            # Prevent duplicate list names (same storage key → same file)
            self._async_abort_entries_match({CONF_STORAGE_KEY: key})
            user_input[CONF_STORAGE_KEY] = key
            return self.async_create_entry(
                title=user_input[CONF_TODO_LIST_NAME],
                data=user_input,
            )

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )


class BetterTodoOptionsFlow(OptionsFlow):
    """Configure completed-task retention."""

    async def async_step_init(self, user_input: dict | None = None) -> ConfigFlowResult:
        """Enable or disable automatic cleanup."""
        if user_input is not None:
            if not user_input[CONF_COMPLETED_CLEANUP_ENABLED]:
                return self.async_create_entry(title="", data={
                    **self.config_entry.options,
                    CONF_COMPLETED_CLEANUP_ENABLED: False,
                })
            return self.async_show_menu(
                step_id="retention",
                menu_options=["default_retention", "custom_retention"],
            )

        enabled = self.config_entry.options.get(CONF_COMPLETED_CLEANUP_ENABLED, True)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_COMPLETED_CLEANUP_ENABLED, default=enabled): bool,
            }),
        )

    async def async_step_default_retention(self, user_input: dict | None = None) -> ConfigFlowResult:
        """Enable cleanup with the default retention period."""
        return self._save_retention(DEFAULT_COMPLETED_RETENTION_MONTHS)

    async def async_step_custom_retention(self, user_input: dict | None = None) -> ConfigFlowResult:
        """Enable cleanup with the chosen number of calendar months."""
        if user_input is not None:
            return self._save_retention(user_input[CONF_COMPLETED_RETENTION_MONTHS])

        retention = self.config_entry.options.get(
            CONF_COMPLETED_RETENTION_MONTHS, DEFAULT_COMPLETED_RETENTION_MONTHS
        )
        return self.async_show_form(
            step_id="custom_retention",
            data_schema=vol.Schema({
                vol.Required(CONF_COMPLETED_RETENTION_MONTHS, default=retention): vol.All(
                    int, vol.Range(min=1)
                ),
            }),
        )

    def _save_retention(self, months: int) -> ConfigFlowResult:
        """Save the enabled state and retention together."""
        return self.async_create_entry(title="", data={
            **self.config_entry.options,
            CONF_COMPLETED_CLEANUP_ENABLED: True,
            CONF_COMPLETED_RETENTION_MONTHS: months,
        })
