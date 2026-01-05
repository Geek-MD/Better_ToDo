/**
 * Better ToDo List Card
 * 
 * A custom card that replicates the native Home Assistant todo-list card functionality
 * but works with Better ToDo entities that don't inherit from TodoListEntity.
 * 
 * This card provides full CRUD operations using Better ToDo's custom services:
 * - better_todo.create_task
 * - better_todo.update_task
 * - better_todo.delete_task
 * 
 * The card replicates the native todo-list card UI/UX exactly.
 */

const BETTER_TODO_LIST_CARD_VERSION = "0.9.0";
const DEBUG_MODE = true;

function debugLog(message, ...args) {
  if (DEBUG_MODE) {
    console.log(`[Better ToDo List Card] ${message}`, ...args);
  }
}

function errorLog(message, ...args) {
  console.error(`[Better ToDo List Card ERROR] ${message}`, ...args);
}

class BetterTodoListCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._entityId = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    
    this._config = config;
    this._entityId = config.entity;
    
    debugLog('Card configured for entity:', this._entityId);
    this.render();
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 5;
  }

  render() {
    if (!this._hass || !this._entityId) {
      debugLog('Cannot render: hass or entityId not available');
      return;
    }

    const entityState = this._hass.states[this._entityId];
    if (!entityState) {
      errorLog('Entity not found:', this._entityId);
      this.innerHTML = `
        <ha-card>
          <div class="card-content">
            <p>Entity ${this._entityId} not found</p>
          </div>
        </ha-card>
      `;
      return;
    }

    debugLog('Rendering card for entity:', this._entityId, entityState);

    const title = this._config.title || entityState.attributes.friendly_name || this._entityId;
    const items = entityState.attributes.items || [];
    const activeItems = items.filter(item => item.status !== 'completed');
    const completedItems = items.filter(item => item.status === 'completed');

    this.innerHTML = `
      <ha-card>
        <style>
          ha-card {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          .card-header {
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 1px solid var(--divider-color);
          }
          .card-header .name {
            font-size: 16px;
            font-weight: 500;
            color: var(--primary-text-color);
          }
          .card-header mwc-icon-button {
            --mdc-icon-size: 24px;
          }
          .card-content {
            padding: 0;
            flex: 1;
            overflow-y: auto;
          }
          .empty-state {
            padding: 32px 16px;
            text-align: center;
            color: var(--secondary-text-color);
          }
          .todo-item {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid var(--divider-color);
            cursor: pointer;
            transition: background-color 0.2s;
          }
          .todo-item:hover {
            background-color: var(--secondary-background-color);
          }
          .todo-item.completed {
            opacity: 0.6;
          }
          .todo-item ha-checkbox {
            margin-right: 12px;
          }
          .todo-item-content {
            flex: 1;
            min-width: 0;
          }
          .todo-item-summary {
            font-size: 14px;
            color: var(--primary-text-color);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .todo-item.completed .todo-item-summary {
            text-decoration: line-through;
          }
          .todo-item-description {
            font-size: 12px;
            color: var(--secondary-text-color);
            margin-top: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .todo-item-due {
            font-size: 12px;
            color: var(--secondary-text-color);
            margin-left: 8px;
          }
          .add-item-container {
            padding: 16px;
            border-bottom: 1px solid var(--divider-color);
            display: none;
          }
          .add-item-container.active {
            display: block;
          }
          .add-item-input {
            width: 100%;
            padding: 8px;
            font-size: 14px;
            border: 1px solid var(--divider-color);
            border-radius: 4px;
            background-color: var(--card-background-color);
            color: var(--primary-text-color);
          }
          .add-item-buttons {
            margin-top: 8px;
            display: flex;
            gap: 8px;
          }
          .section-header {
            padding: 12px 16px;
            font-size: 14px;
            font-weight: 500;
            color: var(--secondary-text-color);
            background-color: var(--secondary-background-color);
            border-bottom: 1px solid var(--divider-color);
          }
        </style>
        
        <div class="card-header">
          <div class="name">${title}</div>
          <mwc-icon-button id="add-button">
            <ha-icon icon="mdi:plus"></ha-icon>
          </mwc-icon-button>
        </div>
        
        <div class="add-item-container" id="add-item-container">
          <input 
            type="text" 
            class="add-item-input" 
            id="new-item-input"
            placeholder="Add new task..."
          />
          <div class="add-item-buttons">
            <mwc-button id="save-button" raised>Add</mwc-button>
            <mwc-button id="cancel-button">Cancel</mwc-button>
          </div>
        </div>
        
        <div class="card-content">
          ${activeItems.length === 0 && completedItems.length === 0 ? `
            <div class="empty-state">
              <ha-icon icon="mdi:checkbox-marked-circle-outline"></ha-icon>
              <p>No tasks</p>
            </div>
          ` : ''}
          
          ${activeItems.length > 0 ? `
            <div class="active-section">
              ${activeItems.map(item => this._renderItem(item, false)).join('')}
            </div>
          ` : ''}
          
          ${completedItems.length > 0 ? `
            <div class="section-header">Completed</div>
            <div class="completed-section">
              ${completedItems.map(item => this._renderItem(item, true)).join('')}
            </div>
          ` : ''}
        </div>
      </ha-card>
    `;

    this._attachEventListeners();
  }

  _renderItem(item, isCompleted) {
    const dueText = item.due ? `📅 ${item.due}` : '';
    return `
      <div class="todo-item ${isCompleted ? 'completed' : ''}" data-uid="${item.uid}">
        <ha-checkbox ${isCompleted ? 'checked' : ''}></ha-checkbox>
        <div class="todo-item-content">
          <div class="todo-item-summary">${this._escapeHtml(item.summary)}</div>
          ${item.description ? `<div class="todo-item-description">${this._escapeHtml(item.description)}</div>` : ''}
        </div>
        ${dueText ? `<div class="todo-item-due">${dueText}</div>` : ''}
      </div>
    `;
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _attachEventListeners() {
    // Add button
    const addButton = this.querySelector('#add-button');
    if (addButton) {
      addButton.addEventListener('click', () => this._showAddItemForm());
    }

    // Save button
    const saveButton = this.querySelector('#save-button');
    if (saveButton) {
      saveButton.addEventListener('click', () => this._addNewItem());
    }

    // Cancel button
    const cancelButton = this.querySelector('#cancel-button');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => this._hideAddItemForm());
    }

    // Enter key on input
    const input = this.querySelector('#new-item-input');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._addNewItem();
        }
      });
    }

    // Checkboxes
    const checkboxes = this.querySelectorAll('.todo-item ha-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const todoItem = e.target.closest('.todo-item');
        const uid = todoItem.dataset.uid;
        const isCompleted = e.target.checked;
        this._toggleItemStatus(uid, isCompleted);
      });
    });

    // Click on item to edit (future enhancement)
    const items = this.querySelectorAll('.todo-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on checkbox
        if (e.target.tagName !== 'HA-CHECKBOX') {
          const uid = item.dataset.uid;
          debugLog('Item clicked:', uid);
          // TODO: Implement edit dialog
        }
      });
    });
  }

  _showAddItemForm() {
    const container = this.querySelector('#add-item-container');
    if (container) {
      container.classList.add('active');
      const input = this.querySelector('#new-item-input');
      if (input) {
        input.focus();
      }
    }
  }

  _hideAddItemForm() {
    const container = this.querySelector('#add-item-container');
    if (container) {
      container.classList.remove('active');
      const input = this.querySelector('#new-item-input');
      if (input) {
        input.value = '';
      }
    }
  }

  async _addNewItem() {
    const input = this.querySelector('#new-item-input');
    if (!input || !input.value.trim()) {
      return;
    }

    const summary = input.value.trim();
    debugLog('Adding new item:', summary);

    try {
      await this._hass.callService('better_todo', 'create_task', {
        entity_id: this._entityId,
        summary: summary,
      });
      
      debugLog('Item created successfully');
      this._hideAddItemForm();
    } catch (error) {
      errorLog('Error creating item:', error);
      alert('Failed to create task: ' + error.message);
    }
  }

  async _toggleItemStatus(uid, isCompleted) {
    debugLog('Toggling item status:', uid, isCompleted);

    try {
      await this._hass.callService('better_todo', 'update_task', {
        entity_id: this._entityId,
        uid: uid,
        status: isCompleted ? 'completed' : 'needs_action',
      });
      
      debugLog('Item status updated successfully');
    } catch (error) {
      errorLog('Error updating item status:', error);
      alert('Failed to update task: ' + error.message);
    }
  }
}

customElements.define('better-todo-list-card', BetterTodoListCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'better-todo-list-card',
  name: 'Better ToDo List Card',
  description: 'A card that displays Better ToDo tasks with full CRUD functionality',
  preview: true,
});

console.info(
  `%c BETTER-TODO-LIST-CARD %c v${BETTER_TODO_LIST_CARD_VERSION} `,
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
