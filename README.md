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

After installation, Better ToDo automatically creates a dedicated dashboard named **"Better ToDo"** in your sidebar. The dashboard is **empty by default**, allowing you to customize it with your preferred cards and layout.

**To customize the dashboard:**
1. Navigate to the "Better ToDo" dashboard in your sidebar
2. Click the three dots menu (⋮) in the top right corner
3. Select "Edit Dashboard"
4. Add cards manually using the UI or YAML configuration

See the [Manual Dashboard Configuration](#manual-dashboard-configuration) section below for detailed examples.

**Important Note (v0.5.0+):**
Better ToDo no longer uses Home Assistant's core Todo platform. This means:
- ✅ Better ToDo tasks are **independent** and managed exclusively through the Better ToDo dashboard
- ✅ Tasks **do NOT appear** in Home Assistant's native "To-do lists" dashboard
- ✅ Full control over task management without interference from core HA features
- ℹ️ All task operations (create, update, delete, move) are handled via Better ToDo services

### Managing Tasks

Once configured, you can manage your tasks from the Better ToDo dashboard or via services:

**Via Dashboard:**
- **Create tasks**: Add new items to your list using the custom card interface
- **Edit tasks**: Update task details, descriptions, and due dates
- **Complete tasks**: Mark tasks as done
- **Delete tasks**: Remove completed or unwanted tasks
- **Reorder tasks**: Drag and drop to organize your tasks (when supported by custom card)

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

Better ToDo offers two ways to configure recurring tasks:

#### Option 1: Using Helper Entities (Recommended)

Each todo list comes with helper entities for easy recurrence configuration:

1. Find the recurrence helper entities for your list in **Settings** → **Devices & Services** → **Better ToDo** → Your List Device
2. Set the values:
   - **Task UID**: Enter the UID of the task (find it in entity attributes)
   - **Recurrence interval**: How often to repeat (1-365)
   - **Recurrence unit**: Time unit (days/months/years)
   - **Recurrence end type**: Choose never, count, or date
   - **Recurrence end count**: Number of repetitions (if using count)
   - **Recurrence end date**: End date (if using date)
3. Press the **Apply recurrence settings** button

#### Option 2: Using Services (Advanced)

For automation or advanced use, configure recurrence via services:

1. Go to **Developer Tools** → **Services**
2. Select the service `better_todo.set_task_recurrence`
3. Configure the recurrence settings:
   - **Entity ID**: Your todo list entity (e.g., `todo.tasks`)
   - **Task UID**: The unique identifier of the task (visible in entity attributes)
   - **Enable recurrence**: Turn on/off recurrence
   - **Recurrence interval**: How often to repeat (e.g., 1, 2, 3)
   - **Recurrence unit**: Time unit (days, months, years)
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

Better ToDo automatically creates a dedicated **"Better ToDo" dashboard** when you install the integration. This dashboard appears in your sidebar and is **empty by default**, allowing you to customize it with your preferred layout.

#### Manual Dashboard Configuration

The Better ToDo dashboard is created empty to give you full control over its content. You can add any cards you want, including:
- Better ToDo custom cards
- Native Home Assistant cards
- Iframe cards for external content
- Any other Lovelace card

**To edit the dashboard:**
1. Click on "Better ToDo" in your Home Assistant sidebar
2. Click the three dots menu (⋮) in the top right corner
3. Select "Edit Dashboard"
4. Click "+ ADD CARD" to add cards via UI, or click the three dots again and select "Raw configuration editor" to edit YAML directly

#### Better ToDo Dashboard Card (Two-Section Layout)

The main dashboard card displays all your lists on the left and tasks on the right:

```yaml
type: custom:better-todo-dashboard-card
```

**Features:**
- Two-section layout: Lists on the left, tasks on the right
- Click a list to view its tasks
- Task count per list
- Category headers: "No due date", "This week", "Forthcoming", "Completed"
- Automatic translations (English/Spanish)

#### Better ToDo Card (Single List)

Display a single todo list with custom category headers:

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

**Note:** Replace `tasks` with your list's slug (lowercase with underscores instead of spaces).

#### Iframe Card Example

Add external content using an iframe card:

```yaml
type: iframe
url: https://example.com/your-page
aspect_ratio: 75%
title: External Content
```

#### Standard Home Assistant Todo Card

Use the native Home Assistant todo card (shows "Active" and "Completed" sections):

```yaml
type: todo-list
entity: todo.tasks
```

**Note:** The standard card doesn't include the custom category headers.

#### Complete Example Dashboard Configuration

Here's a complete example showing how to configure the Better ToDo dashboard with multiple cards:

```yaml
views:
  - title: Tasks
    path: tasks
    icon: mdi:format-list-checks
    cards:
      # Main dashboard card with all lists
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

To use this configuration:
1. Go to the Better ToDo dashboard
2. Click the three dots menu (⋮) → "Edit Dashboard"
3. Click the three dots again → "Raw configuration editor"
4. Paste the configuration above
5. Click "Save"

#### About the Native "To-do lists" Dashboard

**Note:** Home Assistant automatically creates a native "To-do lists" dashboard when TODO entities exist. Better ToDo entities will appear there too, but **we recommend using the "Better ToDo" dashboard** instead for the enhanced experience with custom category headers.

If you want to hide the native "To-do lists" dashboard:
1. Go to Settings → Dashboards
2. Find "To-do lists" dashboard
3. Click the three dots menu → Hide from sidebar

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
