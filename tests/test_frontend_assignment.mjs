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

function loadPanel() {
  const legacy = class extends LitElement {};
  const elements = new Map([
    ["ha-card", class extends LitElement {}],
    ["better-todo-panel", legacy],
    ["better-todo-task-dialog", legacy],
  ]);
  runInNewContext(source, {
    HTMLElement,
    CustomEvent: class {},
    customElements: {
      get: (tag) => elements.get(tag),
      define(tag, constructor) {
        assert.ok(!elements.has(tag), `${tag} was already registered`);
        elements.set(tag, constructor);
      },
    },
  });
  assert.equal(elements.get("better-todo-panel"), legacy);
  assert.ok(elements.has("better-todo-panel-v080"));
  return elements;
}

test("only Better ToDo task lists offer assignment, even without state attributes", () => {
  const elements = loadPanel();
  const list = new (elements.get("better-todo-task-list-v080"))();
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

test("create, reassign and clear an assignee with the appropriate service", async () => {
  const elements = loadPanel();
  const dialog = new (elements.get("better-todo-task-dialog-v080"))();
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
