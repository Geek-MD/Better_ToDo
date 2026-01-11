# Better ToDo Simple Card - YAML Testing Example

This document provides the YAML configuration to test the new Better ToDo Simple Card with the v0.11.0 panel.

## About the Simple Card

The **Better ToDo Simple Card** is designed to replicate the functionality of Home Assistant's Local Todo:
- Clean, simple interface
- Add items quickly with inline input
- Active and Completed sections
- Checkbox to mark tasks complete
- Click on tasks to edit them
- Shows due dates and descriptions

## Prerequisites

- Better ToDo v0.11.0 installed and running
- At least one Better ToDo list configured (e.g., "Tasks" or "Shopping List")

## Current Panel Configuration

The Better ToDo panel currently has this YAML structure:

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards: []
```

Note the **empty cards array** - this is where we'll add our Simple Card for testing.

## How to Add the Card to the Panel

### Option 1: Using the UI (Recommended for Testing)

1. Navigate to the **Better ToDo** panel in your Home Assistant sidebar
2. Click the **three dots menu (⋮)** in the top right corner
3. Select **"Edit Dashboard"**
4. Click **"+ ADD CARD"**
5. Scroll down and select **"Manual"** or **"Custom: Better ToDo Simple Card"**
6. If using Manual, paste the YAML below:

```yaml
type: custom:better-todo-simple-card
entity: better_todo.tasks
```

7. Click **"Save"**
8. Click **"Done"** to exit edit mode

### Option 2: Using Raw Configuration Editor (Fastest for Testing)

1. Navigate to the **Better ToDo** panel in your Home Assistant sidebar
2. Click the **three dots menu (⋮)** → **"Edit Dashboard"**
3. Click the **three dots** again → **"Raw configuration editor"**
4. Replace the **empty cards array** with the examples below
5. Click **"Save"**

## YAML Examples for Testing with v0.11.0

### Example 1: Single Task List (Simplest - Start Here!)

Replace the empty `cards: []` array with:

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
```

### Example 2: Tasks + Shopping List

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
        title: Personal Tasks
      
      - type: custom:better-todo-simple-card
        entity: better_todo.shopping_list
        title: Shopping List
```

### Example 3: All Lists with Custom Titles

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
        title: 📋 Personal Tasks
      
      - type: custom:better-todo-simple-card
        entity: better_todo.shopping_list
        title: 🛒 Shopping List
      
      - type: custom:better-todo-simple-card
        entity: better_todo.work_tasks
        title: 💼 Work Tasks
```

### Example 4: Grid Layout (2 Columns)

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: grid
        square: false
        columns: 2
        cards:
          - type: custom:better-todo-simple-card
            entity: better_todo.tasks
            title: Tasks
          
          - type: custom:better-todo-simple-card
            entity: better_todo.shopping_list
            title: Shopping
```

### Example 5: Vertical Stack with Sections

```yaml
views:
  - title: Better ToDo
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: markdown
        content: "## 📝 My Todo Lists"
      
      - type: custom:better-todo-simple-card
        entity: better_todo.tasks
      
      - type: markdown
        content: "---"
      
      - type: custom:better-todo-simple-card
        entity: better_todo.shopping_list
```

## Card Features

### 1. Quick Add
- Type a task name in the input field
- Press Enter or click the + button
- Task is immediately added to your list

### 2. Task Management
- **Check/Uncheck**: Click the checkbox to mark tasks complete or reopen them
- **Edit**: Click anywhere on a task (except the checkbox) to edit it
- **View Details**: Due dates and descriptions are displayed below the task name

### 3. Sections
- **Active**: Shows all incomplete tasks
- **Completed**: Shows all completed tasks (can be unchecked to reopen)

### 4. Visual Feedback
- Completed tasks show with strikethrough text
- Hover effects on tasks
- Color-coded due dates
- Responsive design

## Entity Names

Your Better ToDo entities will be named based on the list names you configured:

- `better_todo.tasks` - Tasks list
- `better_todo.shopping_list` - Shopping List
- `better_todo.work_tasks` - Work Tasks list
- etc.

To find your exact entity names:
1. Go to **Developer Tools** → **States**
2. Search for `better_todo`
3. Use the exact entity ID in your card configuration

## Troubleshooting

### Card Not Appearing
- Make sure you've saved the dashboard configuration
- Refresh your browser (Ctrl+F5 or Cmd+Shift+R)
- Check that the entity name is correct in Developer Tools → States

### "Entity not found" Error
- Verify the entity ID exists in Developer Tools → States
- Check for typos in the entity name
- Make sure Better ToDo integration is properly configured

### Card Shows Empty
- Check that you have at least one Better ToDo list configured
- Try adding a task using the Services tool first:
  ```yaml
  service: better_todo.create_task
  data:
    entity_id: better_todo.tasks
    summary: Test Task
  ```

### Services Not Working
- Make sure Better ToDo integration is running
- Check Home Assistant logs for errors
- Restart Home Assistant if needed

## Comparison with Other Cards

| Feature | Simple Card | Dashboard Card | List Card |
|---------|------------|----------------|-----------|
| Quick Add | ✅ Yes | ✅ Yes | ✅ Yes |
| Active/Completed | ✅ Yes | ✅ Yes | ✅ Yes |
| Category Headers | ❌ No | ✅ Yes | ✅ Yes |
| List Navigation | ❌ No | ✅ Yes | ❌ No |
| Recurrence Dialog | ❌ No | ✅ Yes | ✅ Yes |
| Local Todo Style | ✅ **Yes** | ❌ No | ❌ No |

The **Simple Card** is designed specifically to replicate Local Todo's clean, straightforward interface, making it perfect for users who want a familiar experience.

## Next Steps

After testing the Simple Card with v0.11.0:

1. ✅ Verify that the card loads correctly
2. ✅ Test adding new tasks
3. ✅ Test checking/unchecking tasks
4. ✅ Test editing tasks by clicking on them
5. ✅ Verify that tasks persist after page refresh
6. ✅ Check that the card works with multiple lists

If everything works as expected, the card can be integrated into the automatic panel setup in future versions!

## Support

If you encounter any issues:
- Check the [GitHub Issues](https://github.com/Geek-MD/Better_ToDo/issues)
- Review the Home Assistant logs
- Open a new issue with details about your configuration

---

**Version**: 1.0.0  
**Compatible with**: Better ToDo v0.11.0+  
**Last Updated**: 2026-01-11
