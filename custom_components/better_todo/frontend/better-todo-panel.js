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

    const _FREQ_BY_UNIT = {
      days: "DAILY", weeks: "WEEKLY", months: "MONTHLY", years: "YEARLY",
    };

    function _recurrenceEnd(endMode, endDate, endCount) {
      if (endMode === "date" && endDate) {
        return `UNTIL=${endDate.replaceAll("-", "")}`;
      }
      if (endMode === "count") {
        const count = Math.max(1, Number.parseInt(endCount, 10) || 1);
        return `COUNT=${count}`;
      }
      return "";
    }

    // Build an RRULE string from the dialog's friendly recurrence controls.
    function _buildRrule(preset, weekdays, recurrence) {
      let rule;
      switch (preset) {
        case "daily":   rule = "FREQ=DAILY"; break;
        case "weekly": {
          const days = (weekdays || []).filter(Boolean).join(",");
          rule = days ? `FREQ=WEEKLY;BYDAY=${days}` : "FREQ=WEEKLY";
          break;
        }
        case "monthly": rule = "FREQ=MONTHLY"; break;
        case "yearly":  rule = "FREQ=YEARLY"; break;
        case "custom": {
          if (recurrence.customMode === "pattern") {
            const days = recurrence.patternDays
              .filter(Boolean)
              .map((day) => `${recurrence.patternOrdinal}${day}`)
              .join(",");
            rule = `FREQ=MONTHLY;BYDAY=${days}`;
          } else {
            const interval = Math.max(
              1, Number.parseInt(recurrence.intervalNumber, 10) || 1
            );
            rule = `FREQ=${_FREQ_BY_UNIT[recurrence.intervalUnit]};INTERVAL=${interval}`;
          }
          break;
        }
        default:        return "";
      }
      const end = _recurrenceEnd(
        recurrence.endMode, recurrence.endDate, recurrence.endCount
      );
      return end ? `${rule};${end}` : rule;
    }

    // Parse supported RRULE fields back into the dialog's friendly controls.
    function _parseRrule(rrule) {
      const defaults = {
        preset: "none", weekdays: [], customMode: "time", intervalNumber: "1",
        intervalUnit: "days", patternOrdinal: "1", patternDays: [],
        endMode: "never", endDate: "", endCount: "10",
      };
      if (!rrule) return defaults;
      const up = rrule.trim().toUpperCase();
      const parts = up.split(";");
      const value = (name) =>
        (parts.find((part) => part.startsWith(`${name}=`)) || "").slice(name.length + 1);
      const freq = value("FREQ");
      const bydayRaw = value("BYDAY");
      const weekdays = bydayRaw ? bydayRaw.split(",").filter(Boolean) : [];
      const interval = value("INTERVAL");
      const bysetpos = value("BYSETPOS");
      const until = value("UNTIL");
      const count = value("COUNT");
      const end = count
        ? { endMode: "count", endCount: count }
        : until
          ? { endMode: "date", endDate: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` }
          : {};

      const ordinalDays = weekdays.map((day) => day.match(/^(-?\d)([A-Z]{2})$/));
      const sharedOrdinal = ordinalDays.length && ordinalDays.every(
        (match) => match && match[1] === ordinalDays[0][1]
      ) ? ordinalDays[0][1] : "";
      if ((bysetpos || sharedOrdinal) && weekdays.length) {
        return {
          ...defaults, ...end, preset: "custom", customMode: "pattern",
          patternOrdinal: bysetpos || sharedOrdinal,
          patternDays: sharedOrdinal ? ordinalDays.map((match) => match[2]) : weekdays,
        };
      }
      if (interval) {
        const unit = Object.keys(_FREQ_BY_UNIT).find(
          (key) => _FREQ_BY_UNIT[key] === freq
        ) || "days";
        return {
          ...defaults, ...end, preset: "custom", customMode: "time",
          intervalNumber: interval, intervalUnit: unit,
        };
      }
      if (freq === "DAILY") return { ...defaults, ...end, preset: "daily" };
      if (freq === "WEEKLY") return { ...defaults, ...end, preset: "weekly", weekdays };
      if (freq === "MONTHLY") return { ...defaults, ...end, preset: "monthly" };
      if (freq === "YEARLY") return { ...defaults, ...end, preset: "yearly" };
      return defaults;
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
      } catch {
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
          _customMode: { state: true },
          _intervalNumber: { state: true },
          _intervalUnit: { state: true },
          _patternOrdinal: { state: true },
          _patternDays: { state: true },
          _endMode: { state: true },
          _endDate: { state: true },
          _endCount: { state: true },
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
        this._resetRecurrenceControls();
        this._saving   = false;
        this._error    = "";
      }

      _resetRecurrenceControls() {
        this._customMode = "time";
        this._intervalNumber = "1";
        this._intervalUnit = "days";
        this._patternOrdinal = "1";
        this._patternDays = [];
        this._endMode = "never";
        this._endDate = "";
        this._endCount = "10";
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
        this._resetRecurrenceControls();
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
        this._customMode = p.customMode;
        this._intervalNumber = p.intervalNumber;
        this._intervalUnit = p.intervalUnit;
        this._patternOrdinal = p.patternOrdinal;
        this._patternDays = p.patternDays;
        this._endMode = p.endMode;
        this._endDate = p.endDate;
        this._endCount = p.endCount;
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

      async _listItemUids() {
        const result = await this.hass.callWS({
          type: "todo/item/list", entity_id: this.entityId,
        });
        return result?.items || [];
      }

      async _findCreatedItemUid(summary, previousUids) {
        // The todo.add_item service does not return the generated UID. Poll the
        // local entity briefly and identify the item by set difference, which
        // remains correct when multiple tasks share the same summary.
        for (let attempt = 0; attempt < 8; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => {
              setTimeout(resolve, 100 * attempt);
            });
          }
          const items = await this._listItemUids();
          const created = items.find(
            (item) => item.summary === summary && !previousUids.has(item.uid)
          );
          if (created) return created.uid;
        }
        return null;
      }

      async _save() {
        const summary = this._summary.trim();
        if (!summary || this._saving) return;
        this._saving = true;
        this._error  = "";

        const rruleStr = _buildRrule(this._preset, this._weekdays, {
          customMode: this._customMode,
          intervalNumber: this._intervalNumber,
          intervalUnit: this._intervalUnit,
          patternOrdinal: this._patternOrdinal,
          patternDays: this._patternDays,
          endMode: this._endMode,
          endDate: this._endDate,
          endCount: this._endCount,
        });
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
            // Snapshot existing UIDs before creation so recurrence is attached
            // to the exact new item, even when task names are duplicated.
            const previousUids = rruleStr
              ? new Set((await this._listItemUids()).map((item) => item.uid))
              : null;
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
            if (rruleStr) {
              const newUid = await this._findCreatedItemUid(summary, previousUids);
              if (newUid) {
                await this.hass.callService("better_todo", "set_task_recurrence", {
                  entity_id: this.entityId, item: newUid, rrule: rruleStr,
                });
              } else {
                throw new Error("The new task was created, but its recurrence could not be set.");
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

                <!-- Friendly custom recurrence builder -->
                ${this._preset === "custom" ? html`
                  <div class="field">
                    <label class="lbl">${L("ui.common.type", "Repeat by")}</label>
                    <select
                      class="inp sel"
                      @change=${(e) => { this._customMode = e.target.value; }}
                      ?disabled=${this._saving}
                    >
                      <option value="time" ?selected=${this._customMode === "time"}>
                        ${L("ui.components.calendar.event.recurrence.interval", "Time interval")}
                      </option>
                      <option value="pattern" ?selected=${this._customMode === "pattern"}>
                        ${L("ui.components.calendar.event.recurrence.pattern", "Pattern")}
                      </option>
                    </select>
                  </div>

                  ${this._customMode === "time" ? html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.every", "Every")}</label>
                      <div class="inline-fields">
                        <input
                          class="inp compact-number"
                          type="number"
                          min="1"
                          .value=${this._intervalNumber}
                          @input=${(e) => { this._intervalNumber = e.target.value; }}
                          ?disabled=${this._saving}
                        />
                        <select
                          class="inp sel"
                          @change=${(e) => { this._intervalUnit = e.target.value; }}
                          ?disabled=${this._saving}
                        >
                          <option value="days" ?selected=${this._intervalUnit === "days"}>${L("ui.components.calendar.event.recurrence.days", "Days")}</option>
                          <option value="weeks" ?selected=${this._intervalUnit === "weeks"}>${L("ui.components.calendar.event.recurrence.weeks", "Weeks")}</option>
                          <option value="months" ?selected=${this._intervalUnit === "months"}>${L("ui.components.calendar.event.recurrence.months", "Months")}</option>
                          <option value="years" ?selected=${this._intervalUnit === "years"}>${L("ui.components.calendar.event.recurrence.years", "Years")}</option>
                        </select>
                      </div>
                    </div>
                  ` : html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.occurrence", "Occurrence")}</label>
                      <select
                        class="inp sel"
                        @change=${(e) => { this._patternOrdinal = e.target.value; }}
                        ?disabled=${this._saving}
                      >
                        <option value="1" ?selected=${this._patternOrdinal === "1"}>${L("ui.common.first", "First")}</option>
                        <option value="2" ?selected=${this._patternOrdinal === "2"}>${L("ui.common.second", "Second")}</option>
                        <option value="3" ?selected=${this._patternOrdinal === "3"}>${L("ui.common.third", "Third")}</option>
                        <option value="4" ?selected=${this._patternOrdinal === "4"}>${L("ui.common.fourth", "Fourth")}</option>
                        <option value="-1" ?selected=${this._patternOrdinal === "-1"}>${L("ui.common.last", "Last")}</option>
                      </select>
                    </div>
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.repeat.on", "Weekdays")}</label>
                      <select
                        class="inp multi-select"
                        multiple
                        size="7"
                        @change=${(e) => {
                          this._patternDays = [...e.target.selectedOptions].map(
                            (option) => option.value
                          );
                        }}
                        ?disabled=${this._saving}
                      >
                        ${DAYS.map((d) => html`
                          <option value=${d.k} ?selected=${this._patternDays.includes(d.k)}>
                            ${d.label}
                          </option>
                        `)}
                      </select>
                    </div>
                  `}
                ` : ""}

                ${this._preset !== "none" ? html`
                  <div class="field">
                    <label class="lbl">${L("ui.components.calendar.event.recurrence.ends", "Ends")}</label>
                    <select
                      class="inp sel"
                      @change=${(e) => { this._endMode = e.target.value; }}
                      ?disabled=${this._saving}
                    >
                      <option value="never" ?selected=${this._endMode === "never"}>${L("ui.components.calendar.event.recurrence.never", "Never")}</option>
                      <option value="date" ?selected=${this._endMode === "date"}>${L("ui.components.calendar.event.recurrence.on_date", "On a date")}</option>
                      <option value="count" ?selected=${this._endMode === "count"}>${L("ui.components.calendar.event.recurrence.after_count", "After a number of repetitions")}</option>
                    </select>
                  </div>
                  ${this._endMode === "date" ? html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.end_date", "End date")}</label>
                      <input class="inp" type="date" .value=${this._endDate}
                        @input=${(e) => { this._endDate = e.target.value; }}
                        ?disabled=${this._saving} />
                    </div>
                  ` : ""}
                  ${this._endMode === "count" ? html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.repetitions", "Repetitions")}</label>
                      <input class="inp" type="number" min="1" .value=${this._endCount}
                        @input=${(e) => { this._endCount = e.target.value; }}
                        ?disabled=${this._saving} />
                    </div>
                  ` : ""}
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
                  ?disabled=${!this._summary.trim() || this._saving
                    || (this._preset === "custom" && this._customMode === "pattern"
                      && !this._patternDays.length)
                    || (this._preset !== "none" && this._endMode === "date"
                      && !this._endDate)}
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

          .inline-fields {
            display: grid;
            grid-template-columns: minmax(88px, 0.35fr) 1fr;
            gap: 8px;
          }

          .compact-number { min-width: 0; }

          .multi-select {
            min-height: 150px;
            padding: 4px;
          }

          .multi-select option {
            padding: 7px 9px;
            border-radius: 5px;
          }

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
        // Discard late WebSocket responses after switching lists or starting a
        // newer refresh. Without this, a slow response can replace the items
        // belonging to the list that is currently visible.
        this._fetchSequence = 0;
        // Prevent repeated clicks from issuing duplicate remove_item calls.
        this._deleting = new Set();
      }

      async _fetchItems() {
        if (!this.hass || !this.entityId) return;
        const entityId = this.entityId;
        const fetchSequence = ++this._fetchSequence;
        this._loading = true;
        try {
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: entityId,
          });
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._items = res?.items || [];
          }
        } catch {
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._items = [];
          }
        } finally {
          if (fetchSequence === this._fetchSequence) {
            this._loading = false;
          }
        }
      }

      updated(changedProps) {
        super.updated(changedProps);
        // Full reset when the displayed list changes.
        if (changedProps.has("entityId")) {
          this._fetchSequence++;
          this._items    = [];
          this._stateKey = null;
          this._fetchItems();
          return;
        }
        // Re-fetch whenever the entity's state fingerprint changes (e.g. an item
        // was added / completed / deleted from outside this panel).
        if (changedProps.has("hass") && this.hass) {
          const s = this.hass.states[this.entityId];
          // last_changed does not move for attribute-only/item-detail updates.
          // last_updated ensures those external edits refresh the card too.
          const key = s ? `${s.last_updated}|${s.state}` : null;
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
        } catch { /* ignore */ }
      }

      async _delete(uid, ev) {
        ev.stopPropagation();
        if (this._deleting.has(uid)) return;
        this._deleting.add(uid);
        try {
          // Verify the item still exists before invoking remove_item. A card can
          // retain a stale row when an item was deleted elsewhere without
          // changing the todo entity state; calling the service for that row
          // makes Home Assistant respond with item_not_found.
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: this.entityId,
          });
          const currentItems = res?.items || [];
          if (!currentItems.some((item) => item.uid === uid)) {
            this._items = currentItems;
            return;
          }

          // Remove the row immediately instead of waiting for a state update.
          // Todo item changes do not always alter the entity state fingerprint.
          this._items = currentItems.filter((item) => item.uid !== uid);
          await this.hass.callService("todo", "remove_item", {
            entity_id: this.entityId, item: uid,
          });
        } catch {
          // Restore the authoritative list if deletion failed for any reason.
          await this._fetchItems();
        } finally {
          this._deleting.delete(uid);
        }
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
        this._fetchSequence = 0;
      }

      async _fetchItems() {
        if (!this.hass || !this.entityId) return;
        const entityId = this.entityId;
        const fetchSequence = ++this._fetchSequence;
        this._loading = true;
        try {
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: entityId,
          });
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._items = res?.items || [];
          }
        } catch {
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._items = [];
          }
        } finally {
          if (fetchSequence === this._fetchSequence) {
            this._loading = false;
          }
        }
      }

      updated(changedProps) {
        super.updated(changedProps);
        if (changedProps.has("entityId")) {
          this._fetchSequence++;
          this._items    = [];
          this._stateKey = null;
          this._fetchItems();
          return;
        }
        if (changedProps.has("hass") && this.hass) {
          const s   = this.hass.states[this.entityId];
          const key = s ? `${s.last_updated}|${s.state}` : null;
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
        } catch { /* ignore */ }
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
        } catch {
          this._selectedEntityId = null;
        }
        this._resizeObserver = null;
        this._mql = null;
        this._onMqlChange = null;
        this._todoListsCache = [];
        this._todoStateRefs = new Map();
        this._entityRegistryRef = null;
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
        const registryChanged = this.hass.entities !== this._entityRegistryRef;
        const statesChanged =
          entities.length !== this._todoStateRefs.size ||
          entities.some((state) => this._todoStateRefs.get(state.entity_id) !== state);

        if (!registryChanged && !statesChanged) {
          return this._todoListsCache;
        }

        entities.sort((a, b) => {
          const aShop = this._isShoppingList(a.entity_id);
          const bShop = this._isShoppingList(b.entity_id);
          if (aShop && !bShop) return 1;
          if (!aShop && bShop) return -1;
          return _computeStateName(a).localeCompare(_computeStateName(b));
        });
        this._todoListsCache = entities;
        this._todoStateRefs = new Map(
          entities.map((state) => [state.entity_id, state])
        );
        this._entityRegistryRef = this.hass.entities;
        return this._todoListsCache;
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

      // -----------------------------------------------------------------------
      // Event handlers
      // -----------------------------------------------------------------------

      _setSelectedEntity(entityId) {
        this._selectedEntityId = entityId;
        // On narrow screens, close the mobile list selector after picking a list.
        this._paneOnMobile = false;
        try {
          sessionStorage.setItem("better-todo-selected-entity", entityId);
        } catch {
          // ignore
        }
      }

      /** Navigate back to the list selector on narrow screens. */
      _backToLists() {
        this._paneOnMobile = true;
      }

      /** Open the Better To-do config flow to create a new list.
       *  Dispatches the same show-dialog event that ha-panel-todo uses so that
       *  HA's app shell opens the standard config-flow dialog inline. */
      _addList() {
        this.dispatchEvent(
          new CustomEvent("show-dialog", {
            bubbles: true,
            composed: true,
            detail: {
              dialogTag: "ha-config-flow",
              // Resolve immediately if the dialog element is already registered;
              // otherwise wait up to 2 s for HA to register it (it is loaded
              // lazily by the config/integrations section).
              dialogImport: () =>
                customElements.get("ha-config-flow")
                  ? Promise.resolve()
                  : Promise.race([
                      customElements
                        .whenDefined("ha-config-flow")
                        .then(() => {}),
                      new Promise((resolve) => {
                        setTimeout(resolve, 2000);
                      }),
                    ]),
              dialogParams: {
                startFlowHandler: "better_todo",
                showAdvanced: this.hass?.userData?.showAdvanced ?? false,
              },
            },
          })
        );
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

      // -----------------------------------------------------------------------
      // Rendering
      // -----------------------------------------------------------------------

      render() {
        const lists = this._getTodoLists();

        // Reusable helper so each call site gets independent TemplateResult
        // instances (Lit must not share a single instance across two DOM slots).
        const makeListItems = () =>
          lists.map(
            (list) => html`
              <ha-list-item
                graphic="icon"
                .activated=${list.entity_id === this._selectedEntityId}
                @click=${() => this._setSelectedEntity(list.entity_id)}
              >
                <ha-state-icon
                  .stateObj=${list}
                  slot="graphic"
                ></ha-state-icon>
                ${_computeStateName(list)}
              </ha-list-item>
            `
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
            ? _computeStateName(this.hass.states[this._selectedEntityId])
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
