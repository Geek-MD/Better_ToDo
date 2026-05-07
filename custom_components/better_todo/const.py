"""Constants for the Better To-do integration."""

DOMAIN = "better_todo"

CONF_TODO_LIST_NAME = "todo_list_name"
CONF_STORAGE_KEY = "storage_key"

STORAGE_PATH = ".storage/better_todo.{key}.ics"

# Custom service names
SERVICE_SET_TASK_RECURRENCE = "set_task_recurrence"

# Service field names
ATTR_ITEM = "item"
ATTR_RRULE = "rrule"

# Custom panel constants
PANEL_URL_PATH = "better-todo"
PANEL_COMPONENT_NAME = "better-todo-panel"
PANEL_TITLE = "Better To-do"
PANEL_ICON = "mdi:format-list-checks"
STATIC_URL_PATH = "/better_todo_static"
FRONTEND_MODULE = "better-todo-panel.js"
