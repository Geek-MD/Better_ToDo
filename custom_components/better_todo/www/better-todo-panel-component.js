/**
 * Better ToDo Custom Panel Component
 * 
 * This creates a custom frontend panel (not a Lovelace dashboard) that displays
 * Better ToDo lists with full task management capabilities.
 * 
 * Structure:
 * - Left sidebar: List of all Better ToDo lists
 * - Main area: Tasks from the selected list with full CRUD operations
 * 
 * Note: As of v0.9.0, Better ToDo entities no longer inherit from TodoListEntity,
 * so we use custom rendering instead of native hui-todo-list-card.
 */

const BETTER_TODO_VERSION = "0.9.0";

// Enable detailed logging for debugging
const DEBUG_MODE = true;

function debugLog(message, ...args) {
  if (DEBUG_MODE) {
    console.log(`[Better ToDo Panel] ${message}`, ...args);
  }
}

function errorLog(message, ...args) {
  console.error(`[Better ToDo Panel ERROR] ${message}`, ...args);
}

class BetterTodoPanel extends HTMLElement {
  constructor() {
    super();
    this.hass = null;
    this._selectedEntityId = null;
  }

  setConfig(config) {
    // Panel configuration
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._initialized = true;
      debugLog('Initializing Better ToDo Panel');
      this._render();
    } else {
      this._updateContent();
    }
  }

  get hass() {
    return this._hass;
  }

  /**
   * Get all Better ToDo entities
   */
  _getBetterTodoEntities() {
    if (!this._hass) {
      debugLog('Cannot get entities: hass not available');
      return [];
    }
    
    const entities = [];
    Object.keys(this._hass.states).forEach(entityId => {
      if (entityId.startsWith('todo.')) {
        const state = this._hass.states[entityId];
        // Check if this is a Better ToDo entity by checking for recurrence_data attribute
        if (state.attributes && state.attributes.recurrence_data !== undefined) {
          entities.push(entityId);
          debugLog(`Found Better ToDo entity: ${entityId}`, state);
        }
      }
    });
    
    debugLog(`Found ${entities.length} Better ToDo entities total`);
    return entities.sort();
  }

  /**
   * Initial render of the panel
   */
  _render() {
    if (!this._hass) {
      errorLog('Cannot render: hass not available');
      return;
    }

    debugLog('Rendering Better ToDo Panel');
    const entities = this._getBetterTodoEntities();
    
    // Auto-select first entity if none selected
    if (!this._selectedEntityId && entities.length > 0) {
      this._selectedEntityId = entities[0];
      debugLog(`Auto-selected entity: ${this._selectedEntityId}`);
    }

    this.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          background-color: var(--primary-background-color);
        }
        .better-todo-container {
          display: flex;
          height: 100%;
        }
        .sidebar {
          width: 300px;
          border-right: 1px solid var(--divider-color);
          overflow-y: auto;
          background-color: var(--sidebar-background-color, var(--card-background-color));
        }
        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid var(--divider-color);
        }
        .sidebar-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 500;
        }
        .list-item {
          padding: 12px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background-color 0.2s;
          border-bottom: 1px solid var(--divider-color);
        }
        .list-item:hover {
          background-color: var(--secondary-background-color);
        }
        .list-item.selected {
          background-color: var(--primary-color);
          color: var(--text-primary-color);
        }
        .list-item ha-icon {
          margin-right: 12px;
          --mdc-icon-size: 24px;
        }
        .list-item-content {
          flex: 1;
        }
        .list-item-name {
          font-weight: 500;
        }
        .list-item-count {
          font-size: 0.9em;
          opacity: 0.7;
          margin-top: 2px;
        }
        .main-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .main-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .main-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 400;
        }
        .empty-state {
          text-align: center;
          padding: 48px 16px;
          color: var(--secondary-text-color);
        }
        .empty-state ha-icon {
          --mdc-icon-size: 64px;
          opacity: 0.3;
        }
      </style>
      <div class="better-todo-container">
        <div class="sidebar">
          <div class="sidebar-header">
            <h2>Better ToDo</h2>
          </div>
          <div id="lists-container"></div>
        </div>
        <div class="main-content">
          <div id="content-container"></div>
        </div>
      </div>
    `;

    this._updateContent();
  }

  /**
   * Update the panel content
   */
  _updateContent() {
    const listsContainer = this.querySelector('#lists-container');
    const contentContainer = this.querySelector('#content-container');
    
    if (!listsContainer || !contentContainer) {
      errorLog('Container elements not found');
      return;
    }

    debugLog('Updating panel content');
    const entities = this._getBetterTodoEntities();

    // Render lists sidebar
    if (entities.length === 0) {
      listsContainer.innerHTML = `
        <div class="empty-state">
          <ha-icon icon="mdi:format-list-checks"></ha-icon>
          <p>No Better ToDo lists found</p>
          <p>Add a list in Settings → Integrations</p>
        </div>
      `;
      contentContainer.innerHTML = '';
      return;
    }

    listsContainer.innerHTML = entities.map(entityId => {
      const state = this._hass.states[entityId];
      const name = state.attributes.friendly_name || entityId;
      const items = state.attributes.todo_items || [];
      const activeCount = items.filter(item => item.status !== 'completed').length;
      const isSelected = entityId === this._selectedEntityId;

      return `
        <div class="list-item ${isSelected ? 'selected' : ''}" data-entity="${entityId}">
          <ha-icon icon="mdi:format-list-checks"></ha-icon>
          <div class="list-item-content">
            <div class="list-item-name">${name}</div>
            <div class="list-item-count">${activeCount} active</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers to list items
    listsContainer.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        this._selectedEntityId = item.dataset.entity;
        this._updateContent();
      });
    });

    // Render main content with native todo-list card
    if (this._selectedEntityId) {
      const state = this._hass.states[this._selectedEntityId];
      const name = state.attributes.friendly_name || this._selectedEntityId;

      contentContainer.innerHTML = `
        <div class="main-header">
          <h1>${name}</h1>
        </div>
        <div id="todo-card-container"></div>
      `;

      // Create native todo-list card
      const cardContainer = contentContainer.querySelector('#todo-card-container');
      const card = document.createElement('hui-todo-list-card');
      card.setConfig({
        type: 'todo-list',
        entity: this._selectedEntityId,
      });
      card.hass = this._hass;
      cardContainer.appendChild(card);
    }
  }
}

customElements.define('better-todo-panel', BetterTodoPanel);

console.info(
  `%c BETTER-TODO-PANEL %c v${BETTER_TODO_VERSION} `,
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
