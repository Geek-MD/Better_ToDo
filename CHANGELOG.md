# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.3] - 2026-05-19

### Fixed
- **Panel render regression**: restored the v0.5.0 create-list flow approach (`show-dialog` → `ha-config-flow`) and removed the inline `ha-dialog` implementation introduced in v0.5.2, which could break panel rendering in some HA frontend contexts.
- **"Create list" dialog not opening**: clicking *Create list* now again triggers Home Assistant's native config-flow dialog path used in v0.5.0.
- **Shopping List language mismatch in panel**: the panel now resolves the Shopping List label via `hass.localize("component.better_todo.entity.todo.shopping_list.name")`, so it follows the active HA frontend language instead of showing a fixed-language friendly name.

## [0.5.2] - 2026-05-19

### Fixed
- **"Create list" dialog not opening**: clicking *Create list* in the left pane now reliably opens a dialog. Replaced the v0.5.0 approach (dispatching a `show-dialog` event for the lazily-loaded `ha-config-flow` element, which silently failed in many navigation contexts) with an `ha-dialog`-based inline dialog that calls HA's config-flow REST API (`POST /api/config/config_entries/flow`) directly. Using `ha-dialog` (which internally uses `showModal()` / the browser top-layer) means the dialog overlays the full viewport correctly regardless of any CSS transforms applied by HA's panel transitions — avoiding the layout regression introduced by v0.5.1's `position: fixed` overlay approach.
- **Shopping List displaying lowercase name**: the built-in Shopping List entity now correctly shows its translated friendly name (e.g. *Lista de la compra* in Spanish, *Einkaufsliste* in German) instead of the entity_id-derived lowercase string `shopping list`. Root cause: `_attr_name = None` was set as an instance attribute in `__init__`, causing HA's entity name property to short-circuit before reaching the `translation_key` lookup. Fixed by removing the instance-level `_attr_name` attribute so HA's entity framework sees `UNDEFINED` and resolves the friendly name via `translation_key = "shopping_list"`.

## [0.5.0] - 2026-05-18

### Added
- **Custom panel**: Better To-do now registers a sidebar panel at `/better-todo` that mirrors the structural layout of the built-in HA To-do panel (`ha-two-pane-top-app-bar-fixed`) with a left pane and a right content area. The panel is implemented in plain JavaScript using LitElement accessed from HA's already-loaded frontend bundle (no external CDN dependency).
- **Left-pane todo list**: the left pane lists all `todo.*` entities found in `hass.states`. Entities are sorted alphabetically by friendly name; the built-in Better To-do Shopping List is always pinned last regardless of its translated name.
- **Right pane — task list view**: when a Better To-do task list is selected, the right pane renders a custom `better-todo-task-list` component that mirrors the behaviour of HA's native To-do panel. Items are displayed with a checkbox (mark done/pending), due-date and recurrence indicators, and a per-item delete button. A footer "Add task" button opens the Better To-do task dialog. Completed items are shown in a separate collapsed section below pending items.
- **Right pane — shopping list view**: when the built-in Shopping List is selected, the right pane renders a custom `better-todo-shopping-list` component. Items are **grouped by their assigned category**, with category headers shown in **alphabetical order** (only categories that contain at least one item are rendered). Each item displays its **name, quantity, and unit**. Items without a category appear after all named groups. Completed items are shown below all pending groups. Checkboxes allow marking items as done/pending.
- **Custom task dialog**: creating or editing a task opens a Better To-do-specific dialog (`better-todo-task-dialog`) with fields for task name, due date, optional due time, notes, and a **recurrence preset picker** (None / Daily / Weekly / Monthly / Yearly / Custom RRULE). Selecting *Weekly* reveals a day-of-week chip picker; selecting *Custom* exposes a free-text RRULE input. Recurrence is applied via the `better_todo.set_task_recurrence` service.
- **Mobile navigation (narrow screens < 750 px)**: on narrow screens the sidebar is replaced by a single-pane layout. Selecting a list shows the list content with a **back arrow** in the top-app-bar; tapping it returns to the list selector, which is rendered in the main content area with the same sorted order and the "Create list" footer row.
- **"Create list" pane footer**: a footer row with a `+` icon and the label *Create list* (localised via `hass.localize("ui.panel.todo.create_list")`) appears at the bottom of the left pane when the wide-screen layout is active.
- **List selection state**: clicking a list item selects it (highlighted via `ha-list-item`'s `.activated` property). The selection is persisted to `sessionStorage` so navigating away and back restores the last active list.
- **Empty state**: when no lists exist a localised "No lists found" message is displayed in the content area.
- **`async_setup`**: added integration-level setup that serves the frontend assets via `/better_todo_static` and registers the `better-todo-panel` custom panel with Home Assistant's `panel_custom` component.
- **`http` dependency**: added to `manifest.json` so Home Assistant loads the HTTP component before this integration.

### Fixed
- **`register_static_path` removed in recent HA versions**: replaced the deprecated `hass.http.register_static_path(...)` call with `hass.http.async_register_static_paths([StaticPathConfig(...)])` so the integration no longer raises `AttributeError: 'HomeAssistantHTTP' object has no attribute 'register_static_path'` during setup.
- **Panel and todo entities not loading**: `async_setup` was calling `panel_custom.async_register_panel` with `component_name=` instead of the correct `webcomponent_name=` parameter. This caused a `TypeError` that aborted integration setup entirely, preventing both the sidebar panel and all todo entities from being registered.
- **Panel rendering on fresh page load**: all component initialization is deferred until `ha-card` is defined, with a synchronous registration fast-path for the common case where HA's core bundle has already loaded. This eliminates the race condition where `createCustomPanelElement()` could run before `better-todo-panel` was registered, and prevents a `TypeError` when `Object.getPrototypeOf(customElements.get("ha-card"))` received `undefined`.
- **Panel title rendering**: the panel title slot now uses `<span slot="title">` instead of a block-level `<div>` to match `ha-panel-todo` behaviour inside `ha-two-pane-top-app-bar-fixed`'s MDC flex container.

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
