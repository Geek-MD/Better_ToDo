# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0a3] - 2026-05-16

### Fixed
- **Panel and todo entities not loading**: `async_setup` was calling `panel_custom.async_register_panel` with `component_name=` instead of the correct `webcomponent_name=` parameter. This caused a `TypeError` that aborted integration setup entirely, preventing both the sidebar panel and all todo entities from being registered.

## [0.5.0a2] - 2026-05-16

### Fixed
- **`register_static_path` removed in recent HA versions**: replaced the deprecated `hass.http.register_static_path(...)` call with `hass.http.async_register_static_paths([StaticPathConfig(...)])` so the integration no longer raises `AttributeError: 'HomeAssistantHTTP' object has no attribute 'register_static_path'` during setup.

## [0.5.0a1] - 2026-05-16

### Added
- **Custom panel skeleton**: Better To-do now registers a sidebar panel at `/better-todo` with a title bar reading *Better ToDo*. The panel mirrors the structural layout of the built-in HA To-do panel (`ha-two-pane-top-app-bar-fixed`) with a left pane and a right content area, both empty in this first iteration. The action-menu slot is present in the markup but hidden until needed. The panel is implemented in plain JavaScript using LitElement accessed from HA's already-loaded frontend bundle (no external CDN dependency).
- **`async_setup`**: added integration-level setup that serves the frontend assets via `/better_todo_static` and registers the `better-todo-panel` custom panel with Home Assistant's `panel_custom` component.
- **`http` dependency**: added to `manifest.json` so Home Assistant loads the HTTP component before this integration.

## [0.4.2] - 2026-05-10

### Fixed
- **Shopping List translated name restored**: the built-in Shopping List entity now resolves its friendly name from translations in Home Assistant (for example, *Lista de la compra* in Spanish) instead of falling back to a lowercase/non-localized label like `shopping list`.

## [0.4.1] - 2026-05-10

### Added
- **Translated Shopping List name**: the built-in Shopping List entity now uses Home Assistant's translation mechanism (`_attr_translation_key = "shopping_list"`) so its friendly name adapts to the user's language. All five supported locales include the translated name: *Shopping List* (en), *Lista de la compra* (es), *Liste de courses* (fr), *Einkaufsliste* (de), and *Lista de compras* (pt). The `entity_id` (`todo.shopping_list`) remains unchanged.

## [0.4.0] - 2026-05-10

### Added
- **Description tags system**: task descriptions now support a tag-based metadata block designed for future extensions, using tags such as `[quantity:*]`, `[unit:*]`, `[category:*]`, and `[repeat:*]`.
- **`unit` support in `better_todo.set_task_details`**: the service now accepts a dedicated `unit` field and keeps quantity/unit split for better machine readability.
- **Recurrence tag sync**: `better_todo.set_task_recurrence` now also updates the `[repeat:*]` tag in the task description so recurrence is visible in the same tag system.
- **Description field help texts updated**: service strings/translations now include explicit guidance for the tag format in description-related fields.

## [0.3.1] - 2026-05-10

### Fixed
- **Shopping List due date removed**: items in the default Shopping List no longer expose a deadline / due date field.  A new `ShoppingListTodoListEntity` subclass is used for the Shopping List; it advertises only `CREATE`, `DELETE`, `UPDATE`, `MOVE`, and `SET_DESCRIPTION` features, so the HA UI never offers a date picker for shopping items.

## [0.3.0] - 2026-05-09

### Added
- **`better_todo.set_task_details` service** – sets quantity, category, and/or free-text notes on any task by its UID.  The data is encoded into the standard `description` field using a human-readable format (`Quantity: …` / `Category: …` lines followed by optional notes), so the information is immediately visible in the built-in HA Tasks panel without any custom card.
- **`task_details` state attribute** – the entity now also exposes a `task_details` dictionary (`{uid: {quantity, category}}`) alongside the existing `task_recurrence` attribute, making quantity and category accessible to automations and scripts.
- **Description encode/decode helpers** – internal `_encode_description` / `_decode_description` functions that keep the structured metadata and free-text notes independent, so callers can update individual fields without overwriting others.
- **Updated translations** – all five supported locales (en, es, fr, de, pt) now include translated strings for the new service and its fields.

## [0.2.2] - 2026-05-08

### Fixed
- **Todo panel visibility**: entities (`todo.<name>` and the default Shopping List) were created in the state machine but never appeared in the HA Todo panel because `_attr_todo_items` was never populated on startup. Added `async_added_to_hass()` to the entity so it immediately calls `async_update()` and initialises the item list as soon as the entity is registered with HA.
- **`_attr_has_entity_name` removed**: the flag was set to `True` without providing `device_info`. For standalone todo-list entities this flag is unnecessary and can cause unexpected name-resolution behaviour in newer HA versions.
- **`iot_class` corrected**: changed from `local_polling` to `local_push` in `manifest.json` to accurately reflect that the integration never polls (it sets `should_poll = False` and pushes state changes explicitly).

## [0.2.1] - 2026-05-08

### Fixed
- **`set_task_recurrence` service schema**: replaced the `vol.Schema`-wrapped validator with a plain `dict` schema for the entity service so that Home Assistant can correctly introspect and validate the service fields.

## [0.2.0] - 2026-05-07

### Added
- **Default Shopping List**: Better To-do now includes a built-in default list named **Shopping List**, inspired by Home Assistant's Shopping List integration behavior.
- **Independent setup list**: the default **Shopping List** is independent from user-created lists; the config flow still requires users to define a list name on first setup.
- **Additional translations**: added support for **Spanish (`es`)**, **Portuguese (`pt`)**, **French (`fr`)**, and **German (`de`)** while keeping **English (`en`)** as the default.

## [0.1.0] - 2026-05-06

### Added
- **Initial release** of the Better To-do integration for Home Assistant.
- **To-do list entity** (`todo.<name>`): a fully-featured task list backed by a local iCalendar (`.ics`) file, compatible with the standard Home Assistant to-do UI and dashboard card.
- **Full CRUD support** – create, read, update, delete, and reorder tasks entirely from the HA UI or via the built-in `todo.*` services.
- **Recurring tasks (RRULE)** – tasks can carry an iCalendar RRULE string (e.g. `FREQ=WEEKLY;BYDAY=MO`). When a recurring task is marked completed it is automatically **advanced** to the next occurrence and reset to *Needs Action* instead of being removed, giving a natural "rolling" behaviour.
- **`better_todo.set_task_recurrence` service** – sets or clears the RRULE on any task by its UID, callable from automations, scripts, and *Developer Tools → Actions*.
- **`task_recurrence` state attribute** – the entity exposes a dictionary of `{uid: rrule_string}` pairs so custom Lovelace cards or automations can read per-task recurrence rules.
- **Config-flow setup** – configure entirely through the UI; no YAML needed.
- **Local storage** – each list is persisted as a `.ics` file inside the HA `.storage` directory; no external services required.
- **HACS-compatible** structure (`hacs.json`, `manifest.json`).
- **GitHub Actions**: CI workflow with Ruff, Mypy, and Hassfest checks; HACS validation workflow.
- **Translations**: English UI strings.
