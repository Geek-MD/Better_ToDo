[![Geek-MD - Better To-do](https://img.shields.io/static/v1?label=Geek-MD&message=Better%20To-do&color=blue&logo=github)](https://github.com/Geek-MD/Better_ToDo)
[![Stars](https://img.shields.io/github/stars/Geek-MD/Better_ToDo?style=social)](https://github.com/Geek-MD/Better_ToDo)
[![Forks](https://img.shields.io/github/forks/Geek-MD/Better_ToDo?style=social)](https://github.com/Geek-MD/Better_ToDo)

[![GitHub Release](https://img.shields.io/github/release/Geek-MD/Better_ToDo?include_prereleases&sort=semver&color=blue)](https://github.com/Geek-MD/Better_ToDo/releases)
[![License](https://img.shields.io/badge/License-MIT-blue)](https://github.com/Geek-MD/Better_ToDo/blob/main/LICENSE)
[![HACS Custom Repository](https://img.shields.io/badge/HACS-Custom%20Repository-blue)](https://hacs.xyz/)

[![Ruff + Mypy + Hassfest](https://github.com/Geek-MD/Better_ToDo/actions/workflows/ci.yaml/badge.svg)](https://github.com/Geek-MD/Better_ToDo/actions/workflows/ci.yaml)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![Checked with mypy](https://www.mypy-lang.org/static/mypy_badge.svg)](https://mypy-lang.org/)

<img width="200" height="200" alt="image" src="https://github.com/Geek-MD/Better_ToDo/blob/main/custom_components/better_todo/brand/icon.png?raw=true" />

# Better To-do

A custom Home Assistant integration that provides a **local, file-based to-do list** with advanced task management features – most notably **recurring tasks** based on iCalendar RRULE intervals.

It is built on the same foundation as the built-in [Local To-do](https://www.home-assistant.io/integrations/local_todo) integration but extends it with a native recurrence engine: when a recurring task is marked completed it automatically advances to its next scheduled occurrence rather than disappearing.

---

## Features

- **Custom sidebar panel** – a dedicated *Better ToDo* panel accessible from the HA sidebar at `/better-todo`, built with the same two-pane layout as the built-in To-do panel. Content will be expanded in future releases.
- **Full to-do list entity** – integrates natively with the Home Assistant [To-do list dashboard card](https://www.home-assistant.io/dashboards/todo-list/) and all built-in `todo.*` services.
- **Recurring tasks (RRULE)** – attach any iCalendar RRULE string to a task (e.g. `FREQ=WEEKLY;BYDAY=MO`, `FREQ=DAILY`, `FREQ=MONTHLY;BYMONTHDAY=1`). When the task is marked done it rolls forward to the next occurrence automatically.
- **`better_todo.set_task_recurrence` service** – set or clear the RRULE on a task by its UID from an automation, script, or *Developer Tools → Actions*.
- **`task_recurrence` attribute** – the entity exposes a `{uid: rrule_string}` dictionary so custom Lovelace cards and automations can read per-task recurrence rules.
- **`better_todo.set_task_details` service** – attach structured metadata tags (`quantity`, `unit`, `category`, `repeat`, plus free-text notes) to any task. Data is encoded in the standard `description` field and is immediately visible in the HA Tasks panel without a custom card.
- **`task_details` attribute** – the entity exposes a `{uid: {quantity, unit, category, repeat}}` dictionary so automations and scripts can read per-task metadata.
- **Default `Shopping List`** – a `todo.shopping_list` entity is created automatically on first setup, separate from any custom lists you create. Shopping List items support only a **description** field (no due date), matching typical shopping-list behaviour. Its visible name is localized using your Home Assistant language (e.g. Spanish: *Lista de la compra*).
- **Local iCalendar storage** – each list is persisted as a `.ics` file in the Home Assistant `.storage` directory; no cloud, no external services.
- **Config-flow setup** – configure entirely through the UI; no YAML needed.
- **Multiple lists** – add as many Better To-do lists as you need, each stored in its own file.
- **Multilingual UI** – English (default), Spanish, Portuguese, French, and German.
- **HACS-compatible**.

---

## Requirements

| Requirement | Minimum version |
|-------------|----------------|
| Home Assistant | 2024.11.0 |
| HACS | 1.6.0 |

---

## Installation

### Via HACS (recommended)

1. Open HACS → **Integrations**.
2. Click the three-dot menu → **Custom repositories**.
3. Add `https://github.com/Geek-MD/Better_ToDo` with category **Integration**.
4. Search for **Better To-do** and click **Download**.
5. Restart Home Assistant.

### Manual

1. Copy the `custom_components/better_todo` directory into your `<config>/custom_components/` folder.
2. Restart Home Assistant.

---

## Configuration

1. Go to **Settings → Devices & Services → Add Integration**.
2. Search for **Better To-do**.
3. Enter a **name** for your to-do list (e.g. `Shopping`, `Chores`).
4. Click **Submit**. The integration creates your named `todo.<name>` entity backed by a `.ics` file in `.storage/`.

On the **first setup**, a built-in **Shopping List** (`todo.shopping_list`) is also created automatically and is independent from the list name you entered. Subsequent setups only create the new custom list you name.

You can add multiple custom lists by repeating the setup process. Removing an integration entry deletes its associated `.ics` file from `.storage/`.

---

## Entities

| Entity | Domain | Description |
|--------|--------|-------------|
| `todo.<name>` | `todo` | The to-do list. Displays all tasks, supports create / update / delete / reorder from the UI. |
| `todo.shopping_list` | `todo` | Built-in Shopping List created automatically on first setup. Items support only a **description** (no due date). |

### State attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `task_recurrence` | `dict` | Maps each task UID to its RRULE string. Only present when at least one task has a recurrence rule set. |
| `task_details` | `dict` | Maps each task UID to a `{quantity, category}` dict. Only present when at least one task has structured details set via `set_task_details`. |

---

## Shopping List

The built-in **Shopping List** (`todo.shopping_list`) is automatically created on the first setup and is completely independent from any custom lists you add later. It is designed for day-to-day grocery and shopping management:

- Items have a **description** field only — no due date is offered in the UI.
- All CRUD operations (create, update, delete, reorder) and the `set_task_details` service work the same as on any other list.
- The `set_task_recurrence` service is also available if needed, but recurring shopping items are uncommon.

---

## Recurring tasks

Recurrence is powered by the [iCalendar RRULE standard](https://icalendar.org/iCalendar-RFC-5545/3-8-5-3-recurrence-rule.html) via the `ical` Python library.

### Setting a recurrence rule

Use the `better_todo.set_task_recurrence` service:

```yaml
action: better_todo.set_task_recurrence
target:
  entity_id: todo.chores
data:
  item: "abc123-uid-of-the-task"
  rrule: "FREQ=WEEKLY;BYDAY=MO"
```

To **remove** recurrence from a task, omit `rrule` or set it to an empty string:

```yaml
action: better_todo.set_task_recurrence
target:
  entity_id: todo.chores
data:
  item: "abc123-uid-of-the-task"
  rrule: ""
```

### How auto-advance works

When a task that has an RRULE is marked **completed** (via the UI or the `todo.update_item` service):

1. The integration calculates the **next occurrence** from the RRULE.
2. The task's due date is updated to that next date.
3. The task status is reset to **Needs Action**.

The task never disappears from the list – it simply moves its due date forward, giving a natural rolling reminder.

If the RRULE has no more future occurrences (e.g. `COUNT=3` has been exhausted) the task is marked completed normally.

### RRULE examples

| Rule | Meaning |
|------|---------|
| `FREQ=DAILY` | Every day |
| `FREQ=WEEKLY;BYDAY=MO` | Every Monday |
| `FREQ=WEEKLY;BYDAY=MO,WE,FR` | Every Mon, Wed, Fri |
| `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO` | Every other Monday |
| `FREQ=MONTHLY;BYMONTHDAY=1` | First day of every month |
| `FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1` | Every 1 January |
| `FREQ=DAILY;COUNT=5` | 5 times, then stops |
| `FREQ=DAILY;UNTIL=20271231` | Daily until 31 Dec 2027 |

---

## Services

### `better_todo.set_task_recurrence`

Sets or clears the iCalendar RRULE recurrence rule on a specific task.

| Field | Required | Description |
|-------|----------|-------------|
| `item` | ✅ | The UID of the task to update. Find it in the `task_recurrence` attribute or via Developer Tools. |
| `rrule` | ❌ | RRULE string (e.g. `FREQ=WEEKLY;BYDAY=MO`). Omit or leave blank to remove recurrence. |

**Target**: a `todo` entity from the `better_todo` integration.

### `better_todo.set_task_details`

Attaches structured metadata tags (quantity, unit, category, repeat, and/or free-text notes) to a specific task. The data is encoded in the task's `description` field in a human-readable format.

| Field | Required | Description |
|-------|----------|-------------|
| `item` | ✅ | The UID of the task to update. |
| `quantity` | ❌ | Value for `[quantity:*]` (e.g. `2`). You can still pass `2 kg`; `unit` is auto-split when possible. Omit to leave the existing value unchanged. |
| `unit` | ❌ | Value for `[unit:*]` (e.g. `kg`). Omit to leave the existing value unchanged. |
| `category` | ❌ | Value for `[category:*]` (e.g. `Dairy`, `Meat`). Omit to leave the existing value unchanged. |
| `notes` | ❌ | Free-text notes to store alongside the structured metadata. Omit to leave the existing value unchanged. |

**Target**: a `todo` entity from the `better_todo` integration.

```yaml
action: better_todo.set_task_details
target:
  entity_id: todo.shopping_list
data:
  item: "abc123-uid-of-the-task"
  quantity: "2"
  unit: "kg"
  category: "Meat"
  notes: "Pick up at the corner shop"
```

The resulting `description` stored in the task will be:

```
[quantity:2] [unit:kg] [category:Meat]

Pick up at the corner shop
```

---

## Automations example

```yaml
# Automatically set a weekly recurrence on a newly-created task named "Weekly review"
automation:
  - alias: "Set weekly recurrence on Weekly review task"
    trigger:
      - platform: state
        entity_id: todo.chores
    condition:
      - condition: template
        value_template: >
          {{ trigger.to_state.attributes.todo_items | selectattr('summary', 'eq', 'Weekly review')
             | list | count > 0 }}
    action:
      - variables:
          uid: >
            {{ (trigger.to_state.attributes.todo_items
                | selectattr('summary', 'eq', 'Weekly review')
                | list | first).uid }}
      - action: better_todo.set_task_recurrence
        target:
          entity_id: todo.chores
        data:
          item: "{{ uid }}"
          rrule: "FREQ=WEEKLY;BYDAY=MO"
```

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

💻 **Proudly developed with GitHub Copilot** 🚀

</div>
