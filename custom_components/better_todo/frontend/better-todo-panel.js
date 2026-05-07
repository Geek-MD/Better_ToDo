class BetterTodoPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._selectedEntityId = "";
    this._editingUid = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._selectedEntityId) {
      const lists = this._todoEntities;
      this._selectedEntityId = lists.length ? lists[0].entity_id : "";
    }
    this._render();
  }

  get _todoEntities() {
    if (!this._hass) {
      return [];
    }
    return Object.values(this._hass.states)
      .filter((state) => state.entity_id.startsWith("todo."))
      .filter((state) => state.attributes?.friendly_name)
      .sort((a, b) =>
        (a.attributes.friendly_name || "").localeCompare(
          b.attributes.friendly_name || "",
        ),
      );
  }

  get _selectedState() {
    return this._hass?.states?.[this._selectedEntityId] || null;
  }

  get _items() {
    return this._selectedState?.attributes?.todo_items || [];
  }

  get _recurrenceMap() {
    return this._selectedState?.attributes?.task_recurrence || {};
  }

  _fmtDue(due) {
    if (!due) {
      return "";
    }
    const parsed = new Date(due);
    if (Number.isNaN(parsed.getTime())) {
      return due;
    }
    return parsed.toLocaleDateString();
  }

  async _toggleItem(item) {
    if (!this._selectedEntityId || !this._hass) {
      return;
    }
    const nextStatus =
      item.status === "completed" ? "needs_action" : "completed";
    await this._hass.callService("todo", "update_item", {
      entity_id: this._selectedEntityId,
      item: item.uid,
      status: nextStatus,
      summary: item.summary,
    });
  }

  async _deleteItem(uid) {
    if (!this._selectedEntityId || !this._hass) {
      return;
    }
    await this._hass.callService("todo", "remove_item", {
      entity_id: this._selectedEntityId,
      item: uid,
    });
  }

  _openDialog(item = null) {
    this._editingUid = item?.uid || null;
    const dialog = this.shadowRoot.querySelector("#taskDialog");
    if (!dialog) {
      return;
    }

    this.shadowRoot.querySelector("#taskSummary").value = item?.summary || "";
    this.shadowRoot.querySelector("#taskDue").value = item?.due || "";
    this.shadowRoot.querySelector("#taskDescription").value =
      item?.description || "";
    this.shadowRoot.querySelector("#taskRrule").value = item
      ? this._recurrenceMap[item.uid] || ""
      : "";
    dialog.showModal();
  }

  _closeDialog() {
    const dialog = this.shadowRoot.querySelector("#taskDialog");
    if (dialog?.open) {
      dialog.close();
    }
  }

  async _saveDialog() {
    if (!this._hass || !this._selectedEntityId) {
      return;
    }
    const summary = this.shadowRoot.querySelector("#taskSummary").value.trim();
    const due = this.shadowRoot.querySelector("#taskDue").value || null;
    const description =
      this.shadowRoot.querySelector("#taskDescription").value.trim() || null;
    const rrule = this.shadowRoot.querySelector("#taskRrule").value.trim();

    if (!summary) {
      return;
    }

    if (this._editingUid) {
      await this._hass.callService("todo", "update_item", {
        entity_id: this._selectedEntityId,
        item: this._editingUid,
        summary,
        due_date: due,
        description,
      });
      await this._hass.callService("better_todo", "set_task_recurrence", {
        entity_id: this._selectedEntityId,
        item: this._editingUid,
        rrule,
      });
    } else {
      await this._hass.callService("todo", "add_item", {
        entity_id: this._selectedEntityId,
        item: summary,
        due_date: due,
        description,
      });
    }

    this._closeDialog();
  }

  _bindHandlers() {
    const listSelector = this.shadowRoot.querySelector("#listSelector");
    if (listSelector) {
      listSelector.addEventListener("change", (ev) => {
        this._selectedEntityId = ev.target.value;
        this._render();
      });
    }

    this.shadowRoot.querySelector("#addTaskBtn")?.addEventListener("click", () => {
      this._openDialog();
    });

    this.shadowRoot
      .querySelector("#cancelDialogBtn")
      ?.addEventListener("click", () => this._closeDialog());
    this.shadowRoot
      .querySelector("#saveDialogBtn")
      ?.addEventListener("click", () => this._saveDialog());

    for (const checkbox of this.shadowRoot.querySelectorAll("[data-toggle-uid]")) {
      checkbox.addEventListener("change", () => {
        const uid = checkbox.getAttribute("data-toggle-uid");
        const item = this._items.find((todo) => todo.uid === uid);
        if (item) {
          this._toggleItem(item);
        }
      });
    }

    for (const editButton of this.shadowRoot.querySelectorAll("[data-edit-uid]")) {
      editButton.addEventListener("click", () => {
        const uid = editButton.getAttribute("data-edit-uid");
        const item = this._items.find((todo) => todo.uid === uid);
        if (item) {
          this._openDialog(item);
        }
      });
    }

    for (const deleteButton of this.shadowRoot.querySelectorAll("[data-delete-uid]")) {
      deleteButton.addEventListener("click", () => {
        const uid = deleteButton.getAttribute("data-delete-uid");
        if (uid) {
          this._deleteItem(uid);
        }
      });
    }
  }

  _render() {
    const selectedState = this._selectedState;
    const items = this._items;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          box-sizing: border-box;
        }
        .layout {
          max-width: 720px;
          margin: 0 auto;
        }
        ha-card {
          overflow: hidden;
        }
        .toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }
        .toolbar select {
          flex: 1;
          min-height: 36px;
          border-radius: 8px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 0 10px;
        }
        .toolbar button {
          border: none;
          border-radius: 999px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          font-weight: 600;
          padding: 8px 14px;
          cursor: pointer;
        }
        .items {
          display: flex;
          flex-direction: column;
        }
        .item {
          display: grid;
          grid-template-columns: 24px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 16px;
          border-top: 1px solid var(--divider-color);
        }
        .item:first-child {
          border-top: 0;
        }
        .meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .title {
          font-weight: 500;
        }
        .title.done {
          text-decoration: line-through;
          opacity: 0.75;
        }
        .sub {
          font-size: 12px;
          color: var(--secondary-text-color);
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .actions {
          display: inline-flex;
          gap: 6px;
        }
        .icon-btn {
          border: 1px solid var(--divider-color);
          background: transparent;
          color: var(--primary-text-color);
          border-radius: 8px;
          padding: 4px 8px;
          cursor: pointer;
        }
        dialog {
          border: none;
          border-radius: 12px;
          padding: 0;
          max-width: 560px;
          width: calc(100% - 32px);
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.45);
        }
        .dialog-body {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dialog-body h3 {
          margin: 0 0 4px;
          font-size: 18px;
        }
        .dialog-body input,
        .dialog-body textarea {
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          min-height: 38px;
          padding: 8px 10px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
        }
        .dialog-body textarea {
          min-height: 78px;
          resize: vertical;
        }
        .dialog-actions {
          margin-top: 8px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .dialog-actions button {
          border: none;
          border-radius: 8px;
          min-height: 34px;
          padding: 0 12px;
          cursor: pointer;
        }
        .dialog-actions .secondary {
          background: transparent;
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
        }
        .dialog-actions .primary {
          background: var(--primary-color);
          color: var(--text-primary-color);
        }
      </style>
      <div class="layout">
        <ha-card header="Better To-do">
          <div class="toolbar">
            <select id="listSelector">
              ${this._todoEntities
                .map(
                  (entity) => `
                    <option value="${entity.entity_id}" ${
                      entity.entity_id === this._selectedEntityId ? "selected" : ""
                    }>
                      ${entity.attributes.friendly_name}
                    </option>`,
                )
                .join("")}
            </select>
            <button id="addTaskBtn">Añadir tarea</button>
          </div>
          <div class="items">
            ${
              items.length
                ? items
                    .map(
                      (item) => `
                        <div class="item">
                          <input type="checkbox" data-toggle-uid="${item.uid}" ${
                            item.status === "completed" ? "checked" : ""
                          } />
                          <div class="meta">
                            <div class="title ${
                              item.status === "completed" ? "done" : ""
                            }">${item.summary || ""}</div>
                            <div class="sub">
                              ${item.due ? `<span>📅 ${this._fmtDue(item.due)}</span>` : ""}
                              ${
                                this._recurrenceMap[item.uid]
                                  ? `<span>🔁 ${this._recurrenceMap[item.uid]}</span>`
                                  : ""
                              }
                            </div>
                          </div>
                          <div class="actions">
                            <button class="icon-btn" data-edit-uid="${item.uid}">Editar</button>
                            <button class="icon-btn" data-delete-uid="${item.uid}">Borrar</button>
                          </div>
                        </div>`,
                    )
                    .join("")
                : `<div class="item"><div></div><div class="meta"><div class="title">No hay tareas en ${
                    selectedState?.attributes?.friendly_name || "la lista"
                  }</div></div><div></div></div>`
            }
          </div>
        </ha-card>
      </div>
      <dialog id="taskDialog">
        <div class="dialog-body">
          <h3>${this._editingUid ? "Editar tarea" : "Nueva tarea"}</h3>
          <input id="taskSummary" placeholder="Título" />
          <input id="taskDue" type="date" />
          <textarea id="taskDescription" placeholder="Descripción"></textarea>
          <input id="taskRrule" placeholder="RRULE (ej: FREQ=WEEKLY;BYDAY=MO)" />
          <div class="dialog-actions">
            <button class="secondary" id="cancelDialogBtn">Cancelar</button>
            <button class="primary" id="saveDialogBtn">Guardar</button>
          </div>
        </div>
      </dialog>
    `;

    this._bindHandlers();
  }
}

customElements.define("better-todo-panel", BetterTodoPanel);
