// Better To-do custom panel
// LitElement is accessed from HA's already-loaded component registry (no CDN required).
// html/css shims produce objects matching Lit 3's internal TemplateResult and CSSResult
// structures so that the LitElement rendering engine (from HA's bundle) processes them
// correctly.
//
// Registration strategy (two paths):
//
//  1. SYNCHRONOUS PATH (common case): When this script executes, HA's core bundle
//     has already run and ha-card is defined. We define better-todo-panel immediately,
//     BEFORE the script's onload event fires. HA's panel_custom resolves its
//     loadCustomPanel() promise on that onload event, then calls
//     document.createElement("better-todo-panel") — which by then finds our element
//     properly registered.
//
//  2. ASYNC FALLBACK PATH (rare fresh-load edge case): If this script somehow executes
//     before ha-card is registered (e.g. the panel bundle loads ahead of the core
//     bundle during a cold start), we fall back to customElements.whenDefined("ha-card").
//     The browser's upgrade mechanism then kicks in: HA creates an HTMLElement
//     placeholder, we define our class shortly after, and the browser upgrades the
//     existing placeholder to our LitElement-based component.
(function () {
  function _definePanel() {
    // Guard: do not register twice (e.g. if the script is somehow executed more than once).
    if (customElements.get("better-todo-panel")) return;

    const LitElement = Object.getPrototypeOf(customElements.get("ha-card"));

    const html = (strings, ...values) => ({ _$litType$: 1, strings, values });

    const css = (strings, ...values) => {
      const cssText = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
      let _styleSheet;
      // Provide a lazy `styleSheet` getter so Lit 3's `adoptStyles` can use the
      // Constructable StyleSheets path (`adoptedStyleSheets`) in modern browsers.
      // Without this getter, `adoptStyles` receives `undefined` for every entry
      // and the `adoptedStyleSheets = [undefined]` assignment throws a TypeError,
      // which prevents the shadow root from being created and leaves the panel blank.
      return {
        cssText,
        _$cssResult$: true,
        get styleSheet() {
          if (_styleSheet === undefined) {
            _styleSheet = new CSSStyleSheet();
            _styleSheet.replaceSync(cssText);
          }
          return _styleSheet;
        },
      };
    };

    // ── MDI icon paths (from @mdi/js) ────────────────────────────────────────
    const _mdiPlus = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";
    const _mdiArrowLeft =
      "M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z";
    const _mdiDelete =
      "M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z";
    const _mdiRepeat =
      "M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z";
    const _mdiClose =
      "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";
    const _mdiCalendar =
      "M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,13H12V18H17V13Z";

    // ── Shared helpers ───────────────────────────────────────────────────────

    // Compute a human-readable name for a state object, mirroring HA's
    // computeStateName helper: use attributes.friendly_name when available,
    // otherwise derive from the entity_id object-id part.
    function _computeStateName(stateObj) {
      const fn = stateObj.attributes?.friendly_name;
      if (fn !== undefined) return fn || "";
      return stateObj.entity_id
        .substring(stateObj.entity_id.indexOf(".") + 1)
        .replace(/_/g, " ");
    }

    // Mirrors the Python _decode_description_structured logic: extract only the
    // free-text notes portion from the description, skipping leading tag lines
    // like "[quantity:2] [unit:kg] [category:Meat]".
    const _tagLineRe = /^\[([a-z_]+):[^\]]+\](\s*\[([a-z_]+):[^\]]+\])*\s*$/;
    function _parseDescriptionNotes(description) {
      if (!description) return "";
      const lines = description.split("\n");
      const notes = [];
      let inMeta = true;
      for (const line of lines) {
        if (inMeta) {
          if (_tagLineRe.test(line.trim())) continue;
          if (line.trim() === "") { inMeta = false; continue; }
          inMeta = false;
          notes.push(line);
        } else {
          notes.push(line);
        }
      }
      return notes.join("\n").trim();
    }

    // Build an RRULE string from a UI-level preset selection.
    function _buildRrule(preset, weekdays, custom) {
      switch (preset) {
        case "daily":   return "FREQ=DAILY";
        case "weekly": {
          const days = (weekdays || []).filter(Boolean).join(",");
          return days ? `FREQ=WEEKLY;BYDAY=${days}` : "FREQ=WEEKLY";
        }
        case "monthly": return "FREQ=MONTHLY";
        case "yearly":  return "FREQ=YEARLY";
        case "custom":  return (custom || "").trim();
        default:        return "";
      }
    }

    // Parse an RRULE string back into { preset, weekdays, custom } for the dialog.
    function _parseRrule(rrule) {
      if (!rrule) return { preset: "none", weekdays: [], custom: "" };
      const up = rrule.trim().toUpperCase();
      const parts = up.split(";");
      const freq = (parts.find((p) => p.startsWith("FREQ=")) || "").slice(5);
      const bydayRaw = (parts.find((p) => p.startsWith("BYDAY=")) || "").slice(6);
      const weekdays = bydayRaw ? bydayRaw.split(",").filter(Boolean) : [];
      const extra = parts.filter((p) => !p.startsWith("FREQ=") && !p.startsWith("BYDAY="));
      if (extra.length === 0) {
        if (freq === "DAILY")   return { preset: "daily",   weekdays: [],     custom: "" };
        if (freq === "WEEKLY")  return { preset: "weekly",  weekdays,         custom: "" };
        if (freq === "MONTHLY") return { preset: "monthly", weekdays: [],     custom: "" };
        if (freq === "YEARLY")  return { preset: "yearly",  weekdays: [],     custom: "" };
      }
      return { preset: "custom", weekdays: [], custom: rrule };
    }

    // Format a date/datetime string for localised display.
    function _formatDue(due, hass) {
      if (!due) return "";
      try {
        const s = String(due);
        const datePart = s.includes("T") ? s.split("T")[0] : s.substring(0, 10);
        const [y, m, d] = datePart.split("-").map(Number);
        const locale = hass?.locale?.language || navigator.language || "en";
        return new Date(y, m - 1, d).toLocaleDateString(locale, {
          month: "short", day: "numeric", year: "numeric",
        });
      } catch (_) {
        return String(due);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoTaskDialog
    // Custom create/edit dialog with Better ToDo-specific fields (recurrence).
    // ═══════════════════════════════════════════════════════════════════════════
    class BetterTodoTaskDialog extends LitElement {
      static get properties() {
        return {
          hass:      { attribute: false },
          entityId:  { type: String },
          _open:     { state: true },
          _item:     { state: true },
          _summary:  { state: true },
          _dueDate:  { state: true },
          _dueTime:  { state: true },
          _notes:    { state: true },
          _preset:   { state: true },
          _weekdays: { state: true },
          _custom:   { state: true },
          _saving:   { state: true },
          _error:    { state: true },
        };
      }

      constructor() {
        super();
        this._open     = false;
        this._item     = null;
        this._summary  = "";
        this._dueDate  = "";
        this._dueTime  = "";
        this._notes    = "";
        this._preset   = "none";
        this._weekdays = [];
        this._custom   = "";
        this._saving   = false;
        this._error    = "";
      }

      // Public API called by BetterTodoTaskList.
      openCreate() {
        this._item     = null;
        this._summary  = "";
        this._dueDate  = "";
        this._dueTime  = "";
        this._notes    = "";
        this._preset   = "none";
        this._weekdays = [];
        this._custom   = "";
        this._saving   = false;
        this._error    = "";
        this._open     = true;
      }

      openEdit(item, rrule) {
        this._item = item;
        this._summary = item.summary || "";
        const dueStr = item.due ? String(item.due) : "";
        if (dueStr.includes("T")) {
          const [d, t] = dueStr.split("T");
          this._dueDate = d;
          this._dueTime = (t || "").substring(0, 5);
        } else {
          this._dueDate = dueStr.substring(0, 10);
          this._dueTime = "";
        }
        this._notes = _parseDescriptionNotes(item.description);
        const p = _parseRrule(rrule);
        this._preset   = p.preset;
        this._weekdays = p.weekdays;
        this._custom   = p.custom;
        this._saving   = false;
        this._error    = "";
        this._open     = true;
      }

      _close() {
        if (this._saving) return;
        this._open = false;
      }

      _clickOverlay(e) {
        if (e.target === e.currentTarget) this._close();
      }

      _toggleDay(day) {
        this._weekdays = this._weekdays.includes(day)
          ? this._weekdays.filter((d) => d !== day)
          : [...this._weekdays, day];
      }

      async _save() {
        const summary = this._summary.trim();
        if (!summary || this._saving) return;
        this._saving = true;
        this._error  = "";

        const rruleStr = _buildRrule(this._preset, this._weekdays, this._custom);
        const notes    = this._notes.trim();

        try {
          if (this._item) {
            // ── Update existing item ─────────────────────────────────────────
            const upd = {
              entity_id:   this.entityId,
              item:        this._item.uid,
              rename:      summary,
              description: notes,
            };
            if (this._dueDate) {
              if (this._dueTime) upd.due_datetime = `${this._dueDate}T${this._dueTime}:00`;
              else               upd.due_date     = this._dueDate;
            }
            await this.hass.callService("todo", "update_item", upd);
            // Set or clear recurrence via the Better To-do service.
            await this.hass.callService("better_todo", "set_task_recurrence", {
              entity_id: this.entityId,
              item:      this._item.uid,
              rrule:     rruleStr || null,
            });
          } else {
            // ── Create new item ──────────────────────────────────────────────
            const cr = {
              entity_id:   this.entityId,
              item:        summary,
              description: notes,
            };
            if (this._dueDate) {
              if (this._dueTime) cr.due_datetime = `${this._dueDate}T${this._dueTime}:00`;
              else               cr.due_date     = this._dueDate;
            }
            await this.hass.callService("todo", "add_item", cr);

            // To set recurrence on the brand-new item we first need its UID.
            // Give the backend a moment to update state, then fetch the list
            // and match the newest item with the same summary.
            if (rruleStr) {
              await new Promise((r) => setTimeout(r, 500));
              const result = await this.hass.callWS({
                type: "todo/item/list", entity_id: this.entityId,
              });
              const candidates = (result?.items || []).filter(
                (i) => i.summary === summary && i.status !== "completed"
              );
              if (candidates.length > 0) {
                const newUid = candidates[candidates.length - 1].uid;
                await this.hass.callService("better_todo", "set_task_recurrence", {
                  entity_id: this.entityId, item: newUid, rrule: rruleStr,
                });
              }
            }
          }

          this._saving = false;
          this._open   = false;
          this.dispatchEvent(new CustomEvent("item-saved"));
        } catch (err) {
          this._error  = err?.message || "Error saving task. Please try again.";
          this._saving = false;
        }
      }

      render() {
        if (!this._open) return html``;

        const isCreate = !this._item;
        const L = (k, fb) => this.hass?.localize(k) || fb;

        // Short day labels built from the browser's Intl API for locale-aware names.
        // Jan 4–10 2021 is Mon–Sun; we reorder to MO–SU (Mon first).
        const _locale = this.hass?.locale?.language || navigator.language || "en";
        const _fmt = (d) =>
          new Date(2021, 0, d).toLocaleDateString(_locale, { weekday: "short" });
        const DAYS = [
          { k: "MO", label: _fmt(4) },
          { k: "TU", label: _fmt(5) },
          { k: "WE", label: _fmt(6) },
          { k: "TH", label: _fmt(7) },
          { k: "FR", label: _fmt(8) },
          { k: "SA", label: _fmt(9) },
          { k: "SU", label: _fmt(10) },
        ];

        return html`
          <div class="overlay" @click=${(e) => this._clickOverlay(e)}>
            <ha-card class="dialog">
              <div class="dlg-header">
                <span class="dlg-title">
                  ${isCreate
                    ? L("ui.panel.todo.action.add_item", "Add task")
                    : L("ui.common.edit", "Edit")}
                </span>
                <ha-icon-button
                  .path=${_mdiClose}
                  @click=${() => this._close()}
                  ?disabled=${this._saving}
                ></ha-icon-button>
              </div>

              <div class="dlg-body">
                <!-- Task name -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.todo-list-item.summary", "Task name")}
                    <span class="req">*</span>
                  </label>
                  <input
                    class="inp"
                    type="text"
                    .value=${this._summary}
                    @input=${(e) => { this._summary = e.target.value; }}
                    ?disabled=${this._saving}
                    autocomplete="off"
                  />
                </div>

                <!-- Due date -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.todo-list-item.due_date", "Due date")}
                  </label>
                  <input
                    class="inp"
                    type="date"
                    .value=${this._dueDate}
                    @input=${(e) => { this._dueDate = e.target.value; }}
                    ?disabled=${this._saving}
                  />
                </div>

                <!-- Due time (only visible when a date has been entered) -->
                ${this._dueDate ? html`
                  <div class="field">
                    <label class="lbl">${L("ui.common.time", "Time")}</label>
                    <input
                      class="inp"
                      type="time"
                      .value=${this._dueTime}
                      @input=${(e) => { this._dueTime = e.target.value; }}
                      ?disabled=${this._saving}
                    />
                  </div>
                ` : ""}

                <!-- Notes -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.calendar.event.description", "Notes")}
                  </label>
                  <textarea
                    class="inp textarea"
                    rows="3"
                    .value=${this._notes}
                    @input=${(e) => { this._notes = e.target.value; }}
                    ?disabled=${this._saving}
                  ></textarea>
                </div>

                <!-- Recurrence preset -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.calendar.event.recurrence.repeat", "Repeat")}
                  </label>
                  <select
                    class="inp sel"
                    @change=${(e) => { this._preset = e.target.value; }}
                    ?disabled=${this._saving}
                  >
                    <option value="none"    ?selected=${this._preset === "none"}>
                      ${L("ui.components.calendar.event.recurrence.no_repeat", "None")}
                    </option>
                    <option value="daily"   ?selected=${this._preset === "daily"}>
                      ${L("ui.components.calendar.event.recurrence.daily", "Daily")}
                    </option>
                    <option value="weekly"  ?selected=${this._preset === "weekly"}>
                      ${L("ui.components.calendar.event.recurrence.weekly", "Weekly")}
                    </option>
                    <option value="monthly" ?selected=${this._preset === "monthly"}>
                      ${L("ui.components.calendar.event.recurrence.monthly", "Monthly")}
                    </option>
                    <option value="yearly"  ?selected=${this._preset === "yearly"}>
                      ${L("ui.components.calendar.event.recurrence.yearly", "Yearly")}
                    </option>
                    <option value="custom"  ?selected=${this._preset === "custom"}>
                      ${L("ui.components.calendar.event.recurrence.custom", "Custom")}
                    </option>
                  </select>
                </div>

                <!-- Weekday picker (only for Weekly) -->
                ${this._preset === "weekly" ? html`
                  <div class="field">
                    <label class="lbl">
                      ${L("ui.components.calendar.event.repeat.on", "On")}
                    </label>
                    <div class="days">
                      ${DAYS.map((d) => html`
                        <button
                          type="button"
                          class="day ${this._weekdays.includes(d.k) ? "day--on" : ""}"
                          @click=${() => this._toggleDay(d.k)}
                          ?disabled=${this._saving}
                        >${d.label}</button>
                      `)}
                    </div>
                  </div>
                ` : ""}

                <!-- Raw RRULE input (only for Custom) -->
                ${this._preset === "custom" ? html`
                  <div class="field">
                    <label class="lbl">RRULE</label>
                    <input
                      class="inp"
                      type="text"
                      .value=${this._custom}
                      @input=${(e) => { this._custom = e.target.value; }}
                      placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                      ?disabled=${this._saving}
                    />
                  </div>
                ` : ""}

                ${this._error ? html`<p class="err">${this._error}</p>` : ""}
              </div>

              <div class="dlg-actions">
                <button
                  class="btn btn-ghost"
                  @click=${() => this._close()}
                  ?disabled=${this._saving}
                >
                  ${L("ui.common.cancel", "Cancel")}
                </button>
                <button
                  class="btn btn-primary"
                  @click=${() => this._save()}
                  ?disabled=${!this._summary.trim() || this._saving}
                >
                  ${this._saving
                    ? "…"
                    : isCreate
                      ? L("ui.common.add", "Add")
                      : L("ui.common.save", "Save")}
                </button>
              </div>
            </ha-card>
          </div>
        `;
      }

      static get styles() {
        return [css`
          :host { display: contents; }

          .overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.48);
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
          }

          .dialog {
            width: 100%;
            max-width: 480px;
            max-height: calc(100vh - 32px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-radius: var(--ha-card-border-radius, 12px);
          }

          .dlg-header {
            display: flex;
            align-items: center;
            padding: 16px 8px 0 20px;
            flex-shrink: 0;
          }

          .dlg-title {
            flex: 1;
            font-size: 1.2rem;
            font-weight: 500;
            color: var(--primary-text-color);
          }

          .dlg-body {
            padding: 12px 20px 8px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .field {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .lbl {
            font-size: 0.73rem;
            font-weight: 500;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--secondary-text-color);
          }

          .req {
            color: var(--error-color, #b00020);
            margin-left: 2px;
          }

          .inp {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            border-radius: 8px;
            background: var(--input-fill-color, var(--secondary-background-color, #f5f5f5));
            color: var(--primary-text-color);
            font-size: 0.95rem;
            font-family: inherit;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s;
            -webkit-appearance: none;
          }

          .inp:focus { border-color: var(--primary-color); }

          .inp:disabled { opacity: 0.55; }

          .textarea {
            resize: vertical;
            min-height: 64px;
          }

          .sel { cursor: pointer; }

          .days {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          .day {
            padding: 4px 10px;
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            border-radius: 16px;
            background: transparent;
            color: var(--primary-text-color);
            cursor: pointer;
            font-size: 0.82rem;
            font-family: inherit;
            transition: background 0.12s, border-color 0.12s;
          }

          .day--on {
            background: var(--primary-color);
            color: var(--text-primary-color, #fff);
            border-color: var(--primary-color);
          }

          .day:disabled { opacity: 0.5; cursor: default; }

          .err {
            color: var(--error-color, #b00020);
            font-size: 0.85rem;
            margin: 0;
          }

          .dlg-actions {
            display: flex;
            justify-content: flex-end;
            padding: 8px 20px 16px;
            gap: 8px;
            flex-shrink: 0;
          }

          .btn {
            padding: 8px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.88rem;
            font-family: inherit;
            font-weight: 500;
            transition: opacity 0.12s, background 0.12s;
          }

          .btn:disabled { opacity: 0.45; cursor: default; }

          .btn-ghost {
            background: transparent;
            color: var(--primary-text-color);
          }

          .btn-ghost:hover:not(:disabled) { background: var(--secondary-background-color); }

          .btn-primary {
            background: var(--primary-color);
            color: var(--text-primary-color, #fff);
          }

          .btn-primary:hover:not(:disabled) { opacity: 0.85; }
        `];
      }
    }

    customElements.define("better-todo-task-dialog", BetterTodoTaskDialog);

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoTaskList
    // Mirrors HA's ha-todo-list behaviour; opens BetterTodoTaskDialog for
    // create/edit instead of HA's built-in dialog.
    // ═══════════════════════════════════════════════════════════════════════════
    class BetterTodoTaskList extends LitElement {
      static get properties() {
        return {
          hass:     { attribute: false },
          entityId: { type: String },
          _items:   { state: true },
          _loading: { state: true },
        };
      }

      constructor() {
        super();
        this._items   = [];
        this._loading = false;
        // Non-reactive: prevents re-fetch loops when only _loading/_items change.
        this._stateKey = null;
      }

      async _fetchItems() {
        if (!this.hass || !this.entityId) return;
        this._loading = true;
        try {
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: this.entityId,
          });
          this._items = res?.items || [];
        } catch (_) {
          this._items = [];
        }
        this._loading = false;
      }

      updated(changedProps) {
        super.updated(changedProps);
        // Full reset when the displayed list changes.
        if (changedProps.has("entityId")) {
          this._items    = [];
          this._stateKey = null;
          this._fetchItems();
          return;
        }
        // Re-fetch whenever the entity's state fingerprint changes (e.g. an item
        // was added / completed / deleted from outside this panel).
        if (changedProps.has("hass") && this.hass) {
          const s = this.hass.states[this.entityId];
          const key = s ? `${s.last_changed}|${s.state}` : null;
          if (key !== this._stateKey) {
            this._stateKey = key;
            this._fetchItems();
          }
        }
      }

      _dialog() {
        return this.shadowRoot?.querySelector("better-todo-task-dialog");
      }

      _openCreate() {
        this._dialog()?.openCreate();
      }

      _openEdit(item) {
        const rrule =
          this.hass?.states[this.entityId]?.attributes?.task_recurrence?.[item.uid] || "";
        this._dialog()?.openEdit(item, rrule);
      }

      async _toggle(item) {
        const newStatus = item.status === "completed" ? "needs_action" : "completed";
        try {
          await this.hass.callService("todo", "update_item", {
            entity_id: this.entityId, item: item.uid, status: newStatus,
          });
        } catch (_) { /* ignore */ }
      }

      async _delete(uid, ev) {
        ev.stopPropagation();
        try {
          await this.hass.callService("todo", "remove_item", {
            entity_id: this.entityId, item: uid,
          });
        } catch (_) { /* ignore */ }
      }

      _renderItem(item) {
        const done  = item.status === "completed";
        const rrule = this.hass?.states[this.entityId]?.attributes?.task_recurrence?.[item.uid];
        const due   = _formatDue(item.due, this.hass);
        return html`
          <div class="item ${done ? "item--done" : ""}">
            <ha-checkbox
              .checked=${done}
              @change=${() => this._toggle(item)}
            ></ha-checkbox>
            <div class="item-body" @click=${() => this._openEdit(item)}>
              <span class="item-name">${item.summary}</span>
              ${due || rrule ? html`
                <div class="item-meta">
                  ${due ? html`
                    <span class="meta-chip">
                      <ha-svg-icon class="chip-icon" .path=${_mdiCalendar}></ha-svg-icon>
                      ${due}
                    </span>
                  ` : ""}
                  ${rrule ? html`
                    <span class="meta-chip">
                      <ha-svg-icon class="chip-icon" .path=${_mdiRepeat}></ha-svg-icon>
                    </span>
                  ` : ""}
                </div>
              ` : ""}
            </div>
            <ha-icon-button
              class="del-btn"
              .path=${_mdiDelete}
              @click=${(e) => this._delete(item.uid, e)}
            ></ha-icon-button>
          </div>
        `;
      }

      render() {
        const L = (k, fb) => this.hass?.localize(k) || fb;
        const pending = this._items.filter((i) => i.status !== "completed");
        const done    = this._items.filter((i) => i.status === "completed");

        return html`
          <div class="list-wrap">
            ${this._loading && !this._items.length
              ? html`<div class="placeholder">${L("ui.common.loading", "Loading…")}</div>`
              : ""}
            ${!this._loading && !this._items.length
              ? html`<div class="placeholder">${L("ui.panel.todo.no_items", "No tasks yet.")}</div>`
              : ""}

            ${pending.map((i) => this._renderItem(i))}

            ${done.length ? html`
              <div class="section-label">
                ${L("ui.panel.todo.filter.completed", "Completed")}
              </div>
              ${done.map((i) => this._renderItem(i))}
            ` : ""}
          </div>

          <div class="add-footer">
            <button class="add-btn" @click=${() => this._openCreate()}>
              <ha-svg-icon .path=${_mdiPlus}></ha-svg-icon>
              ${L("ui.panel.todo.action.add_item", "Add task")}
            </button>
          </div>

          <better-todo-task-dialog
            .hass=${this.hass}
            .entityId=${this.entityId}
            @item-saved=${() => this._fetchItems()}
          ></better-todo-task-dialog>
        `;
      }

      static get styles() {
        return [css`
          :host {
            display: block;
          }

          .list-wrap { padding: 8px 0 0; }

          .item {
            display: flex;
            align-items: center;
            padding: 2px 8px 2px 4px;
            border-radius: 8px;
            gap: 2px;
          }

          .item:hover { background: var(--secondary-background-color); }

          .item--done .item-name {
            text-decoration: line-through;
            color: var(--secondary-text-color);
          }

          .item-body {
            flex: 1;
            padding: 6px 4px;
            cursor: pointer;
            min-width: 0;
          }

          .item-name {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--primary-text-color);
            font-size: 1rem;
          }

          .item-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 2px;
          }

          .meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            font-size: 0.75rem;
            color: var(--secondary-text-color);
          }

          .chip-icon {
            width: 13px;
            height: 13px;
            --mdc-icon-size: 13px;
          }

          .del-btn {
            --mdc-icon-button-size: 36px;
            opacity: 0;
            transition: opacity 0.15s;
            flex-shrink: 0;
          }

          .item:hover .del-btn { opacity: 1; }

          .section-label {
            font-size: 0.73rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--secondary-text-color);
            padding: 16px 8px 4px 12px;
          }

          .placeholder {
            text-align: center;
            padding: 48px 16px;
            color: var(--secondary-text-color);
            font-size: 0.95rem;
          }

          .add-footer {
            border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            margin-top: 8px;
          }

          .add-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 12px 16px;
            border: none;
            background: transparent;
            color: var(--primary-text-color);
            font-size: 1rem;
            font-family: inherit;
            cursor: pointer;
            transition: background 0.12s;
          }

          .add-btn:hover { background: var(--secondary-background-color); }
        `];
      }
    }

    customElements.define("better-todo-task-list", BetterTodoTaskList);

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoShoppingList
    // Displays shopping-list items grouped alphabetically by category, showing
    // name, quantity and unit for each item.
    // ═══════════════════════════════════════════════════════════════════════════
    class BetterTodoShoppingList extends LitElement {
      static get properties() {
        return {
          hass:     { attribute: false },
          entityId: { type: String },
          _items:   { state: true },
          _loading: { state: true },
        };
      }

      constructor() {
        super();
        this._items    = [];
        this._loading  = false;
        this._stateKey = null;
      }

      async _fetchItems() {
        if (!this.hass || !this.entityId) return;
        this._loading = true;
        try {
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: this.entityId,
          });
          this._items = res?.items || [];
        } catch (_) {
          this._items = [];
        }
        this._loading = false;
      }

      updated(changedProps) {
        super.updated(changedProps);
        if (changedProps.has("entityId")) {
          this._items    = [];
          this._stateKey = null;
          this._fetchItems();
          return;
        }
        if (changedProps.has("hass") && this.hass) {
          const s   = this.hass.states[this.entityId];
          const key = s ? `${s.last_changed}|${s.state}` : null;
          if (key !== this._stateKey) {
            this._stateKey = key;
            this._fetchItems();
          }
        }
      }

      async _toggle(item) {
        const newStatus = item.status === "completed" ? "needs_action" : "completed";
        try {
          await this.hass.callService("todo", "update_item", {
            entity_id: this.entityId, item: item.uid, status: newStatus,
          });
        } catch (_) { /* ignore */ }
      }

      render() {
        const L       = (k, fb) => this.hass?.localize(k) || fb;
        const details = this.hass?.states[this.entityId]?.attributes?.task_details || {};
        const pending = this._items.filter((i) => i.status !== "completed");
        const done    = this._items.filter((i) => i.status === "completed");

        // Group pending items by category.  Items without a category are
        // collected under the NO_CAT sentinel and shown after all named groups.
        const NO_CAT = "__none__";
        const groups = new Map();
        for (const item of pending) {
          const cat = details[item.uid]?.category || NO_CAT;
          if (!groups.has(cat)) groups.set(cat, []);
          groups.get(cat).push(item);
        }

        // Named categories sorted alphabetically; uncategorised items come last.
        const cats = [...groups.keys()]
          .filter((c) => c !== NO_CAT)
          .sort((a, b) => a.localeCompare(b));
        if (groups.has(NO_CAT)) cats.push(NO_CAT);

        const renderShopItem = (item, crossed = false) => {
          const d   = details[item.uid] || {};
          const qty = [d.quantity, d.unit].filter(Boolean).join(" ");
          return html`
            <div class="shop-item ${crossed ? "shop-item--done" : ""}">
              <ha-checkbox
                .checked=${crossed}
                @change=${() => this._toggle(item)}
              ></ha-checkbox>
              <span class="shop-name">${item.summary}</span>
              ${qty ? html`<span class="shop-qty">${qty}</span>` : ""}
            </div>
          `;
        };

        return html`
          <div class="shop-wrap">
            ${this._loading && !this._items.length
              ? html`<div class="placeholder">${L("ui.common.loading", "Loading…")}</div>`
              : ""}
            ${!this._loading && !this._items.length
              ? html`<div class="placeholder">${L("ui.panel.todo.no_items", "No items yet.")}</div>`
              : ""}

            ${cats.map((cat) => html`
              <div class="cat-group">
                ${cat !== NO_CAT
                  ? html`<div class="cat-header">${cat}</div>`
                  : ""}
                ${(groups.get(cat) || []).map((item) => renderShopItem(item))}
              </div>
            `)}

            ${done.length ? html`
              <div class="section-label">
                ${L("ui.panel.todo.filter.completed", "Completed")}
              </div>
              ${done.map((item) => renderShopItem(item, true))}
            ` : ""}
          </div>
        `;
      }

      static get styles() {
        return [css`
          :host {
            display: block;
          }

          .shop-wrap { padding: 4px 0 16px; }

          .cat-group { margin-bottom: 4px; }

          .cat-header {
            padding: 14px 16px 4px;
            font-size: 0.73rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--secondary-text-color);
            border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
            margin-bottom: 2px;
          }

          .shop-item {
            display: flex;
            align-items: center;
            min-height: 48px;
            padding: 2px 16px 2px 4px;
            gap: 4px;
          }

          .shop-item--done .shop-name,
          .shop-item--done .shop-qty {
            text-decoration: line-through;
            color: var(--secondary-text-color);
          }

          .shop-name {
            flex: 1;
            color: var(--primary-text-color);
            font-size: 1rem;
          }

          .shop-qty {
            color: var(--secondary-text-color);
            font-size: 0.88rem;
            white-space: nowrap;
            margin-left: 8px;
          }

          .section-label {
            font-size: 0.73rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--secondary-text-color);
            padding: 16px 16px 4px;
          }

          .placeholder {
            text-align: center;
            padding: 48px 16px;
            color: var(--secondary-text-color);
            font-size: 0.95rem;
          }
        `];
      }
    }

    customElements.define("better-todo-shopping-list", BetterTodoShoppingList);

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoPanel
    // ═══════════════════════════════════════════════════════════════════════════

    class BetterTodoPanel extends LitElement {
      static get properties() {
        return {
          hass: { attribute: false },
          narrow: { type: Boolean, reflect: true },
          mobile: { type: Boolean, reflect: true },
          _showPane: { state: true },
          // true while the user is browsing the list selector on a narrow screen.
          _paneOnMobile: { state: true },
          _selectedEntityId: { state: true },
          // Create-list inline dialog state.
          _showCreateDialog: { state: true },
          _createListName: { state: true },
          _createListSaving: { state: true },
          _createListError: { state: true },
          _showListActionDialog: { state: true },
          _listActionType: { state: true },
          _listActionEntityId: { state: true },
          _listActionName: { state: true },
          _listActionSaving: { state: true },
          _listActionError: { state: true },
        };
      }

      constructor() {
        super();
        this.narrow = false;
        this.mobile = false;
        this._showPane = false;
        this._paneOnMobile = false;
        // Restore last selected list from session storage so navigation
        // back to the panel re-opens the same list.
        try {
          this._selectedEntityId =
            sessionStorage.getItem("better-todo-selected-entity") || null;
        } catch (_) {
          this._selectedEntityId = null;
        }
        this._resizeObserver = null;
        this._mql = null;
        this._onMqlChange = null;
        this._showCreateDialog = false;
        this._createListName = "";
        this._createListSaving = false;
        this._createListError = "";
        this._showListActionDialog = false;
        this._listActionType = null;
        this._listActionEntityId = null;
        this._listActionName = "";
        this._listActionSaving = false;
        this._listActionError = "";
      }

      // -----------------------------------------------------------------------
      // Helpers
      // -----------------------------------------------------------------------

      /** Returns all todo-domain state objects, sorted alphabetically with the
       *  Better To-do Shopping List pinned to the end of the list. */
      _getTodoLists() {
        if (!this.hass) return [];
        const entities = Object.values(this.hass.states).filter(
          (s) => s.entity_id.startsWith("todo.")
        );
        entities.sort((a, b) => {
          const aShop = this._isShoppingList(a.entity_id);
          const bShop = this._isShoppingList(b.entity_id);
          if (aShop && !bShop) return 1;
          if (!aShop && bShop) return -1;
          return this._computeListName(a).localeCompare(this._computeListName(b));
        });
        return entities;
      }

      /** Returns true if the given entity_id belongs to the built-in Better
       *  To-do Shopping List (identified via the entity registry unique_id). */
      _isShoppingList(entityId) {
        const entry = this.hass?.entities?.[entityId];
        return (
          entry?.platform === "better_todo" &&
          entry?.unique_id?.includes("default_shopping_list")
        );
      }

      /** Returns the display name for a list. */
      _computeListName(stateObj) {
        return _computeStateName(stateObj);
      }

      _getConfigEntryId(entityId) {
        return this.hass?.entities?.[entityId]?.config_entry_id || null;
      }

      // -----------------------------------------------------------------------
      // Event handlers
      // -----------------------------------------------------------------------

      _setSelectedEntity(entityId) {
        this._selectedEntityId = entityId;
        // On narrow screens, close the mobile list selector after picking a list.
        this._paneOnMobile = false;
        try {
          sessionStorage.setItem("better-todo-selected-entity", entityId);
        } catch (_) {
          // ignore
        }
      }

      /** Navigate back to the list selector on narrow screens. */
      _backToLists() {
        this._paneOnMobile = true;
      }

      _openRenameListDialog(entityId, ev) {
        ev?.stopPropagation();
        const stateObj = this.hass?.states?.[entityId];
        if (!stateObj) return;
        this._listActionType = "rename";
        this._listActionEntityId = entityId;
        this._listActionName = this._computeListName(stateObj);
        this._listActionSaving = false;
        this._listActionError = "";
        this._showListActionDialog = true;
      }

      _openDeleteListDialog(entityId, ev) {
        ev?.stopPropagation();
        if (!this._getConfigEntryId(entityId)) return;
        const stateObj = this.hass?.states?.[entityId];
        if (!stateObj) return;
        this._listActionType = "delete";
        this._listActionEntityId = entityId;
        this._listActionName = this._computeListName(stateObj);
        this._listActionSaving = false;
        this._listActionError = "";
        this._showListActionDialog = true;
      }

      _closeListActionDialog(force = false) {
        if (this._listActionSaving && !force) return;
        this._showListActionDialog = false;
        this._listActionType = null;
        this._listActionEntityId = null;
        this._listActionName = "";
        this._listActionError = "";
      }

      async _submitRenameList() {
        if (
          this._listActionSaving ||
          this._listActionType !== "rename" ||
          !this._listActionEntityId
        ) {
          return;
        }
        const stateObj = this.hass?.states?.[this._listActionEntityId];
        if (!stateObj) return;
        const currentName = this._computeListName(stateObj);
        const trimmed = this._listActionName.trim();
        if (!trimmed) return;
        if (trimmed === currentName) {
          this._closeListActionDialog(true);
          return;
        }
        this._listActionSaving = true;
        this._listActionError = "";
        try {
          await this.hass.callWS({
            type: "config/entity_registry/update",
            entity_id: this._listActionEntityId,
            name: trimmed,
          });
          this._closeListActionDialog(true);
        } catch (err) {
          this._listActionError = err?.message || "Error renaming list.";
        } finally {
          this._listActionSaving = false;
        }
      }

      async _submitDeleteList() {
        if (
          this._listActionSaving ||
          this._listActionType !== "delete" ||
          !this._listActionEntityId
        ) {
          return;
        }
        const entityId = this._listActionEntityId;
        const configEntryId = this._getConfigEntryId(entityId);
        if (!configEntryId) return;
        this._listActionSaving = true;
        this._listActionError = "";
        try {
          await this.hass.callApi(
            "DELETE",
            `config/config_entries/entry/${configEntryId}`
          );
          if (this._selectedEntityId === entityId) {
            this._selectedEntityId = null;
          }
          this._closeListActionDialog();
        } catch (err) {
          this._listActionError = err?.message || "Error deleting list.";
        } finally {
          this._listActionSaving = false;
        }
      }

      /** Open the inline create-list dialog. */
      _addList() {
        this._createListName = "";
        this._createListError = "";
        this._createListSaving = false;
        this._showCreateDialog = true;
      }

      /** Close the create-list dialog (no-op while a save is in progress). */
      _closeCreateDialog() {
        if (this._createListSaving) return;
        this._showCreateDialog = false;
        this._createListName = "";
        this._createListError = "";
      }

      /** Submit the create-list form via the HA config-flow REST API. */
      async _submitCreateList() {
        const name = this._createListName.trim();
        if (!name || this._createListSaving) return;
        this._createListSaving = true;
        this._createListError = "";
        let closeDialog = false;
        try {
          // Step 1: start a new config-flow for better_todo.
          const flow = await this.hass.callApi(
            "POST",
            "config/config_entries/flow",
            { handler: "better_todo" }
          );
          // Step 2: submit the list name to complete the flow.
          const result = await this.hass.callApi(
            "POST",
            `config/config_entries/flow/${flow.flow_id}`,
            { todo_list_name: name }
          );
          if (result.type === "abort") {
            this._createListError =
              this.hass?.localize(
                `component.better_todo.config.abort.${result.reason}`
              ) ||
              result.reason ||
              "Could not create list.";
            this._createListSaving = false;
            return;
          }
          if (result.type === "form" && result.errors && Object.keys(result.errors).length) {
            this._createListError =
              this.hass?.localize("ui.errors.config.config_flow_error") ||
              "Invalid input. Please check the list name.";
            return;
          }
          closeDialog = true;
        } catch (err) {
          this._createListError =
            err?.message || "Error creating list. Please try again.";
        } finally {
          this._createListSaving = false;
          if (closeDialog) {
            this._createListName = "";
            this._createListError = "";
            this._showCreateDialog = false;
          }
        }
      }

      // -----------------------------------------------------------------------
      // Lifecycle
      // -----------------------------------------------------------------------

      connectedCallback() {
        super.connectedCallback();

        // Mirror ha-panel-todo's ResizeController: show left pane when width > 750 px.
        this._resizeObserver = new ResizeObserver((entries) => {
          const showPane = (entries[0]?.contentRect.width ?? 0) > 750;
          if (showPane !== this._showPane) {
            this._showPane = showPane;
          }
        });
        this._resizeObserver.observe(this);

        // Mirror ha-panel-todo's MediaQueryList: detect mobile viewport.
        this._mql = window.matchMedia(
          "(max-width: 450px), all and (max-height: 500px)"
        );
        this._onMqlChange = (ev) => {
          this.mobile = ev.matches;
        };
        this._mql.addEventListener("change", this._onMqlChange);
        this.mobile = this._mql.matches;
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        this._mql?.removeEventListener("change", this._onMqlChange);
        this._mql = null;
      }

      willUpdate(changedProps) {
        super.willUpdate(changedProps);
        // Auto-select the first available list when nothing is selected (or when
        // the previously selected entity no longer exists in the state machine).
        if (this.hass) {
          const lists = this._getTodoLists();
          if (
            !this._selectedEntityId ||
            !this.hass.states[this._selectedEntityId]
          ) {
            const firstId = lists[0]?.entity_id ?? null;
            if (this._selectedEntityId !== firstId) {
              this._selectedEntityId = firstId;
            }
            // On narrow screens with no valid selection, open the list selector
            // so the user can pick or create a list.
            if (!this._showPane && !firstId) {
              this._paneOnMobile = true;
            }
          }
        }

        // When the layout switches from narrow → wide, the sidebar is always
        // visible again, so reset the mobile toggle.
        if (changedProps.has("_showPane") && this._showPane) {
          this._paneOnMobile = false;
        }
      }

      updated(changedProps) {
        super.updated(changedProps);
        if (changedProps.has("_showCreateDialog") && this._showCreateDialog) {
          requestAnimationFrame(() => {
            this.shadowRoot?.querySelector("#inp-list-name")?.focus();
          });
        }
        if (
          changedProps.has("_showListActionDialog") &&
          this._showListActionDialog &&
          this._listActionType === "rename"
        ) {
          requestAnimationFrame(() => {
            this.shadowRoot?.querySelector("#inp-rename-list-name")?.focus();
          });
        }
      }

      // -----------------------------------------------------------------------
      // Rendering
      // -----------------------------------------------------------------------

      render() {
        const lists = this._getTodoLists();

        // Reusable helper so each call site gets independent TemplateResult
        // instances (Lit must not share a single instance across two DOM slots).
        const makeListItems = () =>
          lists.map(
            (list) => {
              const configEntryId = this._getConfigEntryId(list.entity_id);
              return html`
              <ha-list-item
                graphic="icon"
                .activated=${list.entity_id === this._selectedEntityId}
                @click=${() => this._setSelectedEntity(list.entity_id)}
              >
                <ha-state-icon
                  .stateObj=${list}
                  slot="graphic"
                ></ha-state-icon>
                ${this._computeListName(list)}
                <ha-button-menu
                  slot="meta"
                  @click=${(e) => e.stopPropagation()}
                >
                  <ha-list-item
                    @click=${(e) => this._openRenameListDialog(list.entity_id, e)}
                  >
                    ${this.hass?.localize("ui.common.edit") || "Edit"}
                  </ha-list-item>
                  <ha-list-item
                    ?disabled=${!configEntryId}
                    @click=${(e) => this._openDeleteListDialog(list.entity_id, e)}
                  >
                    ${this.hass?.localize("ui.common.delete") || "Delete"}
                  </ha-list-item>
                </ha-button-menu>
              </ha-list-item>
            `;
            }
          );

        // "Create list" label: reuse HA's own translation key so the label is
        // automatically localised in every language HA supports.
        const createListLabel =
          this.hass?.localize("ui.panel.todo.create_list") || "Create list";

        // ── Layout decisions ────────────────────────────────────────────────
        // On narrow screens (_showPane=false) the sidebar is hidden by
        // ha-two-pane-top-app-bar-fixed.  We handle mobile navigation by
        // rendering either the list selector OR the todo content in the main
        // slot, controlled by _paneOnMobile.
        //
        // Wide screens (_showPane=true): sidebar + content always visible.

        // True while showing the list selector as main content on narrow.
        const showMobileList =
          !this._showPane &&
          (this._paneOnMobile || !this._selectedEntityId);

        // Show a back-arrow instead of the hamburger while viewing list
        // content on a narrow screen.
        const showBack =
          !this._showPane && !showMobileList && !!this._selectedEntityId;

        // Title: selected list name when back-button is shown, otherwise brand.
        const panelTitle =
          showBack && this.hass?.states[this._selectedEntityId]
            ? this._computeListName(this.hass.states[this._selectedEntityId])
            : "Better ToDo";

        // ── Main content slot ────────────────────────────────────────────────
        let mainContent;
        if (showMobileList) {
          // Mobile list selector (rendered in the main content area).
          mainContent = html`
            <ha-list activatable>${makeListItems()}</ha-list>
            <ha-list-item graphic="icon" @click=${this._addList}>
              <ha-svg-icon .path=${_mdiPlus} slot="graphic"></ha-svg-icon>
              ${createListLabel}
            </ha-list-item>
          `;
        } else if (this._selectedEntityId) {
          // Right pane: render a specialised view depending on list type.
          const isShopping = this._isShoppingList(this._selectedEntityId);
          mainContent = html`
            <div id="columns">
              <div class="column">
                ${isShopping
                  ? html`
                      <better-todo-shopping-list
                        .hass=${this.hass}
                        .entityId=${this._selectedEntityId}
                      ></better-todo-shopping-list>
                    `
                  : html`
                      <better-todo-task-list
                        .hass=${this.hass}
                        .entityId=${this._selectedEntityId}
                      ></better-todo-task-list>
                    `}
              </div>
            </div>
          `;
        } else {
          // No lists exist yet — prompt the user to create one.
          mainContent = html`
            <div class="empty-content">
              <span
                >${this.hass?.localize("ui.panel.todo.no_lists") ||
                "No lists found. Create one to get started."}</span
              >
            </div>
          `;
        }

        return html`
          <ha-two-pane-top-app-bar-fixed
            .pane=${this._showPane}
            footer
            .narrow=${this.narrow}
          >
            ${showBack
              ? html`
                  <ha-icon-button
                    slot="navigationIcon"
                    .path=${_mdiArrowLeft}
                    .label=${this.hass?.localize("ui.common.back") || "Back"}
                    @click=${this._backToLists}
                  ></ha-icon-button>
                `
              : html`
                  <ha-menu-button
                    slot="navigationIcon"
                    .hass=${this.hass}
                    .narrow=${this.narrow}
                  ></ha-menu-button>
                `}

            <span slot="title">${panelTitle}</span>

            <!-- Left pane: sorted todo lists (always in sidebar slot) -->
            <ha-list slot="pane" activatable>${makeListItems()}</ha-list>

            <!-- "Create list" footer (visible only when the sidebar pane is shown) -->
            ${this._showPane
              ? html`
                  <ha-list-item
                    graphic="icon"
                    slot="pane-footer"
                    @click=${this._addList}
                  >
                    <ha-svg-icon
                      .path=${_mdiPlus}
                      slot="graphic"
                    ></ha-svg-icon>
                    ${createListLabel}
                  </ha-list-item>
                `
              : ""}

            <!-- Action menu: hidden until needed -->
            <div slot="actionItems" hidden></div>

            <!-- Main content area -->
            ${mainContent}
          </ha-two-pane-top-app-bar-fixed>

          <!-- Create-list dialog -->
          ${this._renderCreateListDialog()}
          ${this._renderListActionDialog()}
        `;
      }

      _renderCreateListDialog() {
        if (!this._showCreateDialog) {
          return html``;
        }
        const L = (k, fb) => this.hass?.localize(k) || fb;
        const title =
          L("component.better_todo.config.step.user.title", null) ||
          L("ui.panel.todo.create_list", "Create list");
        const fieldLabel = L(
          "component.better_todo.config.step.user.data.todo_list_name",
          "List name"
        );
        return html`
          <div
            class="create-dialog-overlay"
            @click=${(e) => {
              if (e.target === e.currentTarget && !this._createListSaving) {
                this._closeCreateDialog();
              }
            }}
          >
            <ha-card class="create-dialog-card">
              <div class="dlg-header">
                <span class="dlg-title">${title}</span>
                <ha-icon-button
                  .path=${_mdiClose}
                  @click=${() => this._closeCreateDialog()}
                  ?disabled=${this._createListSaving}
                ></ha-icon-button>
              </div>

              <div class="dlg-body">
                <div class="field">
                  <label class="lbl">
                    ${fieldLabel}<span class="req">*</span>
                  </label>
                  <input
                    id="inp-list-name"
                    class="inp"
                    type="text"
                    .value=${this._createListName}
                    @input=${(e) => {
                      this._createListName = e.target.value;
                    }}
                    @keydown=${(e) => {
                      if (e.key === "Enter") this._submitCreateList();
                      else if (e.key === "Escape" && !this._createListSaving) {
                        e.preventDefault();
                        e.stopPropagation();
                        this._closeCreateDialog();
                      }
                    }}
                    ?disabled=${this._createListSaving}
                    autocomplete="off"
                  />
                </div>
                ${this._createListError
                  ? html`<p class="err">${this._createListError}</p>`
                  : ""}
              </div>

              <div class="dlg-actions">
                <button
                  class="btn btn-ghost"
                  @click=${() => this._closeCreateDialog()}
                  ?disabled=${this._createListSaving}
                >
                  ${L("ui.common.cancel", "Cancel")}
                </button>
                <button
                  class="btn btn-primary"
                  @click=${() => this._submitCreateList()}
                  ?disabled=${!this._createListName.trim() ||
                    this._createListSaving}
                >
                  ${this._createListSaving
                    ? "…"
                    : L("ui.common.add", "Add")}
                </button>
              </div>
            </ha-card>
          </div>
        `;
      }

      _renderListActionDialog() {
        if (!this._showListActionDialog || !this._listActionType) {
          return html``;
        }
        const L = (k, fb) => this.hass?.localize(k) || fb;
        const isRename = this._listActionType === "rename";
        return html`
          <div
            class="create-dialog-overlay"
            @click=${(e) => {
              if (e.target === e.currentTarget && !this._listActionSaving) {
                this._closeListActionDialog();
              }
            }}
          >
            <ha-card class="create-dialog-card">
              <div class="dlg-header">
                <span class="dlg-title">
                  ${isRename
                    ? L("ui.common.edit", "Edit")
                    : L("ui.common.delete", "Delete")}
                </span>
                <ha-icon-button
                  .path=${_mdiClose}
                  @click=${() => this._closeListActionDialog()}
                  ?disabled=${this._listActionSaving}
                ></ha-icon-button>
              </div>

              <div class="dlg-body">
                ${isRename
                  ? html`
                      <div class="field">
                        <label class="lbl">
                          ${L(
                            "component.better_todo.config.step.user.data.todo_list_name",
                            "List name"
                          )}<span class="req">*</span>
                        </label>
                        <input
                          id="inp-rename-list-name"
                          class="inp"
                          type="text"
                          .value=${this._listActionName}
                          @input=${(e) => {
                            this._listActionName = e.target.value;
                          }}
                          @keydown=${(e) => {
                            if (e.key === "Enter") this._submitRenameList();
                            else if (e.key === "Escape" && !this._listActionSaving) {
                              e.preventDefault();
                              e.stopPropagation();
                              this._closeListActionDialog();
                            }
                          }}
                          ?disabled=${this._listActionSaving}
                          autocomplete="off"
                        />
                      </div>
                    `
                  : html`
                      <p>
                        ${L("ui.dialogs.generic.delete", "Delete")}
                        ${" "}
                        "${this._listActionName}"?
                      </p>
                    `}
                ${this._listActionError
                  ? html`<p class="err">${this._listActionError}</p>`
                  : ""}
              </div>

              <div class="dlg-actions">
                <button
                  class="btn btn-ghost"
                  @click=${() => this._closeListActionDialog()}
                  ?disabled=${this._listActionSaving}
                >
                  ${L("ui.common.cancel", "Cancel")}
                </button>
                <button
                  class="btn btn-primary"
                  @click=${() =>
                    isRename ? this._submitRenameList() : this._submitDeleteList()}
                  ?disabled=${isRename
                    ? !this._listActionName.trim() || this._listActionSaving
                    : this._listActionSaving}
                >
                  ${this._listActionSaving
                    ? "…"
                    : isRename
                      ? L("ui.common.save", "Save")
                      : L("ui.common.delete", "Delete")}
                </button>
              </div>
            </ha-card>
          </div>
        `;
      }

      static get styles() {
        return [
          css`
            :host {
              display: block;
            }
            #columns {
              display: flex;
              flex-direction: row;
              justify-content: center;
              margin: 8px;
              padding-bottom: 70px;
            }
            .column {
              flex: 1 0 0;
              max-width: 500px;
              min-width: 0;
            }
            better-todo-task-list,
            better-todo-shopping-list {
              display: block;
            }
            .empty-content {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 48px 16px;
              text-align: center;
              color: var(--secondary-text-color);
            }
            .create-dialog-overlay {
              position: fixed;
              inset: 0;
              z-index: var(--better-todo-dialog-z-index, 1000);
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 16px;
              box-sizing: border-box;
              background: rgba(0, 0, 0, 0.48);
            }
            .create-dialog-card {
              width: calc(100vw - 32px);
              max-width: 400px;
              max-height: calc(100vh - 32px);
              display: flex;
              flex-direction: column;
              overflow: hidden;
              border-radius: var(--ha-card-border-radius, 12px);
            }
            .dlg-header {
              display: flex;
              align-items: center;
              padding: 16px 8px 0 20px;
              flex-shrink: 0;
            }
            .dlg-title {
              flex: 1;
              font-size: 1.2rem;
              font-weight: 500;
              color: var(--primary-text-color);
            }
            .dlg-body {
              padding: 12px 20px 8px;
              overflow-y: auto;
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 14px;
            }
            .field {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .lbl {
              font-size: 0.73rem;
              font-weight: 500;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              color: var(--secondary-text-color);
            }
            .req {
              color: var(--error-color, #b00020);
              margin-left: 2px;
            }
            .inp {
              width: 100%;
              padding: 8px 12px;
              border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
              border-radius: 8px;
              background: var(--input-fill-color, var(--secondary-background-color, #f5f5f5));
              color: var(--primary-text-color);
              font-size: 0.95rem;
              font-family: inherit;
              box-sizing: border-box;
              outline: none;
              transition: border-color 0.15s;
              -webkit-appearance: none;
            }
            .inp:focus { border-color: var(--primary-color); }
            .inp:disabled { opacity: 0.55; }
            .err {
              color: var(--error-color, #b00020);
              font-size: 0.85rem;
              margin: 0;
            }
            .dlg-actions {
              display: flex;
              justify-content: flex-end;
              padding: 8px 20px 16px;
              gap: 8px;
              flex-shrink: 0;
            }
            .btn {
              padding: 8px 20px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 0.88rem;
              font-family: inherit;
              font-weight: 500;
              transition: opacity 0.12s, background 0.12s;
            }
            .btn:disabled { opacity: 0.45; cursor: default; }
            .btn-ghost {
              background: transparent;
              color: var(--primary-text-color);
            }
            .btn-ghost:hover:not(:disabled) { background: var(--secondary-background-color); }
            .btn-primary {
              background: var(--primary-color);
              color: var(--text-primary-color, #fff);
            }
            .btn-primary:hover:not(:disabled) { opacity: 0.85; }
          `,
        ];
      }
    }

    customElements.define("better-todo-panel", BetterTodoPanel);
  }

  // ── Registration entry point ────────────────────────────────────────────────
  // Attempt the synchronous path first (see module-level comment above).
  if (customElements.get("ha-card")) {
    _definePanel();
  } else {
    // Async fallback: ha-card will be defined shortly as HA's core bundle finishes
    // executing. whenDefined resolves as a microtask once that happens.
    customElements.whenDefined("ha-card").then(_definePanel);
  }
})();
