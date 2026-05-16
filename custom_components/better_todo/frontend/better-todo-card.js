import {
  BetterTodoClient,
  STATUS_COMPLETED,
  STATUS_NEEDS_ACTION,
  computeEntityVersion,
  escapeHtml,
  formatDue,
  getBetterTodoEntities,
  getEntityName,
  getTaskDetails,
} from "./better-todo-shared.js";

class BetterTodoCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._entityId = null;
    this._items = [];
    this._busy = false;
    this._error = "";
    this._editingUid = "";
    this._showAddForm = false;
    this._panel = false;
    this._lastVersion = "";
    this._client = new BetterTodoClient(this);
  }

  setConfig(config) {
    this._config = config || {};
    if (config?.entity) {
      this._entityId = config.entity;
    }
    this.render();
  }

  set entityId(value) {
    if (this._entityId === value) {
      return;
    }
    this._entityId = value;
    this._items = [];
    this._editingUid = "";
    this._lastVersion = "";
    void this.refreshItems();
    this.render();
  }

  set panel(value) {
    this._panel = Boolean(value);
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._entityId) {
      this._entityId =
        this._config.entity || getBetterTodoEntities(hass)[0]?.entity_id || null;
    }

    const entityState = this._entityId ? hass?.states?.[this._entityId] : undefined;
    const nextVersion = computeEntityVersion(entityState);
    if (nextVersion && nextVersion !== this._lastVersion) {
      this._lastVersion = nextVersion;
      void this.refreshItems();
      this.render();
    }
  }

  getCardSize() {
    return Math.max(6, Math.ceil((this._items?.length || 0) / 2) + 4);
  }

  /** Public API used by better-todo-panel FAB to open the add-task form. */
  openAddForm() {
    this._showAddForm = true;
    this._editingUid = "";
    this.render();
    requestAnimationFrame(() => {
      this.shadowRoot?.querySelector('input[name="summary"]')?.focus();
    });
  }

  async refreshItems() {
    if (!this._entityId || !this._hass) {
      return;
    }

    try {
      this._error = "";
      this._items = await this._client.fetchItems();
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
    }
    this.render();
  }

  _getEntityState() {
    return this._entityId ? this._hass?.states?.[this._entityId] : undefined;
  }

  _getEntityName() {
    return getEntityName(this._getEntityState());
  }

  _setBusy(value) {
    this._busy = value;
    this.render();
  }

  _getOrderedItems() {
    const pending = [];
    const completed = [];

    for (const item of this._items || []) {
      if (item.status === STATUS_COMPLETED) {
        completed.push(item);
      } else {
        pending.push(item);
      }
    }

    return { pending, completed };
  }

  _serializeForm(form) {
    const data = new FormData(form);
    return {
      summary: String(data.get("summary") || "").trim(),
      due: String(data.get("due") || "").trim(),
      quantity: String(data.get("quantity") || "").trim(),
      unit: String(data.get("unit") || "").trim(),
      category: String(data.get("category") || "").trim(),
      repeat: String(data.get("repeat") || "").trim(),
      notes: String(data.get("notes") || "").trim(),
      status: String(data.get("status") || STATUS_NEEDS_ACTION),
    };
  }

  _renderForm(mode, item = null) {
    const details = item ? getTaskDetails(this._getEntityState(), item) : {};
    const values = {
      summary: item?.summary || "",
      due: item?.due ? String(item.due) : "",
      quantity: details.quantity || "",
      unit: details.unit || "",
      category: details.category || "",
      repeat: details.repeat || "",
      notes: details.notes || "",
      status: item?.status || STATUS_NEEDS_ACTION,
    };

    return `
      <form class="editor-form" data-mode="${mode}" data-uid="${escapeHtml(item?.uid || "")}">
        <div class="form-grid">
          <label>
            <span>Task</span>
            <input name="summary" type="text" value="${escapeHtml(values.summary)}" required />
          </label>
          <label>
            <span>Due</span>
            <input
              name="due"
              type="text"
              value="${escapeHtml(values.due)}"
              placeholder="2026-05-16 or 2026-05-16T18:30:00"
            />
          </label>
          <label>
            <span>Quantity</span>
            <input name="quantity" type="text" value="${escapeHtml(values.quantity)}" />
          </label>
          <label>
            <span>Unit</span>
            <input name="unit" type="text" value="${escapeHtml(values.unit)}" />
          </label>
          <label>
            <span>Category</span>
            <input name="category" type="text" value="${escapeHtml(values.category)}" />
          </label>
          <label>
            <span>RRULE</span>
            <input name="repeat" type="text" value="${escapeHtml(values.repeat)}" placeholder="FREQ=WEEKLY;BYDAY=MO" />
          </label>
          ${
            mode === "edit"
              ? `<label>
                  <span>Status</span>
                  <select name="status">
                    <option value="${STATUS_NEEDS_ACTION}" ${values.status === STATUS_NEEDS_ACTION ? "selected" : ""}>Needs action</option>
                    <option value="${STATUS_COMPLETED}" ${values.status === STATUS_COMPLETED ? "selected" : ""}>Completed</option>
                  </select>
                </label>`
              : ""
          }
          <label class="notes">
            <span>Notes</span>
            <textarea name="notes" rows="3">${escapeHtml(values.notes)}</textarea>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" ${this._busy ? "disabled" : ""}>
            ${mode === "add" ? "Add task" : "Save changes"}
          </button>
          <button type="button" data-action="${mode === "add" ? "cancel-add" : "cancel-edit"}">
            Cancel
          </button>
        </div>
      </form>
    `;
  }

  _renderItems(items, completed = false) {
    if (!items.length) {
      return `<div class="empty">${completed ? "No completed tasks" : "No pending tasks"}</div>`;
    }

    return items
      .map((item, index) => {
        const details = getTaskDetails(this._getEntityState(), item);
        const chips = [
          details.quantity ? `<span>${escapeHtml(details.quantity)}</span>` : "",
          details.unit ? `<span>${escapeHtml(details.unit)}</span>` : "",
          details.category ? `<span>${escapeHtml(details.category)}</span>` : "",
          details.repeat ? `<span>${escapeHtml(details.repeat)}</span>` : "",
        ]
          .filter(Boolean)
          .join("");

        const isEditing = this._editingUid === item.uid;

        return `
          <article class="task-row ${completed ? "completed" : ""}">
            <div class="task-main">
              <label class="task-check">
                <input
                  type="checkbox"
                  data-action="toggle"
                  data-uid="${escapeHtml(item.uid || "")}"
                  ${item.status === STATUS_COMPLETED ? "checked" : ""}
                  ${this._busy ? "disabled" : ""}
                />
                <span class="task-summary">${escapeHtml(item.summary || "")}</span>
              </label>
              ${
                item.due
                  ? `<div class="task-due">${escapeHtml(formatDue(String(item.due)))}</div>`
                  : ""
              }
              ${chips ? `<div class="task-chips">${chips}</div>` : ""}
              ${
                details.notes
                  ? `<div class="task-notes">${escapeHtml(details.notes)}</div>`
                  : ""
              }
            </div>
            <div class="task-actions">
              <button type="button" data-action="move-up" data-list="${completed ? "completed" : "pending"}" data-index="${index}" ${index === 0 || this._busy ? "disabled" : ""}>↑</button>
              <button type="button" data-action="move-down" data-list="${completed ? "completed" : "pending"}" data-index="${index}" ${index === items.length - 1 || this._busy ? "disabled" : ""}>↓</button>
              <button type="button" data-action="edit" data-uid="${escapeHtml(item.uid || "")}" ${this._busy ? "disabled" : ""}>Edit</button>
              <button type="button" data-action="delete" data-uid="${escapeHtml(item.uid || "")}" ${this._busy ? "disabled" : ""}>Delete</button>
            </div>
            ${isEditing ? this._renderForm("edit", item) : ""}
          </article>
        `;
      })
      .join("");
  }

  _renderShell() {
    const entityState = this._getEntityState();
    if (!entityState) {
      return `
        <div class="empty">
          No Better To-do entity available yet.
        </div>
      `;
    }

    const { pending, completed } = this._getOrderedItems();

    return `
      <header class="header">
        <div>
          <div class="title">${escapeHtml(this._config.title || this._getEntityName())}</div>
          <div class="subtitle">${pending.length} pending · ${completed.length} completed</div>
        </div>
        <div class="header-actions">
          <button type="button" data-action="toggle-add" ${this._busy ? "disabled" : ""}>
            ${this._showAddForm ? "Close" : "Add task"}
          </button>
          <button type="button" data-action="remove-completed" ${!completed.length || this._busy ? "disabled" : ""}>
            Clear completed
          </button>
        </div>
      </header>

      ${this._error ? `<div class="error">${escapeHtml(this._error)}</div>` : ""}
      ${this._showAddForm ? this._renderForm("add") : ""}

      <section class="section">
        <h3>Pending</h3>
        ${this._renderItems(pending)}
      </section>

      <section class="section">
        <h3>Completed</h3>
        ${this._renderItems(completed, true)}
      </section>
    `;
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    const containerTag = this._panel ? "section" : "ha-card";
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        ${containerTag} {
          display: block;
          border-radius: 16px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #111);
          box-shadow: var(--ha-card-box-shadow, 0 2px 6px rgba(0, 0, 0, 0.16));
          padding: 16px;
        }

        :host([hidden]) {
          display: none;
        }

        .header,
        .header-actions,
        .form-actions,
        .task-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .header {
          justify-content: space-between;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .title {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .subtitle,
        .task-due,
        .task-notes,
        .empty {
          color: var(--secondary-text-color, #666);
        }

        .section + .section {
          margin-top: 20px;
        }

        .section h3 {
          margin: 0 0 12px;
          font-size: 1rem;
        }

        .task-row {
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .task-row.completed .task-summary {
          text-decoration: line-through;
          opacity: 0.75;
        }

        .task-main {
          display: grid;
          gap: 8px;
        }

        .task-check {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 500;
        }

        .task-actions {
          justify-content: flex-end;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .task-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .task-chips span {
          display: inline-flex;
          border-radius: 999px;
          padding: 2px 8px;
          background: rgba(33, 150, 243, 0.12);
          color: var(--primary-color, #1d74c9);
          font-size: 0.85rem;
        }

        .editor-form {
          margin-top: 12px;
          border-top: 1px solid var(--divider-color, #ddd);
          padding-top: 12px;
        }

        .form-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .notes {
          grid-column: 1 / -1;
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 0.9rem;
        }

        input,
        textarea,
        select,
        button {
          font: inherit;
        }

        input,
        textarea,
        select {
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 10px;
          padding: 10px 12px;
          background: transparent;
          color: inherit;
        }

        button {
          border: 0;
          border-radius: 10px;
          padding: 10px 14px;
          background: var(--primary-color, #1d74c9);
          color: var(--text-primary-color, #fff);
          cursor: pointer;
        }

        button[data-action="cancel-add"],
        button[data-action="cancel-edit"],
        .task-actions button,
        .header-actions button:last-child {
          background: rgba(128, 128, 128, 0.18);
          color: inherit;
        }

        button[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(244, 67, 54, 0.12);
          color: #b3261e;
        }
      </style>
      <${containerTag}>
        ${this._renderShell()}
      </${containerTag}>
    `;

    this._attachHandlers();
  }

  _attachHandlers() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root.querySelectorAll("form.editor-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (this._busy) {
          return;
        }

        const mode = form.getAttribute("data-mode");
        const uid = form.getAttribute("data-uid") || "";
        const values = this._serializeForm(form);
        if (mode === "edit") {
          values.clearDetails = true;
          values.clearRepeat = true;
        }
        if (!values.summary) {
          return;
        }

        this._setBusy(true);
        try {
          if (mode === "add") {
            await this._client.addItem(values);
            this._showAddForm = false;
          } else {
            const previousItem = this._items.find((item) => item.uid === uid);
            await this._client.updateItem(uid, values, previousItem);
            this._editingUid = "";
          }
        } catch (err) {
          this._error = err instanceof Error ? err.message : String(err);
        } finally {
          this._setBusy(false);
        }
      });
    });

    root.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", async (event) => {
        const action = event.currentTarget.getAttribute("data-action");
        if (!action || this._busy) {
          return;
        }

        const uid = event.currentTarget.getAttribute("data-uid") || "";
        const index = Number(event.currentTarget.getAttribute("data-index"));
        const listName = event.currentTarget.getAttribute("data-list");
        const visibleLists = this._getOrderedItems();
        const pending = visibleLists.pending;
        const completed = visibleLists.completed;

        switch (action) {
          case "toggle-add":
            this._showAddForm = !this._showAddForm;
            if (this._showAddForm) {
              this._editingUid = "";
            }
            this.render();
            break;
          case "cancel-add":
            this._showAddForm = false;
            this.render();
            break;
          case "cancel-edit":
            this._editingUid = "";
            this.render();
            break;
          case "edit":
            this._editingUid = this._editingUid === uid ? "" : uid;
            this._showAddForm = false;
            this.render();
            break;
          case "delete":
            this._setBusy(true);
            try {
              await this._client.deleteItem(uid);
              if (this._editingUid === uid) {
                this._editingUid = "";
              }
            } catch (err) {
              this._error = err instanceof Error ? err.message : String(err);
            } finally {
              this._setBusy(false);
            }
            break;
          case "remove-completed":
            this._setBusy(true);
            try {
              await this._client.removeCompleted();
            } catch (err) {
              this._error = err instanceof Error ? err.message : String(err);
            } finally {
              this._setBusy(false);
            }
            break;
          case "move-up": {
            const list = listName === "completed" ? completed : pending;
            const item = list[index];
            const previousUid = index > 1 ? list[index - 2].uid : null;
            this._setBusy(true);
            try {
              await this._client.moveItem(item.uid, previousUid);
            } catch (err) {
              this._error = err instanceof Error ? err.message : String(err);
            } finally {
              this._setBusy(false);
            }
            break;
          }
          case "move-down": {
            const list = listName === "completed" ? completed : pending;
            const item = list[index];
            const previousUid = list[index + 1]?.uid || null;
            this._setBusy(true);
            try {
              await this._client.moveItem(item.uid, previousUid);
            } catch (err) {
              this._error = err instanceof Error ? err.message : String(err);
            } finally {
              this._setBusy(false);
            }
            break;
          }
          case "toggle": {
            const checkbox = event.currentTarget;
            const item = this._items.find((entry) => entry.uid === uid);
            if (!item) {
              return;
            }
            this._setBusy(true);
            try {
              await this._client.toggleItem(item, checkbox.checked);
            } catch (err) {
              this._error = err instanceof Error ? err.message : String(err);
            } finally {
              this._setBusy(false);
            }
            break;
          }
        }
      });
    });
  }
}

customElements.define("better-todo-card", BetterTodoCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "better-todo-card",
  name: "Better To-do",
  preview: true,
  description:
    "Dashboard card for Better To-do with inline support for recurrence and task metadata.",
});
