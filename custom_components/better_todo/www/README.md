# Better ToDo Custom Cards

This directory contains the custom Lovelace cards for Better ToDo integration.

## Cards

### 1. Better ToDo Dashboard Card (Recommended)

The main dashboard card with a two-section layout:
- **Left section**: Shows all your Better ToDo lists
- **Right section**: Shows tasks from the selected list with category headers

This card can be manually added to the Better ToDo dashboard or any other dashboard.

```yaml
type: custom:better-todo-dashboard-card
```

### 2. Better ToDo Card

A single-list card with custom category headers.

```yaml
type: custom:better-todo-card
entity: todo.tasks
title: My Tasks  # Optional
```

## Usage

The custom cards are automatically registered when you install Better ToDo. 

### How to Add Cards to the Better ToDo Dashboard

The Better ToDo dashboard is created empty by default. To add cards:

1. Navigate to the "Better ToDo" dashboard in your sidebar
2. Click the three dots menu (⋮) in the top right corner
3. Select "Edit Dashboard"
4. Click "+ ADD CARD" to add cards via UI

**Or use YAML configuration:**

1. Click the three dots menu (⋮) → "Edit Dashboard"
2. Click the three dots again → "Raw configuration editor"
3. Add your card configuration (see examples below)
4. Click "Save"

### Example: Complete Dashboard Configuration

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
      
      # Add individual list cards if preferred
      - type: custom:better-todo-card
        entity: todo.shopping_list
        title: Shopping List
```

### Example: Adding an Iframe Card

You can add external content using an iframe card:

```yaml
type: iframe
url: https://example.com/your-page
aspect_ratio: 75%
title: External Content
```

### Example: Multiple List Cards

Show each list separately with individual cards:

```yaml
views:
  - title: Tasks
    path: tasks
    icon: mdi:format-list-checks
    cards:
      - type: custom:better-todo-card
        entity: todo.tasks
        title: Personal Tasks
      
      - type: custom:better-todo-card
        entity: todo.shopping_list
        title: Shopping List
      
      - type: custom:better-todo-card
        entity: todo.work_tasks
        title: Work Tasks
```

### Better ToDo Dashboard Card Features

- **Two-section layout**: Lists on the left, tasks on the right
- **List selection**: Click on a list to view its tasks
- **Task count**: Shows number of active tasks per list
- **Category headers**: Groups tasks into "No due date", "This week", "Forthcoming", and "Completed"
- **Native HA styling**: Uses Home Assistant's native components for consistent look and feel
- **Multilingual support**: Automatic translation based on HA's language setting (English/Spanish)

### Better ToDo Card Features

The Better ToDo Card provides:
- **Custom Category Headers**: Groups tasks into "No due date", "This week", and "Forthcoming"
- **Native HA Styling**: Uses Home Assistant's native components for consistent look and feel
- **Multilingual Support**: Automatic translation based on HA's language setting (English/Spanish)
- **Week Calculation**: Respects locale settings (Monday vs Sunday week start)

### Categories

1. **No due date / Sin fecha de vencimiento**: Tasks without a due date
2. **This week / Esta semana**: Tasks due within the current week
3. **Forthcoming / Próximamente**: Tasks due after this week
4. **Completed / Completadas**: Completed tasks (uses HA's native section)

### Differences from Standard Todo Card

The standard Home Assistant todo-list card shows:
- **Active**: All incomplete tasks
- **Completed**: All complete tasks

The Better ToDo Cards enhance this by:
- Subdividing "Active" tasks into meaningful categories based on due dates
- Maintaining the native "Completed" section for finished tasks
- Using the same HTML structure as HA's native card for perfect integration
- (Dashboard card) Showing all lists in one view with easy switching

## Development

The cards are built as vanilla JavaScript custom elements that use Home Assistant's web components:
- `ha-card`: Main card container
- `ha-check-list-item`: Todo item container
- `ha-checkbox`: Checkbox element
- `ha-icon`: Icon element

This ensures perfect styling consistency with Home Assistant's design system.
