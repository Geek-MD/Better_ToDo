# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-02

### Added
- Automatic creation of "Shopping List" on first integration setup
- New config flow step `async_step_auto_shopping_list` for automatic list creation
- Enhanced configuration descriptions in English and Spanish translations

### Changed
- **BREAKING**: Default list name changed from "Shopping List" to "Tasks"/"Tareas"
- Updated configuration flow to detect first-time setup and automatically create a second list
- Improved user prompts with clearer default value indication
- Updated translations to reflect new default behavior

### Fixed
- Integration now properly creates both default task list and shopping list on initial setup

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

**Breaking Changes:**
- The default list name has changed from "Shopping List" to "Tasks". Existing installations are not affected.

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
