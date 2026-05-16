import "./better-todo-card.js";
import { getBetterTodoEntities, getEntityName, escapeHtml } from "./better-todo-shared.js";

const STORAGE_KEY = "better_todo_selected_entity";

class BetterTodoPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._entityId = "";
  }

  set hass(hass) {
    this._hass = hass;
    const entities = getBetterTodoEntities(hass);
    const requestedEntity = new URLSearchParams(window.location.search).get("entity_id");
    const storedEntity = window.localStorage.getItem(STORAGE_KEY);
    const activeEntity =
      requestedEntity ||
      (storedEntity && entities.some((entity) => entity.entity_id === storedEntity)
        ? storedEntity
        : "") ||
      entities[0]?.entity_id ||
      "";

    if (activeEntity !== this._entityId) {
      this._entityId = activeEntity;
      if (activeEntity) {
        window.localStorage.setItem(STORAGE_KEY, activeEntity);
      }
    }

    this.render();
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

    const entities = getBetterTodoEntities(this._hass);
    const entityState = this._entityId ? this._hass?.states?.[this._entityId] : undefined;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          min-height: 100vh;
          background: var(--primary-background-color, #f4f7fb);
          color: var(--primary-text-color, #111);
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
          min-height: 100vh;
        }

        .sidebar {
          border-right: 1px solid var(--divider-color, #d9dee5);
          background: var(--card-background-color, #fff);
          padding: 20px 16px;
        }

        .sidebar h1 {
          margin: 0 0 6px;
          font-size: 1.35rem;
        }

        .sidebar p {
          margin: 0 0 16px;
          color: var(--secondary-text-color, #666);
        }

        .list {
          display: grid;
          gap: 8px;
        }

        .list button {
          border: 1px solid var(--divider-color, #d9dee5);
          border-radius: 12px;
          background: transparent;
          color: inherit;
          padding: 12px;
          text-align: left;
          cursor: pointer;
        }

        .list button.active {
          background: rgba(33, 150, 243, 0.12);
          border-color: var(--primary-color, #1d74c9);
        }

        .entity-name {
          font-weight: 600;
        }

        .entity-meta {
          margin-top: 4px;
          color: var(--secondary-text-color, #666);
          font-size: 0.9rem;
        }

        .content {
          padding: 20px;
        }

        .content-header {
          margin-bottom: 16px;
        }

        .content-header h2 {
          margin: 0;
          font-size: 1.4rem;
        }

        .content-header p {
          margin: 6px 0 0;
          color: var(--secondary-text-color, #666);
        }

        .empty {
          display: grid;
          place-items: center;
          min-height: 50vh;
          color: var(--secondary-text-color, #666);
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            border-right: 0;
            border-bottom: 1px solid var(--divider-color, #d9dee5);
          }
        }
      </style>
      <div class="layout">
        <aside class="sidebar">
          <h1>Better To-do</h1>
          <p>Custom panel with the same split layout style as the HA To-do panel.</p>
          <div class="list">
            ${
              entities.length
                ? entities
                    .map(
                      (entity) => `
                        <button
                          type="button"
                          class="${entity.entity_id === this._entityId ? "active" : ""}"
                          data-entity="${escapeHtml(entity.entity_id)}"
                        >
                          <div class="entity-name">${escapeHtml(getEntityName(entity))}</div>
                          <div class="entity-meta">${escapeHtml(String(entity.state || 0))} pending</div>
                        </button>
                      `
                    )
                    .join("")
                : `<div class="empty">Create a Better To-do list to use this panel.</div>`
            }
          </div>
        </aside>
        <main class="content">
          ${
            entityState
              ? `
                  <div class="content-header">
                    <h2>${escapeHtml(getEntityName(entityState))}</h2>
                    <p>Tasks, recurrence, metadata, and notes from a single Better To-do workspace.</p>
                  </div>
                  <better-todo-card id="workspace-card"></better-todo-card>
                `
              : `<div class="empty">Select a Better To-do list from the sidebar.</div>`
          }
        </main>
      </div>
    `;

    this.shadowRoot.querySelectorAll("[data-entity]").forEach((button) => {
      button.addEventListener("click", () => {
        const entityId = button.getAttribute("data-entity");
        if (entityId) {
          this._setEntity(entityId);
        }
      });
    });

    const card = this.shadowRoot.getElementById("workspace-card");
    if (card) {
      card.panel = true;
      card.entityId = this._entityId;
      card.hass = this._hass;
    }
  }
}

customElements.define("better-todo-panel", BetterTodoPanel);
