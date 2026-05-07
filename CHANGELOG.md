# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-05-07

### Added
- Added translations for **Spanish** (`es`), **French** (`fr`), **Portuguese** (`pt`) and **German** (`de`).
- Added `data_description` hints to `strings.json` and `translations/en.json` for richer config-flow UX.

### Fixed
- Added `http` to `dependencies` in `manifest.json` to satisfy Hassfest validation.
- Added `CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)` so Hassfest no longer warns about a missing schema on `async_setup`.

## [0.2.0] - 2026-05-07

### Added
- Added a native **Better To-do panel** (`/better-todo`) with a layout aligned to the standard To-do card style.
- Added in-panel dialogs to create/edit tasks with due date, description, and RRULE recurrence field.
- Added automatic registration of frontend static assets and panel metadata during integration setup.

## [0.1.2] - 2026-05-07

### Fixed
- Ensure new Better To-do entities initialize with a valid first state so they do not remain `unknown` after setup.
- Refresh entities before add (`update_before_add=True`) so newly created lists appear correctly in Home Assistant Tasks.

## [0.1.1] - 2026-05-07

### Fixed
- Register `better_todo.set_task_recurrence` with an entity-service-compatible schema so setup works on current Home Assistant versions.
- Accept the entity-service payload format when handling `set_task_recurrence`, matching Home Assistant's runtime behavior.

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
