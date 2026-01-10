"""Constants for the Better ToDo integration."""

DOMAIN = "better_todo"
ENTITY_DOMAIN = "better_todo"  # Domain for entity IDs (e.g., better_todo.shopping_list)

# Default list names
DEFAULT_LIST_NAME = "Tasks"
AUTO_SHOPPING_LIST_NAME = "Shopping List"

# Config flow constants
AUTO_LIST_CREATION_DELAY = 0.5  # Seconds to wait before creating shopping list

# Recurrence constants
ATTR_RECURRENCE_ENABLED = "recurrence_enabled"
ATTR_RECURRENCE_INTERVAL = "recurrence_interval"
ATTR_RECURRENCE_UNIT = "recurrence_unit"
ATTR_RECURRENCE_END_ENABLED = "recurrence_end_enabled"
ATTR_RECURRENCE_END_TYPE = "recurrence_end_type"
ATTR_RECURRENCE_END_COUNT = "recurrence_end_count"
ATTR_RECURRENCE_END_DATE = "recurrence_end_date"
ATTR_RECURRENCE_CURRENT_COUNT = "recurrence_current_count"

# Recurrence units
RECURRENCE_UNIT_DAYS = "days"
RECURRENCE_UNIT_WEEKS = "weeks"
RECURRENCE_UNIT_MONTHS = "months"
RECURRENCE_UNIT_YEARS = "years"

# Recurrence end types
RECURRENCE_END_TYPE_COUNT = "count"
RECURRENCE_END_TYPE_DATE = "date"

# Dashboard constants (Custom panel with sidebar visibility)
DASHBOARD_URL = "better-todo"
DASHBOARD_TITLE = "Better ToDo"
DASHBOARD_ICON = "mdi:checkbox-marked-circle-outline"

# Task grouping constants
GROUP_NO_DUE_DATE = "no_due_date"
GROUP_THIS_WEEK = "this_week"
GROUP_FORTHCOMING = "forthcoming"
# GROUP_DONE is no longer used - HA's native "Completed" section handles done tasks

# Frontend resource constants
URL_BASE = "better_todo"
JSMODULES = [
    {
        "name": "Better ToDo Panel Component",
        "filename": "better-todo-panel-component.js",
        "version": "0.10.6",
    },
    {
        "name": "Better ToDo List Card",
        "filename": "better-todo-list-card.js",
        "version": "0.10.0",
    },
    {
        "name": "Better ToDo Card",
        "filename": "better-todo-card.js",
        "version": "0.6.8",
    },
    {
        "name": "Better ToDo Dashboard Card",
        "filename": "better-todo-dashboard-card.js",
        "version": "0.6.8",
    },
]
