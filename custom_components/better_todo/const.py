"""Constants for the Better To-do integration."""

DOMAIN = "better_todo"

CONF_TODO_LIST_NAME = "todo_list_name"
CONF_STORAGE_KEY = "storage_key"

STORAGE_PATH = ".storage/better_todo.{key}.ics"
DEFAULT_SHOPPING_LIST_NAME = "Shopping List"
DEFAULT_SHOPPING_LIST_KEY = "default_shopping_list"
DATA_DEFAULT_LIST_ADDED = "default_list_added"

# Custom service names
SERVICE_SET_TASK_RECURRENCE = "set_task_recurrence"
SERVICE_SET_TASK_DETAILS = "set_task_details"

# Service field names
ATTR_ITEM = "item"
ATTR_RRULE = "rrule"
ATTR_QUANTITY = "quantity"
ATTR_CATEGORY = "category"
ATTR_NOTES = "notes"

# Prefixes used to encode quantity/category inside the description field.
# Human-readable so they display nicely in the HA Tasks panel.
DESC_QUANTITY_PREFIX = "Quantity: "
DESC_CATEGORY_PREFIX = "Category: "
