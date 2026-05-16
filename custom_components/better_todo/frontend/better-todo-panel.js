import "./better-todo-card.js";
import { getBetterTodoEntities, getEntityName, escapeHtml } from "./better-todo-shared.js";

const STORAGE_KEY = "better_todo_selected_entity";

class BetterTodoPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._entityId = "";
    this._rendered = false;
    this._entityListSignature = "";
  }

  set hass(hass) {
    this._hass = hass;
    const entities = getBetterTodoEntities(hass);
    const nextListSignature = entities.map((entity) => entity.entity_id).join(",");
    const requestedEntity = new URLSearchParams(window.location.search).get("entity_id");
    const storedEntity = window.localStorage.getItem(STORAGE_KEY);
    const activeEntity =
      requestedEntity ||
      (storedEntity && entities.some((entity) => entity.entity_id === storedEntity)
        ? storedEntity
        : "") ||
      entities[0]?.entity_id ||
      "";

    const entityChanged = activeEntity !== this._entityId;
    if (entityChanged) {
      this._entityId = activeEntity;
      if (activeEntity) {
        window.localStorage.setItem(STORAGE_KEY, activeEntity);
      }
    }

    if (!this._rendered || entityChanged || this._entityListSignature !== nextListSignature) {
      this._entityListSignature = nextListSignature;
      this.render();
      return;
    }

    this._syncLeftPane(entities);
    this._syncRightPane();
  }

  set narrow(value) {
    this._narrow = Boolean(value);
    this.render();
  }

  _setEntity(entityId) {
    this._entityId = entityId;
    window.localStorage.setItem(STORAGE_KEY, entityId);
    const url = new URL(window.location.href);
    url.searchParams.set("entity_id", entityId);
    window.history.replaceState({}, "", url);
    this.render();
  }

  render() {
    if (!this.shadowRoot) {
      return;
    }

    this._rendered = true;
    const entities = getBetterTodoEntities(this._hass);
    this._entityListSignature = entities.map((entity) => entity.entity_id).join(",");
    const entityState = this._entityId ? this._hass?.states?.[this._entityId] : undefined;
    const showPane = !this._narrow;

    this.shadowRoot.innerHTML = `
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

        .pane-list {
          display: grid;
          gap: 8px;
          padding: 8px;
        }

        .entity-button {
          border: 1px solid var(--divider-color);
          border-radius: 10px;
          background: transparent;
          color: inherit;
          text-align: left;
          padding: 10px 12px;
          cursor: pointer;
          font: inherit;
        }

        .entity-button.active {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 12%, transparent);
        }

        .entity-name {
          font-weight: 600;
        }

        .entity-meta {
          margin-top: 4px;
          color: var(--secondary-text-color);
          font-size: 0.9rem;
        }

        .empty {
          color: var(--secondary-text-color);
          padding: 12px 0;
        }
      </style>
      <ha-two-pane-top-app-bar-fixed id="layout" footer>
        <ha-menu-button id="menu" slot="navigationIcon"></ha-menu-button>
        <div slot="title">${showPane ? "Better ToDo" : ""}</div>
        <ha-list slot="pane" class="pane-list">
          ${
            entities.length
              ? `
                  ${entities
                    .map(
                      (entity) => `
                        <button
                          type="button"
                          class="entity-button ${entity.entity_id === this._entityId ? "active" : ""}"
                          data-entity="${escapeHtml(entity.entity_id)}"
                        >
                          <div class="entity-name">${escapeHtml(getEntityName(entity))}</div>
                          <div class="entity-meta">${escapeHtml(String(entity.state || 0))} pending</div>
                        </button>
                      `
                    )
                    .join("")}
                `
              : `<div class="empty">Create a Better To-do list to use this panel.</div>`
          }
        </ha-list>
        <div id="columns">
          <div class="column">
            ${
              entityState
                ? `<better-todo-card id="workspace-card"></better-todo-card>`
                : `<div class="empty">Select a Better To-do list from the sidebar.</div>`
            }
          </div>
        </div>
      </ha-two-pane-top-app-bar-fixed>
    `;

    const layout = this.shadowRoot.getElementById("layout");
    if (layout) {
      layout.pane = showPane;
      layout.narrow = Boolean(this._narrow);
    }

    const menu = this.shadowRoot.getElementById("menu");
    if (menu) {
      menu.hass = this._hass;
      menu.narrow = Boolean(this._narrow);
    }

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => {
      button.addEventListener("click", () => {
        const entityId = button.getAttribute("data-entity");
        if (entityId) {
          this._setEntity(entityId);
        }
      });
    });

    this._syncRightPane();
  }

  _syncLeftPane(entities) {
    const byId = new Map(entities.map((entity) => [entity.entity_id, entity]));
    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => {
      const entityId = button.getAttribute("data-entity");
      if (!entityId) {
        return;
      }

      button.classList.toggle("active", entityId === this._entityId);
      const entity = byId.get(entityId);
      if (!entity) {
        return;
      }

      const nameEl = button.querySelector(".entity-name");
      if (nameEl) {
        nameEl.textContent = getEntityName(entity);
      }

      const metaEl = button.querySelector(".entity-meta");
      if (metaEl) {
        metaEl.textContent = `${String(entity.state || 0)} pending`;
      }
    });
  }

  _syncRightPane() {
    const card = this.shadowRoot.getElementById("workspace-card");
    if (card) {
      card.panel = true;
      card.entityId = this._entityId;
      card.hass = this._hass;
    }
  }
}

customElements.define("better-todo-panel", BetterTodoPanel);
