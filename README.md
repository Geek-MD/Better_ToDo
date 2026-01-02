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

### Managing Tasks

Once configured, your Better ToDo lists will appear in the ToDo section of Home Assistant. You can:

- **Create tasks**: Add new items to your list
- **Edit tasks**: Update task details, descriptions, and due dates
- **Complete tasks**: Mark tasks as done
- **Delete tasks**: Remove completed or unwanted tasks
- **Reorder tasks**: Drag and drop to organize your tasks

#### Automatic Task Organization

Tasks are automatically organized into groups for better visibility:

- 📭 **No due date**: Tasks without a due date
- 📅 **This week**: Tasks due within the current calendar week (respects your locale settings - Monday start for Spanish/European locales, Sunday start for US English)
- 📆 **Forthcoming**: Tasks due after this week
- ✅ **Done**: Completed tasks

Tasks within each group are sorted by due date (earliest first).

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

### Lovelace Cards

Use the native Home Assistant ToDo card to display your lists:

```yaml
type: todo-list
entity: todo.my_list_name
```

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
