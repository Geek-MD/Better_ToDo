# Better ToDo

A Home Assistant custom integration for advanced ToDo list management.

## Features

- ✅ **Full ToDo List Support**: Create, update, delete, and move tasks
- 📅 **Due Date Management**: Set and track due dates for your tasks
- 📝 **Rich Descriptions**: Add detailed descriptions to your tasks
- 🔄 **Task Reordering**: Organize tasks in your preferred order
- 🎯 **Multiple Lists**: Create multiple independent ToDo lists
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
   - Enter a name for your ToDo list
5. Click **Submit**

### Creating Multiple Lists

You can create multiple ToDo lists by adding the integration multiple times with different names.

## Usage

### Managing Tasks

Once configured, your Better ToDo lists will appear in the ToDo section of Home Assistant. You can:

- **Create tasks**: Add new items to your list
- **Edit tasks**: Update task details, descriptions, and due dates
- **Complete tasks**: Mark tasks as done
- **Delete tasks**: Remove completed or unwanted tasks
- **Reorder tasks**: Drag and drop to organize your tasks

### Automations

Better ToDo integrates with Home Assistant's automation system. You can trigger automations based on:

- New tasks created
- Tasks completed
- Due dates approaching

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
