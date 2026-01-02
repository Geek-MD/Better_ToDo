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

After installation, Better ToDo automatically creates a dedicated dashboard named **"Better ToDo"** in your sidebar. This is the recommended way to access your todo lists.

**The Better ToDo dashboard includes:**
- All your todo lists with custom category headers
- Professional, emoji-free appearance
- Recurrence configuration for each list
- Automatic organization by: No due date, This week, Forthcoming, Completed

**Note about the native "To-do lists" dashboard:**
Home Assistant automatically creates a "To-do lists" dashboard when TODO entities exist. Your Better ToDo lists will appear there too, but for the best experience with custom category headers, **use the "Better ToDo" dashboard** instead.

To hide the native "To-do lists" dashboard:
1. Go to **Settings** → **Dashboards**
2. Find **"To-do lists"**
3. Click the three dots (⋮) → **Hide from sidebar**

### Managing Tasks

Once configured, you can manage your tasks from the Better ToDo dashboard:

- **Create tasks**: Add new items to your list
- **Edit tasks**: Update task details, descriptions, and due dates
- **Complete tasks**: Mark tasks as done
- **Delete tasks**: Remove completed or unwanted tasks
- **Reorder tasks**: Drag and drop to organize your tasks

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

### Automations

Better ToDo integrates with Home Assistant's automation system. You can trigger automations based on:

- New tasks created
- Tasks completed
- Due dates approaching
- Recurring tasks

### Lovelace Cards and Dashboards

Better ToDo automatically creates a dedicated **"Better ToDo" dashboard** when you install the integration. This dashboard appears in your sidebar and includes:
- All your Better ToDo lists with custom cards
- Category headers: "No due date", "This week", "Forthcoming", "Completed"
- Recurrence configuration cards for each list

**Recommended:** Use the "Better ToDo" dashboard for the best experience.

#### Better ToDo Dashboard (Automatically Created - v0.4.3+)

The integration automatically creates a dashboard named "Better ToDo" in your sidebar with all your lists using custom cards.

**To access:**
1. Look for "Better ToDo" in your Home Assistant sidebar
2. All your todo lists will be displayed with professional category headers
3. No emoticons - clean, professional appearance

#### About the Native "To-do lists" Dashboard

**Note:** Home Assistant automatically creates a native "To-do lists" dashboard when TODO entities exist. Better ToDo entities will appear there too, but **we recommend using the "Better ToDo" dashboard** instead for the enhanced experience with custom category headers.

If you want to hide the native "To-do lists" dashboard:
1. Go to Settings → Dashboards
2. Find "To-do lists" dashboard
3. Click the three dots menu → Hide from sidebar

#### Manual Card Configuration

You can also manually add the custom Better ToDo card to any dashboard:

```yaml
type: custom:better-todo-card
entity: todo.tasks
title: My Tasks  # Optional
```

**Features:**
- Custom category headers: "No due date", "This week", "Forthcoming"
- Native "Completed" section for finished tasks
- Uses Home Assistant's native web components for perfect styling
- Automatic translations (English/Spanish)
- Locale-aware week calculations

#### Standard Home Assistant Card

You can also use the native Home Assistant ToDo card (not recommended):

```yaml
type: todo-list
entity: todo.my_list_name
```

**Note:** The standard card will show HA's default "Active" and "Completed" headers without the custom category organization.

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
