# Better ToDo Custom Card

This directory contains the custom Lovelace card for Better ToDo integration.

## Usage

The custom card is automatically registered when you install Better ToDo. To use it:

### Manual Card Configuration

Add the card to your dashboard:

```yaml
type: custom:better-todo-card
entity: todo.tasks
title: My Tasks  # Optional
```

### Card Features

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

The Better ToDo Card enhances this by:
- Subdividing "Active" tasks into meaningful categories based on due dates
- Maintaining the native "Completed" section for finished tasks
- Using the same HTML structure as HA's native card for perfect integration

## Development

The card is built as a vanilla JavaScript custom element that uses Home Assistant's web components:
- `ha-card`: Main card container
- `ha-check-list-item`: Todo item container
- `ha-checkbox`: Checkbox element

This ensures perfect styling consistency with Home Assistant's design system.
