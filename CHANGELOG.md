# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-01-02

### Added
- **Custom Lovelace Card**: New `better-todo-card` custom card that replaces HA's default todo-list card
  - Uses the same HTML structure as Home Assistant's native todo card (`<h2>` within `<div class="header" role="separator">`)
  - Displays custom category headers: "No due date", "This week", and "Forthcoming"
  - Uses Home Assistant's native web components (ha-card, ha-check-list-item, ha-checkbox)
  - Automatically registered and available in the card picker
  - Perfect styling consistency with HA's design system
- Custom card documentation in `www/README.md`

### Changed
- **Removed "Done" category from backend**: Completed tasks now only use HA's native "Completed" section
- **Removed emoticons from category headers**: Category headers now display with professional text-only labels
- Category headers now only show for active tasks: "No due date", "This week", and "Forthcoming"
- Active task grouping no longer includes completed items (they use HA's native UI)
- Updated translations to remove "Done"/"Completadas" labels from active categories

### Fixed
- **Resolved header conflict**: Custom headers no longer appear under HA's default "Active" and "Completed" headers
- Tasks are now properly categorized without duplicate section headers
- Custom card bypasses HA's default formatting to show only the desired categories

### Notes
- **To use the new card**: Add `type: custom:better-todo-card` to your dashboard configuration
- The standard `todo-list` card still works but will show the old "Active"/"Completed" format
- Custom card is backward compatible and works with existing Better ToDo lists

## [0.4.0] - 2026-01-02

### Added
- **UI-Accessible Recurrence Configuration**: New helper entities for configuring task recurrence directly from the Home Assistant UI
- New entity platforms: Number, Select, Button, and Text for each todo list
- Helper entities per list:
  - `number.{list_name}_recurrence_interval`: Set interval value (1-365)
  - `number.{list_name}_recurrence_end_count`: Set end count (1-999)
  - `select.{list_name}_recurrence_unit`: Choose time unit (days/months/years)
  - `select.{list_name}_recurrence_end_type`: Choose end type (never/count/date)
  - `text.{list_name}_task_uid`: Specify target task UID
  - `text.{list_name}_recurrence_end_date`: Set end date (YYYY-MM-DD)
  - `button.{list_name}_apply_recurrence_settings`: Apply configured settings
- New service `better_todo.apply_recurrence_from_ui`: Reads helper entity values and applies recurrence to specified task
- Users can now configure recurrence visually without using Developer Tools
- **Automatic Task Grouping with Visual Category Headers**: Tasks are now automatically organized into groups with visible category headers:
  - "📭 No due date" / "📭 Sin fecha de vencimiento": Tasks without a due date
  - "📅 This week" / "📅 Esta semana": Tasks due within the current calendar week (respects locale: Monday start for Spanish, Sunday start for US English)
  - "📆 Forthcoming" / "📆 Próximamente": Tasks due after this week
  - "✅ Done" / "✅ Completadas": Completed tasks
  - Category headers are displayed as visual separators in the todo list UI
  - Headers are automatically translated based on Home Assistant's language setting
- Dashboard support infrastructure for creating custom "Better ToDo" dashboard (experimental)

### Changed
- Integration now creates 6 additional helper entities + 1 button per todo list for recurrence management
- Recurrence configuration workflow is now UI-first instead of service-first
- Tasks are automatically sorted by group and due date for better organization
- Task categories now display as visual headers in the todo list (replacing default "Active"/"Completed" labels)
- Category headers are automatically translated based on system language (English/Spanish supported)
- "This week" calculation now respects system locale (Monday start for most locales including Spanish, Sunday start for US English)

### Notes
- **Backward compatible**: Existing `set_task_recurrence` and `get_task_recurrence` services remain fully functional
- No breaking changes for existing installations
- Task grouping is automatic and does not require configuration
- Version bumped to 0.4.0 following semantic versioning (new feature, backward compatible)

## [0.3.0] - 2026-01-02

### Added
- Automatic creation of "Shopping List" on first integration setup
- New config flow step `async_step_auto_shopping_list` for automatic list creation
- Enhanced configuration descriptions in English and Spanish translations
- Constants for default list names to improve maintainability

### Changed
- Default list name changed from "Shopping List" to "Tasks"/"Tareas"
- Updated configuration flow to detect first-time setup and automatically create a second list
- Improved user prompts with clearer default value indication
- Updated translations to reflect new default behavior

### Fixed
- Integration now properly creates both default task list and shopping list on initial setup
- Added proper error handling and logging for automatic list creation

### Notes
- **No breaking changes for existing installations** - this only affects new setups
- Existing lists will continue to work without any changes

## [0.2.0] - Previous Release

### Added
- Recurrence support for tasks via services
- `set_task_recurrence` service for configuring task repetitions
- `get_task_recurrence` service for retrieving recurrence settings
- Recurrence end date and count options
- Recurrence data exposed via entity extra state attributes

### Features
- Full ToDo List Support: Create, update, delete, and move tasks
- Due Date Management: Set and track due dates for tasks
- Rich Descriptions: Add detailed descriptions to tasks
- Task Reordering: Organize tasks in preferred order
- Multiple Lists: Create multiple independent ToDo lists
- Native Home Assistant Integration: Seamless integration with HA's ToDo platform

## [0.1.0] - Initial Release

### Added
- Initial Better ToDo integration for Home Assistant
- Basic todo list management functionality
- Config flow for creating todo lists
- Support for task creation, updates, and deletion
- Due date and description support for tasks
- Task reordering capabilities

---

## Release Notes Templates

### For v0.3.0

**Title:** Better ToDo v0.3.0 - Improved First-Time Setup

**Description:**

This release improves the first-time setup experience by automatically creating both a default task list and a shopping list.

**What's New:**
- 🎯 Changed default list name to "Tasks" for better clarity
- 🛒 Automatic creation of "Shopping List" on first setup
- 🌍 Updated translations (English and Spanish)
- 🔧 Improved error handling and logging

**Changes:**
- The default list name has changed from "Shopping List" to "Tasks" for new installations
- Existing installations are not affected and will continue to work normally

**Installation:**
1. Update via HACS or download the latest release
2. Restart Home Assistant
3. For new installations, the integration will create both "Tasks" and "Shopping List" automatically

**Full Changelog:** https://github.com/Geek-MD/Better_ToDo/blob/main/CHANGELOG.md

---

## Version History

- **0.3.0** - Improved first-time setup with automatic list creation
- **0.2.0** - Added recurrence support for tasks
- **0.1.0** - Initial release
