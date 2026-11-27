import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL(
  "../custom_components/better_todo/frontend/better-todo-panel.js", import.meta.url
), "utf8");

class HTMLElement {}
class LitElement extends HTMLElement {
  static ["_$litElement$"] = true;
  dispatchEvent() {}
}

function loadPanel(globals = {}) {
  const legacy = class extends LitElement {};
  const elements = new Map([
    ["ha-card", class extends LitElement {}],
    ["better-todo-panel", legacy],
    ["better-todo-task-dialog", legacy],
    ["better-todo-panel-v080", legacy],
  ]);
  runInNewContext(source, {
    HTMLElement,
    CustomEvent: class {},
    ResizeObserver: class {},
    customElements: {
      get: (tag) => elements.get(tag),
      define(tag, constructor) {
        assert.ok(!elements.has(tag), `${tag} was already registered`);
        elements.set(tag, constructor);
      },
    },
    ...globals,
  });
  assert.equal(elements.get("better-todo-panel"), legacy);
  assert.ok(elements.has("better-todo-panel-v091"));
  return elements;
}

test("only Better ToDo task lists offer assignment, even without state attributes", () => {
  const elements = loadPanel();
  const list = new (elements.get("better-todo-task-list-v091"))();
  list.hass = {
    states: { "todo.home": { attributes: {} } },
    entities: {
      "todo.home": { platform: "better_todo" },
      "todo.shopping": { platform: "better_todo", translation_key: "shopping_list" },
      "todo.external": { platform: "local_todo" },
    },
  };
  list.entityId = "todo.home";
  assert.equal(list._supportsAssignment, true);
  list.entityId = "todo.shopping";
  assert.equal(list._supportsAssignment, false);
  list.entityId = "todo.external";
  assert.equal(list._supportsAssignment, false);
});

function renderContent(part) {
  if (Array.isArray(part)) return part.map(renderContent).join("");
  if (!part?.strings) return typeof part === "string" || typeof part === "number" ? String(part) : "";
  return part.strings.reduce((text, fragment, index) =>
    text + fragment + renderContent(part.values[index]), "");
}

test("deadline sections and list progress use the same local seven-day window", () => {
  let now = Date.parse("2026-11-26T23:59:30-03:00");
  class Clock extends Date {
    static now() { return now; }
  }
  const elements = loadPanel({ Date: Clock });
  const list = new (elements.get("better-todo-task-list-v091"))();
  list.entityId = "todo.home";
  list.hass = {
    locale: { language: "es", time_zone: "server" },
    localize: () => "",
    config: { time_zone: "America/Santiago" },
    states: { "todo.home": { entity_id: "todo.home", attributes: { task_assignees: { upcoming: "ana" } } } },
  };
  const task = (uid, due, status = "needs_action") => ({ uid, summary: uid, due, status });
  const dueToday = task("DateOnlyToday", "2026-11-26");
  list._items = [
    task("NoDue"), task("InvalidDue", "2026-02-30"),
    task("OverdueTimed", "2026-11-27T02:59:00Z"),
    task("ExactDeadline", "2026-11-27T02:59:30Z"),
    dueToday, task("upcoming", "2026-12-03"),
    task("DayEight", "2026-12-04"),
    task("OldCompleted", "2026-01-01", "completed"),
    task("CompletedEarly", "2026-12-04", "completed"),
  ];
  list._users = [{ id: "ana", name: "Ana" }];
  list._loading = false;
  const content = renderContent(list.render());
  assert.match(content, /1 de 7 completadas/);
  assert.match(content, /<strong>14%<\/strong>/);
  const sections = new Map([...content.matchAll(/data-due-status=(\w+)>([\s\S]*?)<\/ul>/g)]
    .map(([, key, rows]) => [key, rows]));
  for (const [category, item] of [
    ["overdue", "OverdueTimed"], ["overdue", "ExactDeadline"],
    ["today", "DateOnlyToday"], ["soon", "upcoming"],
    ["scheduled", "DayEight"], ["pending", "NoDue"], ["pending", "InvalidDue"],
  ]) {
    assert.ok(sections.get(category)?.includes(item), `${item} belongs in ${category}`);
  }
  assert.match(content, /Vencen hoy/);
  assert.match(content, /Próximas a vencer/);
  assert.ok(content.indexOf("OldCompleted") < content.lastIndexOf("Ana"));
  assert.ok(content.lastIndexOf("upcoming") > content.lastIndexOf("Ana"));
  list.hideCompleted = true;
  const hidden = renderContent(list.render());
  assert.doesNotMatch(hidden, /OldCompleted|CompletedEarly/);
  assert.match(hidden, /1 de 7 completadas/);

  now += 30_000;
  const rolled = renderContent(list.render());
  assert.match(rolled, /2 de 9 completadas/);
  assert.match(rolled, /<strong>22%<\/strong>/);
  assert.match(rolled, /data-due-status=overdue[\s\S]*DateOnlyToday/);
  assert.doesNotMatch(rolled, /data-due-status=today/);

  list._items = [task("ScheduledOnly", "2026-12-05")];
  const emptyProgress = renderContent(list.render());
  assert.match(emptyProgress, /0 de 0 completadas/);
  assert.match(emptyProgress, /<strong>0%<\/strong>/);
});

test("the visible board refresh timer targets an exact upcoming deadline", () => {
  const now = Date.parse("2026-11-26T12:00:02Z");
  const delays = [];
  class Clock extends Date {
    static now() { return now; }
  }
  const elements = loadPanel({
    Date: Clock, document: { hidden: false },
    clearTimeout() {},
    setTimeout(callback, delay) { delays.push(delay); },
  });
  const list = new (elements.get("better-todo-task-list-v091"))();
  list.isConnected = true;
  list.entityId = "todo.home";
  list.hass = { states: { "todo.home": { attributes: { task_assignees: {} } } } };
  list._items = [{ due: "2026-11-26T12:00:15Z" }];
  list._scheduleDeadlineRefresh();
  assert.deepEqual(delays, [13_000]);

  list._items = [{ due: "2026-12-04", status: "completed" }];
  list._scheduleDeadlineRefresh();
  assert.deepEqual(delays, [13_000, 58_000]);
});

test("create, reassign and clear an assignee with the appropriate service", async () => {
  const elements = loadPanel();
  const dialog = new (elements.get("better-todo-task-dialog-v091"))();
  const calls = [];
  dialog.entityId = "todo.home";
  dialog.supportsAssignment = true;
  dialog.hass = {
    async callService(domain, service, data) {
      calls.push([domain, service, { ...data }]);
    },
  };

  dialog.openCreate();
  assert.equal(dialog._assignee, "");
  dialog._summary = "First task";
  dialog._assignee = "ana";
  await dialog._save();
  assert.deepEqual(calls.shift(), ["better_todo", "add_assigned_task", {
    entity_id: "todo.home", summary: "First task", description: "", user_id: "ana",
  }]);

  const item = {
    uid: "existing", summary: "Existing task",
    due: "2026-11-25T09:30:33-03:00", description: "[repeat:FREQ=WEEKLY]\n\nNotes",
  };
  dialog.openEdit(item, "FREQ=WEEKLY", "ana");
  dialog._assignee = "mateo";
  await dialog._save();
  dialog.openEdit(item, "FREQ=WEEKLY", "mateo");
  dialog._assignee = "";
  await dialog._save();
  assert.deepEqual(calls, [
    ["better_todo", "set_task_assignee", { entity_id: "todo.home", item: "existing", user_id: "mateo" }],
    ["better_todo", "set_task_assignee", { entity_id: "todo.home", item: "existing", user_id: null }],
  ]);
});

test("administrators can edit Better ToDo list settings and retry a failed save", async () => {
  const elements = loadPanel();
  const panel = new (elements.get("better-todo-panel-v091"))();
  const calls = [];
  let open = false;
  let fail = true;
  const dialog = { showModal() { open = true; }, close() { open = false; } };
  panel.shadowRoot = { querySelector: (selector) => selector === ".list-settings" ? dialog : null };
  panel._selectedEntityId = "todo.home";
  panel.hass = {
    user: { is_admin: false },
    entities: { "todo.home": { platform: "better_todo" } },
    localize: () => "",
    async callWS(message) {
      calls.push(JSON.parse(JSON.stringify(message)));
      if (!message.settings) return { name: "Home", cleanup_enabled: true, retention_months: 4 };
      if (fail) throw new Error("Update failed");
    },
  };

  await panel._openListSettings();
  assert.equal(calls.length, 0);
  panel.hass.user.is_admin = true;
  panel._selectedEntityId = "todo.external";
  await panel._openListSettings();
  assert.equal(calls.length, 0);

  panel._selectedEntityId = "todo.home";
  await panel._openListSettings();
  assert.equal(open, true);
  assert.match(renderContent(panel._renderListSettings()), /Custom period/);
  assert.match(renderContent(panel._renderListSettings()), /Calendar months/);
  panel._listSettings = { ...panel._listSettings, name: " Household ", custom: false };
  const event = { preventDefault() {} };
  await panel._saveListSettings(event);
  assert.equal(open, true);
  assert.match(renderContent(panel._renderListSettings()), /Could not save list settings/);

  fail = false;
  await panel._saveListSettings(event);
  const update = {
    type: "better_todo/list_settings", entity_id: "todo.home",
    settings: { name: "Household", retention_months: 1 },
  };
  assert.deepEqual(calls.slice(-2), [update, update]);
  assert.equal(open, false);
  assert.equal(panel._listSettings, null);
});
