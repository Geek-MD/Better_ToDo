import "./better-todo-card.js";
import { getBetterTodoEntities, getEntityName, escapeHtml } from "./better-todo-shared.js";
// ── MDI icon paths (from @mdi/js) ─────────────────────────────────────────
const MDI_DOTS_VERTICAL = "M12,16A2,2 0 0,1 14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18A2,2 0 0,1 12,16M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10M12,4A2,2 0 0,1 14,6A2,2 0 0,1 12,8A2,2 0 0,1 10,6A2,2 0 0,1 12,4Z";
const MDI_PLUS = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";
const MDI_CHEVRON_DOWN = "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z";
const STORAGE_KEY = "better_todo_selected_entity";
// ── BetterTodoPanel web component ─────────────────────────────────────────
class BetterTodoPanel extends HTMLElement {
    constructor() {
        super();
        // ── Event handlers ────────────────────────────────────────────────────
        this._handleMqlChange = (ev) => {
            this._mobile = ev.matches;
            if (this._initialized)
                this._syncTitle();
        };
        this.attachShadow({ mode: "open" });
        this._hass = null;
        this._entityId = undefined;
        this._narrow = false;
        this._mobile = false;
        this._showPane = false;
        this._initialized = false;
        this._mql = null;
        this._resizeObserver = null;
        this._entityListSignature = "";
    }
    // ── Lifecycle ─────────────────────────────────────────────────────────
    connectedCallback() {
        this._mql = window.matchMedia("(max-width: 450px), all and (max-height: 500px)");
        this._mobile = this._mql.matches;
        this._mql.addEventListener("change", this._handleMqlChange);
    }
    disconnectedCallback() {
        this._mql?.removeEventListener("change", this._handleMqlChange);
        this._mql = null;
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
    }
    // ── External property setters ──────────────────────────────────────────
    set narrow(value) {
        this._narrow = Boolean(value);
        if (!this._initialized)
            return;
        const layout = this.shadowRoot.getElementById("layout");
        if (layout)
            layout.narrow = this._narrow;
        const menu = this.shadowRoot.getElementById("menu");
        if (menu)
            menu.narrow = this._narrow;
    }
    set hass(hass) {
        this._hass = hass;
        const entities = getBetterTodoEntities(hass);
        const sig = entities.map((e) => e.entity_id).join(",");
        const urlEntityId = new URLSearchParams(window.location.search).get("entity_id");
        const storedEntity = window.localStorage.getItem(STORAGE_KEY);
        let active;
        if (urlEntityId && entities.some((e) => e.entity_id === urlEntityId)) {
            active = urlEntityId;
        }
        else if (storedEntity && entities.some((e) => e.entity_id === storedEntity)) {
            active = storedEntity;
        }
        else {
            active = entities[0]?.entity_id;
        }
        const entityChanged = active !== this._entityId;
        if (entityChanged) {
            this._entityId = active;
            if (active) {
                window.localStorage.setItem(STORAGE_KEY, active);
                const url = new URL(window.location.href);
                url.searchParams.set("entity_id", active);
                window.history.replaceState({}, "", url);
            }
        }
        if (!this._initialized) {
            this._entityListSignature = sig;
            this._init(entities);
            return;
        }
        const listChanged = sig !== this._entityListSignature;
        this._entityListSignature = sig;
        if (listChanged || entityChanged) {
            this._syncPane(entities);
            this._syncTitle(entities);
        }
        this._syncCard();
        this._syncMenu();
    }
    // ── Initialisation (runs once on first hass set) ─────────────────────
    _init(entities) {
        this._initialized = true;
        // Mirror HA panel's showPane initialisation: default to !narrow so the
        // title bar and two-pane layout render correctly on first paint.
        this._showPane = !this._narrow;
        const root = this.shadowRoot;
        root.innerHTML = `
      <style>
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
        ha-dropdown.lists {
          display: inline-block;
          max-width: 100%;
        }
        ha-dropdown.lists ha-button {
          --ha-font-size-m: var(--ha-font-size-l);
        }
        ha-dropdown.lists ha-button div {
          text-overflow: ellipsis;
          width: 100%;
          overflow: hidden;
          white-space: nowrap;
          display: block;
        }
        ha-dropdown.lists ha-dropdown-item {
          max-width: 80vw;
        }
        .fab {
          position: fixed;
          right: calc(16px + var(--safe-area-inset-right, 0px));
          bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
          inset-inline-end: calc(16px + var(--safe-area-inset-right, 0px));
          inset-inline-start: initial;
          --ha-button-box-shadow: var(--ha-box-shadow-l);
        }
      </style>
      <ha-two-pane-top-app-bar-fixed id="layout" footer>
        <ha-menu-button id="menu" slot="navigationIcon"></ha-menu-button>
        <div slot="title" id="title-slot"></div>
        <ha-list slot="pane" id="entity-list" activatable></ha-list>
        <ha-dropdown slot="actionItems" id="action-dropdown">
          <ha-icon-button id="action-trigger" slot="trigger" label=""></ha-icon-button>
          <ha-dropdown-item value="add">
            <ha-svg-icon id="dropdown-add-icon" slot="icon"></ha-svg-icon>
            Add item
          </ha-dropdown-item>
        </ha-dropdown>
        <div id="columns">
          <div class="column">
            <better-todo-card id="workspace-card"></better-todo-card>
          </div>
        </div>
        <ha-button id="fab" class="fab" size="large" style="display:none">
          <ha-svg-icon id="fab-icon" slot="start"></ha-svg-icon>
          Add item
        </ha-button>
      </ha-two-pane-top-app-bar-fixed>
    `;
        // Set icon paths (property bindings, not attributes)
        root.getElementById("action-trigger").path = MDI_DOTS_VERTICAL;
        root.getElementById("fab-icon").path = MDI_PLUS;
        root.getElementById("dropdown-add-icon").path = MDI_PLUS;
        // Menu button
        const menu = root.getElementById("menu");
        menu.hass = this._hass ?? undefined;
        menu.narrow = this._narrow;
        // Layout – set both narrow and pane immediately so ha-two-pane-top-app-bar-fixed
        // renders the title bar and correct layout on the very first paint.
        const layout = root.getElementById("layout");
        layout.narrow = this._narrow;
        layout.pane = this._showPane;
        // ResizeObserver – drives the two-pane breakpoint (mirrors HA panel @ 750 px)
        this._resizeObserver = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width ?? 0;
            const showPane = w > 750;
            if (showPane !== this._showPane) {
                this._showPane = showPane;
                layout.pane = showPane;
                this._syncTitle();
            }
        });
        this._resizeObserver.observe(layout);
        // FAB
        root.getElementById("fab").addEventListener("click", () => this._addItem());
        // Action dropdown (wa-select fires when an item is chosen)
        root
            .getElementById("action-dropdown")
            .addEventListener("wa-select", (ev) => this._handleAction(ev));
        // Initial content
        this._syncPane(entities);
        this._syncTitle(entities);
        this._syncCard();
    }
    // ── Incremental sync helpers ──────────────────────────────────────────
    /** Rebuild the left pane entity list without touching the right pane. */
    _syncPane(entities) {
        const list = this.shadowRoot.getElementById("entity-list");
        if (!list)
            return;
        if (!entities.length) {
            list.innerHTML =
                `<ha-list-item noninteractive>` +
                    `Create a Better To-do list to use this panel.` +
                    `</ha-list-item>`;
            return;
        }
        list.innerHTML = entities
            .map((entity) => `<ha-list-item
            data-entity="${escapeHtml(entity.entity_id)}"
            graphic="icon"
            ${entity.entity_id === this._entityId ? "activated" : ""}
          >
            <ha-state-icon
              slot="graphic"
              data-icon="${escapeHtml(entity.entity_id)}"
            ></ha-state-icon>
            ${escapeHtml(getEntityName(entity))}
          </ha-list-item>`)
            .join("");
        // Set stateObj on ha-state-icon (must be a property, not an attribute)
        list.querySelectorAll("[data-icon]").forEach((icon) => {
            const eid = icon.getAttribute("data-icon");
            const entity = entities.find((e) => e.entity_id === eid);
            if (entity)
                icon.stateObj = entity;
        });
        // Click handlers
        list.querySelectorAll("[data-entity]").forEach((item) => {
            item.addEventListener("click", () => {
                const eid = item.getAttribute("data-entity");
                if (eid)
                    this._setEntity(eid);
            });
        });
    }
    /**
     * Update the title slot:
     *  – narrow/mobile → ha-dropdown with entity list (mirrors HA panel)
     *  – wide           → plain "Better ToDo" text
     */
    _syncTitle(entities) {
        const titleSlot = this.shadowRoot.getElementById("title-slot");
        if (!titleSlot)
            return;
        if (!this._showPane) {
            const ents = entities ?? getBetterTodoEntities(this._hass);
            const entityState = this._entityId
                ? this._hass?.states?.[this._entityId]
                : undefined;
            const displayName = entityState
                ? getEntityName(entityState)
                : (this._entityId ?? "");
            titleSlot.innerHTML = `
        <ha-dropdown class="lists">
          <ha-button slot="trigger">
            <div>${escapeHtml(displayName)}</div>
            <ha-svg-icon slot="end" id="title-chevron"></ha-svg-icon>
          </ha-button>
          ${ents
                .map((e) => `<ha-dropdown-item
                  value="${escapeHtml(e.entity_id)}"
                  data-entity="${escapeHtml(e.entity_id)}"
                  ${e.entity_id === this._entityId ? "selected" : ""}
                >
                  <ha-state-icon
                    slot="icon"
                    data-icon="${escapeHtml(e.entity_id)}"
                  ></ha-state-icon>
                  ${escapeHtml(getEntityName(e))}
                </ha-dropdown-item>`)
                .join("")}
        </ha-dropdown>
      `;
            titleSlot.querySelector("#title-chevron").path = MDI_CHEVRON_DOWN;
            titleSlot.querySelectorAll("[data-icon]").forEach((icon) => {
                const eid = icon.getAttribute("data-icon");
                const entity = ents.find((e) => e.entity_id === eid);
                if (entity)
                    icon.stateObj = entity;
            });
            titleSlot.querySelectorAll("[data-entity]").forEach((item) => {
                item.addEventListener("click", () => {
                    const eid = item.getAttribute("data-entity");
                    if (eid)
                        this._setEntity(eid);
                });
            });
        }
        else {
            titleSlot.textContent = "Better ToDo";
        }
    }
    /**
     * Update the card's properties only – never recreates the element,
     * which is the key fix for tasks disappearing during hass updates.
     */
    _syncCard() {
        const card = this.shadowRoot.getElementById("workspace-card");
        if (card) {
            card.panel = true;
            card.entityId = this._entityId ?? null;
            card.hass = this._hass ?? undefined;
        }
        // FAB is only useful when there is a selected entity
        const fab = this.shadowRoot.getElementById("fab");
        if (fab) {
            const hasEntity = Boolean(this._entityId && this._hass?.states?.[this._entityId]);
            fab.style.display = hasEntity ? "" : "none";
        }
    }
    _syncMenu() {
        const menu = this.shadowRoot.getElementById("menu");
        if (menu)
            menu.hass = this._hass ?? undefined;
    }
    _setEntity(entityId) {
        if (entityId === this._entityId)
            return;
        this._entityId = entityId;
        window.localStorage.setItem(STORAGE_KEY, entityId);
        const url = new URL(window.location.href);
        url.searchParams.set("entity_id", entityId);
        window.history.replaceState({}, "", url);
        if (this._initialized) {
            const entities = getBetterTodoEntities(this._hass);
            this._syncPane(entities);
            this._syncTitle(entities);
            this._syncCard();
        }
    }
    _addItem() {
        const card = this.shadowRoot.getElementById("workspace-card");
        if (card && typeof card.openAddForm === "function") {
            card.openAddForm();
        }
    }
    _handleAction(ev) {
        const action = ev.detail?.item?.value;
        if (action === "add")
            this._addItem();
    }
}
customElements.define("better-todo-panel", BetterTodoPanel);
