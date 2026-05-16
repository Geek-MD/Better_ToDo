"""Constants for the Better To-do integration."""

DOMAIN = "better_todo"

CONF_TODO_LIST_NAME = "todo_list_name"
CONF_STORAGE_KEY = "storage_key"

STORAGE_PATH = ".storage/better_todo.{key}.ics"
DEFAULT_SHOPPING_LIST_NAME = "Shopping List"
DEFAULT_SHOPPING_LIST_KEY = "default_shopping_list"
DATA_DEFAULT_LIST_ADDED = "default_list_added"
DATA_FRONTEND_REGISTERED = "frontend_registered"

FRONTEND_STATIC_PATH = "/better_todo_static"
FRONTEND_CARD_MODULE = "better-todo-card.js"
FRONTEND_PANEL_MODULE = "better-todo-panel.js"
PANEL_URL_PATH = "better-todo"
PANEL_WEB_COMPONENT = "better-todo-panel"
PANEL_TITLE = "Better To-do"
PANEL_ICON = "mdi:clipboard-check-outline"

# Custom service names
SERVICE_SET_TASK_RECURRENCE = "set_task_recurrence"
SERVICE_SET_TASK_DETAILS = "set_task_details"

# Service field names
ATTR_ITEM = "item"
ATTR_RRULE = "rrule"
ATTR_QUANTITY = "quantity"
ATTR_UNIT = "unit"
ATTR_CATEGORY = "category"
ATTR_NOTES = "notes"

# Legacy prefixes used in v0.3.x description encoding.
DESC_QUANTITY_PREFIX = "Quantity: "
DESC_CATEGORY_PREFIX = "Category: "

# v0.4.0 description tag names.
DESC_TAG_QUANTITY = "quantity"
DESC_TAG_UNIT = "unit"
DESC_TAG_CATEGORY = "category"
DESC_TAG_REPEAT = "repeat"
