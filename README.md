[![Geek-MD - Better ToDo](https://img.shields.io/static/v1?label=Geek-MD&message=Better%20ToDo&color=blue&logo=github)](https://github.com/Geek-MD/Better_ToDo)
[![Stars](https://img.shields.io/github/stars/Geek-MD/Better_ToDo?style=social)](https://github.com/Geek-MD/Better_ToDo)
[![Forks](https://img.shields.io/github/forks/Geek-MD/Better_ToDo?style=social)](https://github.com/Geek-MD/Better_ToDo)

[![GitHub Release](https://img.shields.io/github/release/Geek-MD/Better_ToDo?include_prereleases&sort=semver&color=blue)](https://github.com/Geek-MD/Better_ToDo/releases)
[![License](https://img.shields.io/badge/License-MIT-blue)](https://github.com/Geek-MD/Better_ToDo/blob/main/LICENSE)
[![HACS Custom Repository](https://img.shields.io/badge/HACS-Custom%20Repository-blue)](https://hacs.xyz/)

[![Ruff + Mypy + Hassfest](https://github.com/Geek-MD/Better_ToDo/actions/workflows/ci.yaml/badge.svg)](https://github.com/Geek-MD/Better_ToDo/actions/workflows/ci.yaml)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![Checked with mypy](https://www.mypy-lang.org/static/mypy_badge.svg)](https://mypy-lang.org/)

# Better ToDo

A Home Assistant custom integration for advanced ToDo list management.

## Features

- ✅ **Full ToDo List Support**: Create, update, delete, and move tasks
- 📅 **Due Date Management**: Set and track due dates for your tasks
- 📝 **Rich Descriptions**: Add detailed descriptions to your tasks
- 🔄 **Task Reordering**: Organize tasks in your preferred order
- 🎯 **Multiple Lists**: Create multiple independent ToDo lists
- 🔁 **Task Recurrence**: Configure recurring tasks with flexible intervals and end conditions
- ✨ **Integrated Task Dialog**: Create and edit tasks with a single dialog that includes all settings (name, description, due date, recurrence, and stop conditions)
- 🛒 **Auto-Setup**: First-time setup automatically creates both a default task list and a shopping list
- 🏠 **Native Home Assistant Integration**: Seamlessly integrates with Home Assistant's ToDo platform
- 🎨 **Custom Lovelace Card**: Beautiful card with category headers that match HA's native design
- 🌍 **Multilingual**: Automatic translations (English/Spanish) based on your HA language setting

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click on "Integrations"
3. Click the three dots in the top right corner
4. Select "Custom repositories"
5. Add `https://github.com/Geek-MD/Better_ToDo` and select "Integration" as the category
6. Click "Add"
7. Find "Better ToDo" in the integration list and click "Download"
8. Restart Home Assistant

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/Geek-MD/Better_ToDo/releases)
2. Extract the `custom_components/better_todo` directory to your Home Assistant's `custom_components` directory
3. Restart Home Assistant

## Configuration

### Adding the Integration

1. Go to **Settings** → **Devices & Services**
2. Click **+ Add Integration**
3. Search for **Better ToDo**
4. Follow the configuration steps:
   - Enter a name for your default ToDo list (defaults to "Tasks")
   - On **first setup**, a "Shopping List" will be created automatically
5. Click **Submit**

### Creating Additional Lists

You can create more ToDo lists by adding the integration again with different names. The automatic "Shopping List" creation only happens on the first setup.

## Usage

### Better ToDo Dashboard

After installation, Better ToDo automatically creates a dedicated dashboard named **"Better ToDo"** in your sidebar. The dashboard uses **a View Assist-inspired approach** that combines JavaScript DOM injection with native Home Assistant components for maximum reliability.

**How It Works:**
The Better ToDo panel uses a hybrid approach similar to the View Assist integration:
1. A minimal dashboard panel is created in the sidebar
2. JavaScript (`better-todo-panel.js`) automatically injects native `todo-list` cards into the panel
3. Cards are dynamically created for each Better ToDo entity
4. All interactions use native Home Assistant todo services

**Benefits of This Approach:**
- ✅ Automatic card generation - no manual YAML configuration needed
- ✅ Uses native Home Assistant `todo-list` cards for maximum compatibility
- ✅ DOM injection ensures cards are always properly rendered
- ✅ Full support for all task operations (create, update, delete, mark complete)
- ✅ Reliable visualization without complex custom card dependencies
- ✅ Inspired by the proven View Assist integration pattern

**To view your tasks:**
1. Click on "Better ToDo" in your Home Assistant sidebar
2. All your Better ToDo lists will appear as separate cards
3. Add, edit, complete, and delete tasks using the native interface

**To customize the dashboard:**
The dashboard is automatically managed by the integration, but you can still:
1. Navigate to the "Better ToDo" dashboard in your sidebar
2. Click the three dots menu (⋮) in the top right corner
3. Select "Edit Dashboard" to add additional cards or modify the layout

**Important Note:**
Better ToDo uses JavaScript to dynamically inject native todo-list cards into the dashboard panel. This approach, inspired by the View Assist integration, ensures reliable visualization without the complexity of custom card definitions or YAML configuration.

### Managing Tasks

Once configured, you can manage your tasks from the Better ToDo dashboard or via services:

**Via Dashboard (Recommended):**

The Better ToDo custom cards now include an integrated dialog for creating and editing tasks:

- **Create tasks**: Click the "+" button in the card header to open the task creation dialog
  - Fill in task name (required), description, and due date
  - Configure recurrence settings directly in the dialog:
    - Enable/disable recurrence
    - Set interval (e.g., every 2 days, 1 week, 3 months)
    - Choose to stop after X repetitions or on a specific date
  - All settings are saved when you click "Save"
  
- **Edit tasks**: Click on any task to open the edit dialog
  - Modify any task property: name, description, due date, status
  - Update recurrence settings
  - Changes are saved immediately
  
- **Complete tasks**: Check the checkbox next to a task to mark it as done
- **Task organization**: Tasks are automatically grouped into categories (No due date, This week, Forthcoming, Completed)

**Via Services (Advanced):**
- `better_todo.create_task`: Create new tasks programmatically
- `better_todo.update_task`: Update existing tasks
- `better_todo.delete_task`: Delete one or more tasks
- `better_todo.move_task`: Reorder tasks in the list

See the [Services](#services) section below for detailed service documentation.

#### Automatic Task Organization with Custom Card

Better ToDo includes a custom Lovelace card (`better-todo-card`) that displays tasks with visual category headers:

- **No due date**: Tasks without a due date
- **This week**: Tasks due within the current calendar week (respects your locale settings - Monday start for Spanish/European locales, Sunday start for US English)
- **Forthcoming**: Tasks due after this week
- **Completed**: Completed tasks (uses HA's native section)

**Features:**
- Category headers use the same HTML structure as HA's native todo card (`<h2>` within `<div class="header" role="separator">`)
- Headers are automatically translated based on your Home Assistant language setting
- Tasks within each group are sorted by due date (earliest first)
- Replaces the default "Active" header with more meaningful categories
- Perfect styling consistency with Home Assistant's design system

**To use:** Add the custom card to your dashboard (see Lovelace Cards section below)

### Task Recurrence

Better ToDo offers three ways to configure recurring tasks:

#### Option 1: Using the Task Dialog (Recommended - New in v0.6.0)

The easiest way to configure recurrence is directly in the task creation/edit dialog:

1. Click the "+" button to create a new task, or click on an existing task to edit it
2. Fill in the task details (name, description, due date)
3. In the **Recurrence** section:
   - Check "Enable recurrence" to activate recurrence
   - Set "Every" to the interval value (e.g., 1, 2, 3)
   - Choose the unit: days, weeks, months, or years
4. In the **Stop recurrence** section (optional):
   - Check "Enable recurrence limit" to set an end condition
   - Choose either:
     - "After X repetitions" - task repeats a specific number of times
     - "Until [date]" - task repeats until a specific date
5. Click "Save" to create/update the task with recurrence settings

**All recurrence settings are configured in one place when creating or editing a task!**

#### Option 2: Using Helper Entities

Each todo list comes with helper entities for recurrence configuration:

1. Find the recurrence helper entities for your list in **Settings** → **Devices & Services** → **Better ToDo** → Your List Device
2. Set the values:
   - **Task UID**: Enter the UID of the task (find it in entity attributes)
   - **Recurrence interval**: How often to repeat (1-365)
   - **Recurrence unit**: Time unit (days/weeks/months/years)
   - **Recurrence end type**: Choose never, count, or date
   - **Recurrence end count**: Number of repetitions (if using count)
   - **Recurrence end date**: End date (if using date)
3. Press the **Apply recurrence settings** button

#### Option 3: Using Services (Advanced)

For automation or advanced use, configure recurrence via services:

1. Go to **Developer Tools** → **Services**
2. Select the service `better_todo.set_task_recurrence`
3. Configure the recurrence settings:
   - **Entity ID**: Your todo list entity (e.g., `todo.tasks`)
   - **Task UID**: The unique identifier of the task (visible in entity attributes)
   - **Enable recurrence**: Turn on/off recurrence
   - **Recurrence interval**: How often to repeat (e.g., 1, 2, 3)
   - **Recurrence unit**: Time unit (days, weeks, months, years)
   - **Enable recurrence end**: Set a limit for repetitions
   - **End type**: End after count or on a specific date
   - **End count**: Number of repetitions
   - **End date**: Date to stop repeating

**Example automation to set weekly recurring task:**

```yaml
service: better_todo.set_task_recurrence
data:
  entity_id: todo.tasks
  task_uid: "abc123-task-uid"
  recurrence_enabled: true
  recurrence_interval: 1
  recurrence_unit: "days"
  recurrence_end_enabled: false
```

**To view recurrence data:**

- Use the service `better_todo.get_task_recurrence` to refresh the data
- Check the entity's `recurrence_data` attribute in **Developer Tools** → **States**

### Task Management Services

Better ToDo provides comprehensive services for task management (v0.5.0+):

#### Create Task

Create a new task in a todo list:

```yaml
service: better_todo.create_task
data:
  entity_id: todo.tasks
  summary: "Buy groceries"
  description: "Milk, eggs, bread"
  due: "2026-01-15"
```

#### Update Task

Update an existing task:

```yaml
service: better_todo.update_task
data:
  entity_id: todo.tasks
  uid: "abc123-task-uid"
  summary: "Buy groceries and supplies"
  status: "completed"
```

#### Delete Task

Delete one or more tasks:

```yaml
# Delete single task
service: better_todo.delete_task
data:
  entity_id: todo.tasks
  uid: "abc123-task-uid"

# Delete multiple tasks
service: better_todo.delete_task
data:
  entity_id: todo.tasks
  uid: ["uid1", "uid2", "uid3"]
```

#### Move Task

Reorder tasks in the list:

```yaml
# Move to beginning
service: better_todo.move_task
data:
  entity_id: todo.tasks
  uid: "task-to-move-uid"

# Move after specific task
service: better_todo.move_task
data:
  entity_id: todo.tasks
  uid: "task-to-move-uid"
  previous_uid: "task-that-comes-before-uid"
```

**Finding Task UIDs:**

Task UIDs are available in the entity's attributes:
1. Go to **Developer Tools** → **States**
2. Find your todo entity (e.g., `todo.tasks`)
3. Look in the `items` attribute for the `uid` field of each task

### Automations

Better ToDo integrates with Home Assistant's automation system. You can trigger automations based on:

- New tasks created (using state attribute changes)
- Tasks completed (using service calls)
- Due dates approaching
- Recurring tasks

### Lovelace Cards and Dashboards

Better ToDo automatically creates a dedicated **"Better ToDo" dashboard** when you install the integration. This dashboard appears in your sidebar and uses **JavaScript DOM injection** (inspired by View Assist) to dynamically populate native `todo-list` cards.

#### How the Dashboard Works

The Better ToDo dashboard uses an innovative approach inspired by the View Assist integration:

1. **Empty Panel Creation**: A minimal dashboard panel is created in your sidebar
2. **JavaScript Injection**: The `better-todo-panel.js` script automatically runs when you visit the dashboard
3. **Dynamic Card Generation**: Native `hui-todo-list-card` elements are injected directly into the DOM
4. **Native Functionality**: All cards use Home Assistant's built-in todo-list implementation

**Benefits:**
- ✅ No YAML configuration needed - cards are generated automatically
- ✅ Always uses the latest native todo-list card implementation
- ✅ Reliable rendering through direct DOM manipulation
- ✅ Automatically adapts when you add or remove todo lists
- ✅ Full compatibility with all Home Assistant todo features

#### Manual Dashboard Configuration

While the dashboard is automatically managed, you can still customize it:

**To edit the dashboard:**
1. Click on "Better ToDo" in your Home Assistant sidebar
2. Click the three dots menu (⋮) in the top right corner
3. Select "Edit Dashboard"
4. You can add additional cards or modify the layout

**Note:** The Better ToDo cards are injected via JavaScript, so they won't appear in the YAML editor. However, you can add other types of cards (like recurrence configuration cards) alongside them.

#### Native Todo List Card (Default - Recommended)

The standard Home Assistant todo-list card works perfectly with Better ToDo entities:

```yaml
type: todo-list
entity: todo.tasks
title: My Tasks  # Optional
```

**Features:**
- Native Home Assistant interface
- Full feature support (add, edit, delete, complete)
- Maximum compatibility and reliability
- No custom JavaScript required
- Works with all Better ToDo features including recurrence

**Note:** This is the recommended approach for the most reliable experience.

#### Custom Cards (Optional - Advanced)

For users who want enhanced visualization with category headers, custom cards are available in the `www` folder:

##### Better ToDo Dashboard Card

A custom card that groups tasks by category:

```yaml
type: custom:better-todo-dashboard-card
```

##### Better ToDo Card (Single List)

An alternative custom card to display a single todo list with custom category headers:

```yaml
type: custom:better-todo-card
entity: todo.tasks
title: My Tasks  # Optional
```

**Features:**
- Custom category headers: "No due date", "This week", "Forthcoming"
- Native "Completed" section for finished tasks
- Automatic translations (English/Spanish)
- Locale-aware week calculations

**Note:** This card requires the custom JavaScript modules to be loaded (automatically registered during installation).

#### Recurrence Configuration Card

Add a recurrence configuration card for a specific list:

```yaml
type: entities
title: Tasks - Recurrence Settings
state_color: true
entities:
  - entity: text.tasks_task_uid
    name: Task UID
  - entity: number.tasks_recurrence_interval
    name: Interval
  - entity: select.tasks_recurrence_unit
    name: Unit
  - entity: select.tasks_recurrence_end_type
    name: End Type
  - entity: number.tasks_recurrence_end_count
    name: End Count
  - entity: text.tasks_recurrence_end_date
    name: End Date
  - entity: button.tasks_apply_recurrence_settings
    name: Apply Settings
```

**Note:** Replace `tasks` with your list's slug (lowercase with underscores instead of spaces). For example, if your list is named "Shopping List", use `shopping_list`.

#### Iframe Card Example

Add external content using an iframe card:

```yaml
type: iframe
url: https://example.com/your-page
aspect_ratio: 75%
title: External Content
```

#### Standard Home Assistant Todo Card (Recommended)

Use the native Home Assistant todo card for the most reliable experience:

```yaml
type: todo-list
entity: todo.tasks
```

**This is the default and recommended approach.** The native card provides:
- Full feature support (add, edit, delete, complete tasks)
- Maximum compatibility and reliability
- No custom JavaScript dependencies
- Works seamlessly with all Better ToDo features

**Note:** Better ToDo entities are fully compatible with Home Assistant's native todo cards.

#### Complete Example Dashboard Configuration

Here's a complete example showing how to configure the Better ToDo dashboard with multiple options:

**Option 1: Native Cards (Default, Automatically Created)**

This configuration is automatically created for you:

```yaml
views:
  - title: Tasks
    path: tasks
    icon: mdi:format-list-checks
    cards:
      # Native todo-list cards (automatically added for each list)
      - type: todo-list
        entity: todo.tasks
      - type: todo-list
        entity: todo.shopping_list
```

**Option 2: Custom Cards (Optional Enhancement)**

You can manually edit the dashboard to use custom cards:

```yaml
views:
  - title: Tasks
    path: tasks
    icon: mdi:format-list-checks
    cards:
      # Custom dashboard card with all lists (optional)
      - type: custom:better-todo-dashboard-card
      
      # Recurrence configuration for Tasks list
      - type: entities
        title: Tasks - Recurrence Settings
        state_color: true
        entities:
          - entity: text.tasks_task_uid
            name: Task UID
          - entity: number.tasks_recurrence_interval
            name: Interval
          - entity: select.tasks_recurrence_unit
            name: Unit
          - entity: select.tasks_recurrence_end_type
            name: End Type
          - entity: number.tasks_recurrence_end_count
            name: End Count
          - entity: text.tasks_recurrence_end_date
            name: End Date
          - entity: button.tasks_apply_recurrence_settings
            name: Apply Settings
      
      # Add an iframe card for external content
      - type: iframe
        url: https://example.com
        aspect_ratio: 75%
        title: Additional Content
      
      # Add individual list cards
      - type: custom:better-todo-card
        entity: todo.shopping_list
        title: Shopping List
```

To use custom cards:
1. Go to the Better ToDo dashboard
2. Click the three dots menu (⋮) → "Edit Dashboard"
3. Click the three dots again → "Raw configuration editor"
4. Replace the default configuration with your custom one
5. Click "Save"

#### About JavaScript Module Registration

Better ToDo follows the same pattern as view_assist_integration for registering JavaScript modules:

- ✅ Custom cards are automatically registered in Lovelace resources
- ✅ Version management ensures cards are updated when needed
- ✅ No manual resource registration required
- ✅ Works seamlessly with Home Assistant's storage mode

#### About the Native "To-do lists" Dashboard

Better ToDo entities appear in both:
- **Better ToDo dashboard** (recommended): Uses native cards by default with optional custom enhancements
- **Native "To-do lists" dashboard**: Automatically shows all Better ToDo lists alongside other todo integrations

Both dashboards provide full functionality. The Better ToDo dashboard is recommended because it's specifically designed for Better ToDo features.

## Requirements

- Home Assistant 2024.6.0 or newer

## Support

If you encounter any issues or have feature requests:

- [Open an issue](https://github.com/Geek-MD/Better_ToDo/issues) on GitHub
- Check existing issues for solutions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  
💻 **Proudly developed with GitHub Copilot** 🚀

</div>
