# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.8] - 2026-01-04

### Changed
- **JavaScript Module Registration**: Implemented view_assist pattern for reliable resource registration
  - Created new `javascript.py` module following [view_assist_integration](https://github.com/dinki/view_assist_integration) pattern
  - JavaScript resources now registered with proper version management and automatic updates
  - Module registration waits for Lovelace resources to be loaded before registering cards
  - Improved reliability of custom card loading across different Home Assistant configurations
  - Removed old static path registration in favor of dynamic module registration

### Changed
- **Dashboard Structure**: Dashboard now uses native Home Assistant todo-list cards by default
  - Dashboard automatically populated with native `todo-list` cards for each Better ToDo list
  - Full compatibility with Home Assistant core To-do List integration structure
  - Custom cards (better-todo-card, better-todo-dashboard-card) remain available as optional enhancements
  - No manual configuration required - dashboard works out of the box
  - Better alignment with Home Assistant's native UI patterns

### Added
- **Constants**: Added `URL_BASE` and `JSMODULES` constants to `const.py` for module management
  - JSMODULES includes module metadata (name, filename, version) for tracking
  - Version-aware resource registration ensures updates are applied when needed

### Technical Details
- Following the pattern from [view_assist_integration](https://github.com/dinki/view_assist_integration)
- JavaScript modules registered via `JSModuleRegistration` class with proper lifecycle management
- Resources checked and updated based on version changes
- Native `todo-list` cards provide standard Home Assistant interface
- Custom cards registered but not required for basic functionality
- All changes pass ruff and mypy validation

### Notes
- Users will see native todo-list cards by default after update
- Custom cards remain available and can be manually configured if desired
- No breaking changes - existing custom card configurations will continue to work
- Reload browser after update to load new JavaScript modules

## [0.6.7] - 2026-01-04

### Fixed
- **Lovelace Resource Registration**: Fixed persistent "Custom element not found: better-todo-dashboard-card" error
  - **Root cause identified**: Incorrect API field name and fallback logic bug
  - Changed API resource field from `"type"` to `"res_type"` following Home Assistant standard (as used by view_assist_integration)
  - Fixed critical bug where fallback to file storage was never reached when API returned dict
  - Improved resource registration to check if Lovelace resources are loaded before attempting registration
  - Simplified resource checking logic using `async_items()` method
  - Resources now properly saved to storage file only when actually modified
  - Changed error logging level from DEBUG to ERROR for better visibility of critical issues
  - Custom dashboard cards now load reliably in all Home Assistant configurations

### Technical Details
- Following the pattern from [view_assist_integration](https://github.com/dinki/view_assist_integration)
- When using Lovelace resources API (`resources.async_create_item()`), the field must be `"res_type": "module"` not `"type": "module"`
- When writing directly to storage file, the field remains `"type": "module"`
- Fixed logic bug where code would return after API loop even when resources were dict, preventing fallback
- Improved API success tracking to ensure fallback is attempted when needed
- Added check for `resources.loaded` to ensure Lovelace resources are ready
- File storage writes are conditional on actual changes to prevent unnecessary I/O

### Notes
- Users experiencing the "Custom element not found" error should reload their browser after updating
- This fix addresses the root cause of the resource loading issue
- No breaking changes - existing installations will continue to work normally
- If custom cards still don't load after update, check Settings → Dashboards → Resources to verify they're registered

## [0.6.6] - 2026-01-04

### Fixed
- **Lovelace Resource Type**: Fixed "Custom element not found: better-todo-dashboard-card" error
  - Changed Lovelace resource type from "module" to "js" in dashboard.py
  - Affects both Lovelace API registration and file storage fallback methods
  - Custom dashboard card JavaScript files now load properly
  - Custom elements are registered correctly and dashboard displays without configuration errors

### Technical Details
- Updated resource type at three locations in dashboard.py (lines 114, 118, 201)
- Home Assistant Lovelace requires resource type "js" for custom cards
- Both better-todo-card and better-todo-dashboard-card resources fixed
- Code validated with ruff and mypy

## [0.6.5] - 2026-01-04

### Fixed
- **Dashboard Panel Configuration Error**: Fixed "Configuration error" warning displayed in dashboard panel
  - Changed websocket failure message from WARNING to DEBUG level to avoid alarming users
  - Reorganized dashboard creation logic to ensure proper file creation order
  - Dashboard registry (lovelace_dashboards) is now created before dashboard config file
  - Dashboard configuration is only saved when dashboard is successfully created
  - Improved error handling with proper ERROR level logging for actual failures
  - Fallback method now properly tracks success/failure state

### Changed
- **Improved Logging**: Better log level usage for dashboard creation process
  - DEBUG: Websocket API not available (expected in some HA configurations)
  - INFO: Successful operations
  - ERROR: Actual failures that need attention
  - Reduces noise in logs while maintaining visibility of real issues

### Technical Details
- Dashboard creation now uses three-state tracking: `dashboard_exists`, `websocket_success`, `fallback_success`
- Configuration save is conditional on successful dashboard creation via any method
- File storage fallback creates registry entry before config file to prevent orphaned configs
- All changes maintain backward compatibility with existing installations

### Notes
- This fix resolves the "Configuration error" message that appeared when websocket API was not available
- The fallback method now works reliably without generating warnings
- No manual intervention required - the fix applies automatically on next integration reload

## [0.6.4] - 2026-01-04

### Fixed
- **Dashboard Configuration KeyError**: Fixed `KeyError: 'config'` when loading Better ToDo dashboard
  - Updated dashboard storage format to wrap configuration in a "config" key
  - Home Assistant's lovelace system expects `{"config": {...}}` structure in storage
  - Fixed both Storage API and file storage fallback methods
  - Resolves "Unknown Error" message when selecting Better ToDo dashboard
  - Dashboard now loads properly without requiring UI reload

### Technical Details
- Changed `store.async_save(config)` to `store.async_save({"config": config})`
- Updated file storage metadata structure from `"data": config` to `"data": {"config": config}`
- Ensures compatibility with Home Assistant's lovelace dashboard loader

### Notes
- This is a critical fix for dashboard display issues
- Users may need to remove and recreate the integration for the fix to take effect, or manually delete the `.storage/lovelace.better-todo` file
- No other functional changes

## [0.6.3] - 2026-01-04

### Fixed
- **Dashboard API Compatibility**: Fixed `AttributeError: 'dict' object has no attribute 'async_items_ids'`
  - Updated dashboard.py to handle both dictionary and collection object types for `lovelace_data.dashboards`
  - Added proper type checking with `isinstance(dashboards, dict)` before accessing methods
  - Fixes error "Error setting up entry Tasks for better_todo" and "Error setting up entry Shopping List for better_todo"
  - Maintains compatibility with different Home Assistant versions that may return different data structures

### Technical Details
- Dashboard and resource access now gracefully handles both dict and collection object APIs
- All four occurrences of `async_items_ids()` calls now check the object type first
- Falls back to file-based dashboard management when dict API is detected
- No functional changes - only compatibility improvements

### Notes
- This is a patch release that improves compatibility with Home Assistant's lovelace API
- No breaking changes - existing installations will continue to work normally

## [0.6.2] - 2026-01-04

### Changed
- **Dashboard Content**: Updated dashboard to replicate the core To-do List integration layout
  - Dashboard now includes `better-todo-dashboard-card` by default
  - Two-section layout: Lists on the left, tasks on the right
  - Matches the user experience of Home Assistant's core To-do List dashboard
  - Users can still customize the dashboard by editing it through the UI

### Fixed
- **Dependencies**: Added `lovelace` to dependencies in manifest.json
  - Required because the code imports from `homeassistant.components.lovelace`
  - Fixes Hassfest validation error

### Technical Details
- Dashboard configuration now includes the better-todo-dashboard-card instead of being empty
- Card provides the same two-section interface as the core integration
- Left section displays all Better ToDo lists with task counts
- Right section shows tasks from the selected list with category headers

### Notes
- This change makes the dashboard immediately useful after installation
- The dashboard still supports customization through the UI
- No breaking changes - existing installations will see the new card on reload

## [0.6.1] - 2026-01-04

### Changed
- **Dashboard Panel Registration**: Improved automatic dashboard panel creation using websocket API approach
  - Implemented `MockWSConnection` class to programmatically call `lovelace/dashboards/create` websocket endpoint
  - Dashboard panel now appears automatically in the sidebar when the integration is configured
  - Based on the approach used in `view_assist_integration` for reliable panel registration
  - Maintains file storage fallback for compatibility with different Home Assistant versions
  - Empty dashboard panel is created by default, allowing users to customize with their own cards

### Technical Details
- Added `MockWSConnection` class to simulate websocket connections for dashboard creation
- Uses Home Assistant's websocket API (`lovelace/dashboards/create`) for programmatic dashboard registration
- Dashboard is created with `show_in_sidebar: True` and `mode: "storage"` settings
- Proper error handling with fallback to file-based dashboard creation
- Dashboard appears immediately without requiring a Home Assistant restart

### Notes
- The dashboard panel is intentionally empty by default, as requested
- Users can customize the dashboard by clicking the three dots menu → "Edit Dashboard"
- This is a patch release that improves the dashboard creation reliability
- No breaking changes - existing installations will continue to work normally

## [0.6.0] - 2026-01-03

### Added
- **Custom Task Dialog**: New integrated dialog for creating and editing tasks with all configuration options
  - Task status checkbox (pending/completed)
  - Task name/summary input field
  - Task description textarea
  - Task due date picker
  - **Recurrence configuration section** with:
    - Enable/disable checkbox for recurrence
    - Interval number input (1-365)
    - Unit dropdown: días/days, semanas/weeks, meses/months, años/years
  - **Stop recurrence section** with:
    - Enable/disable checkbox for stop condition
    - Two mutually exclusive options:
      - Iteration count input (after X repetitions)
      - End date picker (until specific date)
  - Automatic translations (Spanish/English) for all dialog labels
  - Smart form interactions (radio buttons auto-select when inputs are focused)
  - Proper enable/disable states for conditional sections
- **Weeks Support**: Added "weeks" as a new recurrence unit option
  - Available in all services and UI dialogs
  - Fully integrated with existing recurrence system
- **Task Creation Button**: Added "+" button in card header to create new tasks
- **Task Editing**: Click on any task to edit it with the dialog
  - All task properties can be modified
  - Recurrence settings are loaded and can be updated
  - Works in both better-todo-card and better-todo-dashboard-card

### Changed
- **Simplified Workflow**: Task creation and editing now happens through a single unified dialog
  - No need to use separate helper entities for recurrence configuration
  - All task properties and recurrence settings configured in one place
  - Immediate feedback when saving tasks
- **User Experience**: Click-to-edit interaction for all tasks
  - More intuitive task management
  - Faster workflow for editing task details
  - Visual cursor indication on hover

### Technical Details
- Dialog uses Home Assistant's native `ha-dialog` component
- Integrates with `better_todo.create_task`, `better_todo.update_task`, and `better_todo.set_task_recurrence` services
- Maintains backward compatibility with existing helper entities
- JavaScript dialog implementation in both card variants
- Form validation ensures required fields are filled
- Recurrence data automatically synced when creating new tasks

### Notes
- **Helper entities still work**: The existing number, select, text, and button entities for recurrence configuration remain functional
- **No breaking changes**: Existing installations will continue to work normally
- **Browser refresh recommended**: Clear browser cache to load the new dialog functionality
- This release follows the requirement: "cada tarea queda configurada completamente cuando es creada o cuando es editada, y no se necesitan las entidades ayudantes"

## [0.5.4] - 2026-01-03

### Fixed
- **entity_id Property Setter**: Fixed `AttributeError: property 'entity_id' of 'BetterTodoEntity' object has no setter`
  - Added setter for `entity_id` property to allow Home Assistant to set the entity ID
  - Added `_entity_id` instance variable to store the entity ID
  - Property now returns stored value if available, otherwise generates from list name
- **Blocking I/O Operations**: Fixed blocking file operations that were blocking the event loop
  - Added async helper functions `_async_read_file()` and `_async_write_file()` in `dashboard.py`
  - Replaced all synchronous `open()` calls with async operations using `hass.async_add_executor_job()`
  - Fixed 5 blocking I/O operations:
    - Reading lovelace_resources file
    - Writing lovelace_resources file
    - Writing lovelace dashboard configuration file
    - Reading lovelace_dashboards registry file
    - Writing lovelace_dashboards registry file
  - Fixed file unlink operation to use async executor with inner function wrapper
- **Sidebar Integration Approach**: Corrected sidebar integration implementation
  - Removed incorrect panel registration using `async_register_built_in_panel`
  - Dashboard now appears in sidebar through proper Lovelace dashboard registration with `show_in_sidebar: True`
  - Simplified code by removing unnecessary `_async_register_panel()` and `_async_remove_panel()` functions
  - This is the correct approach: create a Lovelace dashboard, not a frontend panel

### Technical Details
- All file I/O operations now properly run in executor threads to prevent blocking the event loop
- Entity ID property follows Home Assistant's entity management pattern
- Sidebar integration uses standard Lovelace dashboard registration instead of custom panel API

### Notes
- These fixes resolve all errors reported in Home Assistant logs
- No breaking changes - existing installations will work without modifications
- Integration now follows Home Assistant's best practices for async operations and dashboard creation

## [0.5.3] - 2026-01-03

### Added
- **Sidebar Panel Registration**: Implemented proper frontend panel registration for Better ToDo dashboard
  - Uses `hass.components.frontend.async_register_built_in_panel` API similar to HACS, Terminal, and FileEditor
  - Creates a dedicated sidebar panel with custom icon (`mdi:checkbox-marked-circle-outline`) and title
  - Panel appears in sidebar immediately after integration setup
  - No admin requirement - accessible to all users
  - Proper cleanup: panel is removed when last integration entry is unloaded

### Changed
- **Dependencies**: Added "frontend" to manifest.json dependencies
  - Required for using Home Assistant's frontend panel registration API
  - Ensures proper integration with Home Assistant's frontend component

### Technical Details
- Panel type: Lovelace component with storage mode
- URL path: `/better-todo`
- Panel registration follows the same pattern as major integrations (HACS, Zigbee2MQTT, Terminal, FileEditor)
- Implements both `_async_register_panel` and `_async_remove_panel` functions
- Checks for existing panel registration to avoid duplicates
- Comprehensive module documentation explaining sidebar panel integration

### Notes
- This change ensures Better ToDo has a persistent, always-visible sidebar entry
- Compatible with existing dashboard implementation
- Existing installations will see the panel registered on next integration reload
- No manual configuration changes required

## [0.5.2] - 2026-01-02

### Fixed
- **Dashboard Display Issue**: Fixed Better ToDo dashboard showing Overview content instead of custom card
  - Added `mode: "storage"` field to dashboard metadata to properly identify dashboard type
  - Dashboard now correctly displays the custom Better ToDo card with task lists
  - Fixes issue where dashboard would show generic Overview instead of Better ToDo tasks
- **No Restart Required**: Dashboard now appears immediately after integration setup
  - Added `_async_reload_frontend_panels()` function to reload lovelace configuration
  - Triggers lovelace resources reload after dashboard creation
  - Fires `lovelace_updated` and `panels_updated` events to notify frontend
  - Users no longer need to restart Home Assistant to see the Better ToDo dashboard

### Technical Details
- Dashboard metadata now includes `mode: "storage"` in both API and file storage methods
- Frontend reload mechanism uses multiple approaches for maximum compatibility:
  - Refreshes lovelace dashboards state through internal API
  - Calls `lovelace.reload_resources` service to reload custom cards
  - Fires events to notify frontend of configuration changes
- All changes maintain backward compatibility with existing installations

### Notes
- Existing installations will benefit from these fixes on next integration reload
- No manual configuration changes required
- Dashboard should now appear in sidebar immediately after setup

## [0.5.1] - 2026-01-02

### Fixed
- **Dashboard Display Issues**: Fixed critical issues preventing Better ToDo dashboard from displaying tasks
  - Removed `Platform.TODO` from PLATFORMS list to prevent Home Assistant from treating Better ToDo as a native TODO platform
  - This prevents the native "To-do lists" dashboard from appearing for Better ToDo entities
  - Added `todo_items` attribute alias in entity state attributes for custom cards compatibility
  - Custom cards now properly display tasks instead of showing empty
- **Integration Type**: Changed `integration_type` from "hub" back to "service" in manifest
  - Allows uninstalling the entire integration at once instead of removing each list separately
  - Better user experience for managing the integration
- **Dashboard Removal**: Improved dashboard cleanup logic when uninstalling integration
  - Dashboard is now properly removed when all lists are deleted
  - Fixed logic to check remaining entries excluding the one being unloaded
  - Added logging for dashboard removal operations
- **Entity Registration**: Todo entities are now manually registered using `EntityComponent`
  - Proper entity registration without using `Platform.TODO`
  - Maintains `todo.*` domain for backward compatibility
  - Entities work correctly with all Better ToDo services

### Technical Details
- Better ToDo entities no longer use the TODO platform interface
- Entities are registered directly through the entity component system
- All custom cards now work correctly with the updated attribute structure
- Dashboard creation and removal properly handle all edge cases

### Notes
- **No breaking changes** - existing installations will continue to work
- **Restart required** after updating to load the new dashboard configuration
- Users may need to clear browser cache to see updated custom cards
- The native "To-do lists" dashboard will no longer show Better ToDo tasks

## [0.5.0] - 2026-01-02

### ⚠️ BREAKING CHANGE - Major Architecture Update

**This is a major architectural change that makes Better ToDo fully independent from Home Assistant's core Todo integration.**

### Changed
- **Entity Architecture**: Complete rewrite of the todo entity system
  - Changed from inheriting `TodoListEntity` to using base `Entity` class
  - Tasks are now managed by custom services instead of the Platform.TODO interface
  - Entities still use `todo.*` domain for backward compatibility
  - **Result**: Tasks NO LONGER appear in Home Assistant's native "To-do lists" dashboard
  - Better ToDo dashboard is now the exclusive interface for managing tasks

### Added
- **New Task Management Services**: Added 4 new services for complete task control
  - `better_todo.create_task`: Create new tasks with summary, description, and due date
  - `better_todo.update_task`: Update existing tasks (summary, description, due date, status)
  - `better_todo.delete_task`: Delete one or more tasks by UID
  - `better_todo.move_task`: Reorder tasks within the list
- **Persistent Storage**: Tasks are now saved to Home Assistant storage
  - Data persists across restarts
  - Storage location: `.storage/better_todo.{entry_id}.tasks`
- **Custom TodoItem Dataclass**: Replicated `homeassistant.components.todo.TodoItem` functionality
  - Independent from core HA todo components
  - Fully compatible with existing Better ToDo features

### Fixed
- **Dashboard Creation**: Improved dashboard registration and removal
  - Dashboard now properly uses Lovelace API first, then falls back to file storage
  - Symmetric creation and deletion logic
  - Better error handling and logging
  - Dashboard is always created on integration installation
  - Dashboard is always removed on integration uninstallation

### Improved
- **Service Logging**: Better visibility into dashboard operations
  - Changed from debug to info/warning levels for important events
  - Clear messages about which registration method is being used
- **Code Organization**: Custom entity fully encapsulates task management logic
- **Data Attributes**: Tasks now exposed in entity attributes for custom card access

### Migration Notes
- **Automatic**: No user action required for existing installations
- **Entity IDs**: Remain the same (`todo.list_name`)
- **Task Data**: Will be migrated to new storage format automatically
- **Custom Cards**: Continue to work without changes
- **Automations**: May need to update task operations to use new services

### Why This Change?
This architectural change addresses the main issue: preventing Better ToDo tasks from appearing in Home Assistant's native "To-do lists" dashboard. Now Better ToDo operates completely independently, giving users a dedicated experience through the Better ToDo dashboard only.

## [0.4.5] - 2026-01-02

### Added
- **Two-Section Dashboard Card**: New `better-todo-dashboard-card` that mimics the core ToDo integration layout
  - Left section: Displays all Better ToDo lists with task counts
  - Right section: Shows tasks from the selected list with category headers
  - Click on a list in the left panel to view its tasks in the right panel
  - Automatic task organization with "No due date", "This week", "Forthcoming", and "Completed" categories
  - Responsive layout with proper styling that matches Home Assistant's design system

### Changed
- **Dashboard Layout**: Better ToDo dashboard now uses the new two-section card instead of individual cards per list
  - Single unified view showing all lists and their tasks
  - More intuitive navigation between different todo lists
  - Similar user experience to Home Assistant's core todo integration
- Dashboard configuration simplified to use one main card for all lists

### Fixed
- **Blocking I/O Error**: Fixed error "Detected that custom integration 'better_todo' calls hass.http.register_static_path which does blocking I/O in the event loop"
  - Changed from `hass.http.register_static_path()` to `await hass.http.async_register_static_paths([StaticPathConfig(...)])`
  - Eliminates blocking I/O operations in the event loop
  - Improves integration performance and Home Assistant startup time
- **Lovelace Resources**: Improved automatic registration of custom cards as Lovelace resources
  - Both `better-todo-card` and `better-todo-dashboard-card` are now properly registered
  - Resources are added to `.storage/lovelace_resources` if API method fails
- **Manifest Dependencies**: Added `http` component to dependencies in manifest.json
  - Required for `hass.http.async_register_static_paths()` functionality
  - Fixes Hassfest validation error

### Notes
- **Recommended Usage**: The Better ToDo dashboard now provides a unified two-section interface
- **Individual Card Still Available**: The `better-todo-card` can still be used manually for single-list views
- Users will need to refresh their browser after updating to load the new dashboard card
- The new dashboard card provides a better user experience aligned with Home Assistant's core todo integration

## [0.4.4] - 2026-01-02

### Fixed
- **Dashboard and Entity Visibility**: Changed `integration_type` from `"service"` to `"hub"` in manifest.json
  - Fixes issue where Better ToDo dashboard was not showing in sidebar
  - Fixes issue where Better ToDo custom card was not displaying properly
  - Entities are now properly recognized and displayed by Home Assistant
  - The integration creates multiple entity types (TODO, NUMBER, SELECT, BUTTON, TEXT) organized by devices, making "hub" the appropriate integration type

### Notes
- This is a critical fix for dashboard and entity visibility issues
- No code changes required - only metadata correction in manifest.json
- All existing functionality remains unchanged
- Users should see the Better ToDo dashboard appear in the sidebar after updating

## [0.4.3] - 2026-01-02

### Added
- **Custom Lovelace Card**: New `better-todo-card` custom card that replaces HA's default todo-list card
  - Uses the same HTML structure as Home Assistant's native todo card (`<h2>` within `<div class="header" role="separator">`)
  - Displays custom category headers: "No due date", "This week", and "Forthcoming"
  - Uses Home Assistant's native web components (ha-card, ha-check-list-item, ha-checkbox)
  - Automatically registered and available in the card picker
  - Perfect styling consistency with HA's design system
- Custom card documentation in `www/README.md`
- **Better ToDo Dashboard**: Automatic dashboard creation with custom cards
  - Dashboard named "Better ToDo" with all todo lists
  - Uses custom `better-todo-card` for each list
  - Includes recurrence configuration cards

### Changed
- **Removed "Done" category from backend**: Completed tasks now only use HA's native "Completed" section
- **Removed emoticons from category headers**: Category headers now display with professional text-only labels
  - All emoticons (📭📅📆✅📌) removed from code and documentation
  - Header prefixes changed from "📌" to "---" for professional appearance
- **Dashboard uses custom cards**: `dashboard.py` now creates cards with `custom:better-todo-card` instead of `todo-list`
- Category headers now only show for active tasks: "No due date", "This week", and "Forthcoming"
- Active task grouping no longer includes completed items (they use HA's native UI)
- Updated translations to remove "Done"/"Completadas" labels from active categories

### Fixed
- **Resolved header conflict**: Custom headers no longer appear under HA's default "Active" and "Completed" headers
- Tasks are now properly categorized without duplicate section headers
- Custom card bypasses HA's default formatting to show only the desired categories
- Ruff linting issues resolved (f-string without placeholders)

### Notes
- **To use the new card manually**: Add `type: custom:better-todo-card` to your dashboard configuration
- **Better ToDo Dashboard**: Check sidebar for "Better ToDo" dashboard with all lists
- **About native "To-do lists" dashboard**: HA automatically creates this dashboard for TODO entities. Better ToDo entities will appear there, but we recommend using the "Better ToDo" dashboard for the enhanced experience
- **To hide native dashboard**: Settings → Dashboards → "To-do lists" → Hide from sidebar
- The standard `todo-list` card still works but will show the old "Active"/"Completed" format
- Custom card is backward compatible and works with existing Better ToDo lists
- Version bumped to 0.4.3 due to multiple corrections and enhancements

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
