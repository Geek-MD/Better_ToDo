[![Geek-MD - Better To-do](https://img.shields.io/static/v1?label=Geek-MD&message=Better%20To-do&color=blue&logo=github)](https://github.com/Geek-MD/Better_ToDo)
[![Stars](https://img.shields.io/github/stars/Geek-MD/Better_ToDo?style=social)](https://github.com/Geek-MD/Better_ToDo)
[![Forks](https://img.shields.io/github/forks/Geek-MD/Better_ToDo?style=social)](https://github.com/Geek-MD/Better_ToDo)

[![GitHub Release](https://img.shields.io/github/release/Geek-MD/Better_ToDo?include_prereleases&sort=semver&color=blue)](https://github.com/Geek-MD/Better_ToDo/releases)
[![License](https://img.shields.io/badge/License-MIT-blue)](https://github.com/Geek-MD/Better_ToDo/blob/main/LICENSE)
[![HACS Custom Repository](https://img.shields.io/badge/HACS-Custom%20Repository-blue)](https://hacs.xyz/)

[![Ruff + Mypy + Hassfest](https://github.com/Geek-MD/Better_ToDo/actions/workflows/ci.yaml/badge.svg)](https://github.com/Geek-MD/Better_ToDo/actions/workflows/ci.yaml)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)
[![Checked with mypy](https://www.mypy-lang.org/static/mypy_badge.svg)](https://mypy-lang.org/)

# Better To-do

A custom Home Assistant integration that provides a **local, file-based to-do list** with advanced task management features – most notably **recurring tasks** based on iCalendar RRULE intervals.

It is built on the same foundation as the built-in [Local To-do](https://www.home-assistant.io/integrations/local_todo) integration but extends it with a native recurrence engine: when a recurring task is marked completed it automatically advances to its next scheduled occurrence rather than disappearing.

---

## Features

- **Full to-do list entity** – integrates natively with the Home Assistant [To-do list dashboard card](https://www.home-assistant.io/dashboards/todo-list/) and all built-in `todo.*` services.
- **Recurring tasks (RRULE)** – attach any iCalendar RRULE string to a task (e.g. `FREQ=WEEKLY;BYDAY=MO`, `FREQ=DAILY`, `FREQ=MONTHLY;BYMONTHDAY=1`). When the task is marked done it rolls forward to the next occurrence automatically.
- **`better_todo.set_task_recurrence` service** – set or clear the RRULE on a task by its UID from an automation, script, or *Developer Tools → Actions*.
- **`task_recurrence` attribute** – the entity exposes a `{uid: rrule_string}` dictionary so custom Lovelace cards and automations can read per-task recurrence rules.
- **Local iCalendar storage** – each list is persisted as a `.ics` file in the Home Assistant `.storage` directory; no cloud, no external services.
- **Config-flow setup** – configure entirely through the UI; no YAML needed.
- **Multiple lists** – add as many Better To-do lists as you need, each stored in its own file.
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
4. Click **Submit**. The integration creates a new `todo.<name>` entity backed by a `.ics` file in `.storage/`.

You can add multiple lists by repeating the process.

---

## Entities

| Entity | Domain | Description |
|--------|--------|-------------|
| `todo.<name>` | `todo` | The to-do list. Displays all tasks, supports create / update / delete / reorder from the UI. |

### State attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `task_recurrence` | `dict` | Maps each task UID to its RRULE string. Only present when at least one task has a recurrence rule set. |

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
| `FREQ=DAILY;UNTIL=20251231` | Daily until 31 Dec 2025 |

---

## Services

### `better_todo.set_task_recurrence`

Sets or clears the iCalendar RRULE recurrence rule on a specific task.

| Field | Required | Description |
|-------|----------|-------------|
| `item` | ✅ | The UID of the task to update. Find it in the `task_recurrence` attribute or via Developer Tools. |
| `rrule` | ❌ | RRULE string (e.g. `FREQ=WEEKLY;BYDAY=MO`). Omit or leave blank to remove recurrence. |

**Target**: a `todo` entity from the `better_todo` integration.

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