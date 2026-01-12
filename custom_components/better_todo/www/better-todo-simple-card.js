/**
 * Better ToDo Simple Card
 * 
 * A simple custom card that replicates Home Assistant's Local Todo functionality.
 * This card can be manually added to the panel yaml for testing.
 * 
 * Based on Home Assistant's custom card development guidelines:
 * https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card/
 * 
 * Usage in yaml:
 * type: custom:better-todo-simple-card
 * entity: better_todo.tasks
 */

class BetterTodoSimpleCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Set configuration from card config
   */
  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this._config = config;
    this._entity = config.entity;
  }

  /**
   * Set hass object (called by Home Assistant)
   */
  set hass(hass) {
    this._hass = hass;
    
    // Get entity state
    const entityState = hass.states[this._entity];
    
    if (!entityState) {
      this._renderError('Entity not found: ' + this._entity);
      return;
    }

    // Render the card
    this._render(entityState);
  }

  /**
   * Get card size for layout
   */
  getCardSize() {
    return 3;
  }

  /**
   * Render error message
   */
  _renderError(message) {
    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-content">
          <div class="error">${this._escapeHtml(message)}</div>
        </div>
      </ha-card>
      <style>
        .error {
          color: var(--error-color);
          padding: 16px;
        }
      </style>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render the card
   */
  _render(entityState) {
    const items = entityState.attributes.items || [];
    const title = this._config.title || entityState.attributes.friendly_name || 'To-do List';
    
    // Separate active and completed items
    const activeItems = items.filter(item => item.status === 'needs_action');
    const completedItems = items.filter(item => item.status === 'completed');

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header">
          <div class="name">${this._escapeHtml(title)}</div>
        </div>
        <div class="card-content">
          ${this._renderAddItemForm()}
          ${this._renderItemList('Active', activeItems, false)}
          ${this._renderItemList('Completed', completedItems, true)}
        </div>
      </ha-card>
      ${this._getStyles()}
    `;

    // Attach event listeners
    this._attachEventListeners();
  }

  /**
   * Render add item form
   */
  _renderAddItemForm() {
    return `
      <div class="add-item-container">
        <input
          type="text"
          class="add-item-input"
          placeholder="Add item..."
          aria-label="Add item"
        />
        <button class="add-item-button" aria-label="Add">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>
    `;
  }

  /**
   * Render list of items
   */
  _renderItemList(title, items, isCompleted) {
    if (items.length === 0) {
      return '';
    }

    const itemsHtml = items.map(item => this._renderItem(item, isCompleted)).join('');

    return `
      <div class="items-section">
        <div class="section-header">${this._escapeHtml(title)}</div>
        <div class="items-container">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single item
   */
  _renderItem(item, isCompleted) {
    const checked = isCompleted ? 'checked' : '';
    const completedClass = isCompleted ? 'completed' : '';
    
    return `
      <div class="item ${completedClass}" data-uid="${this._escapeHtml(item.uid || '')}">
        <ha-checkbox ${checked} class="item-checkbox"></ha-checkbox>
        <div class="item-content">
          <div class="item-summary">${this._escapeHtml(item.summary || '')}</div>
          ${item.due ? `<div class="item-due">Due: ${this._escapeHtml(item.due)}</div>` : ''}
          ${item.description ? `<div class="item-description">${this._escapeHtml(item.description)}</div>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get styles for the card
   */
  _getStyles() {
    return `
      <style>
        ha-card {
          padding: 16px;
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .name {
          font-size: 1.5em;
          font-weight: 500;
        }
        .card-content {
          padding: 0;
        }
        .add-item-container {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .add-item-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        }
        .add-item-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }
        .add-item-button {
          padding: 8px 12px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .add-item-button:hover {
          opacity: 0.9;
        }
        .items-section {
          margin-bottom: 16px;
        }
        .section-header {
          font-weight: 500;
          font-size: 14px;
          color: var(--secondary-text-color);
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .items-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .item {
          display: flex;
          align-items: start;
          gap: 12px;
          padding: 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .item:hover {
          background: var(--secondary-background-color);
        }
        .item.completed .item-summary {
          text-decoration: line-through;
          color: var(--secondary-text-color);
        }
        .item-checkbox {
          margin-top: 2px;
        }
        .item-content {
          flex: 1;
          min-width: 0;
        }
        .item-summary {
          font-size: 14px;
          word-wrap: break-word;
        }
        .item-due {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .item-description {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
        }
        .error {
          color: var(--error-color);
          padding: 16px;
        }
      </style>
    `;
  }

  /**
   * Attach event listeners to interactive elements
   */
  _attachEventListeners() {
    // Add item button
    const addButton = this.shadowRoot.querySelector('.add-item-button');
    const addInput = this.shadowRoot.querySelector('.add-item-input');
    
    if (addButton && addInput) {
      addButton.addEventListener('click', () => this._handleAddItem(addInput));
      addInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._handleAddItem(addInput);
        }
      });
    }

    // Checkbox toggle
    const checkboxes = this.shadowRoot.querySelectorAll('.item-checkbox');
    checkboxes.forEach((checkbox, index) => {
      checkbox.addEventListener('change', (e) => {
        const item = e.target.closest('.item');
        const uid = item.dataset.uid;
        this._handleToggleItem(uid, e.target.checked);
      });
    });

    // Item click for editing
    const items = this.shadowRoot.querySelectorAll('.item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking checkbox
        if (e.target.classList.contains('item-checkbox') || e.target.closest('.item-checkbox')) {
          return;
        }
        const uid = item.dataset.uid;
        this._handleEditItem(uid);
      });
    });
  }

  /**
   * Handle adding a new item
   */
  _handleAddItem(input) {
    const summary = input.value.trim();
    if (!summary) return;

    this._hass.callService('better_todo', 'create_task', {
      entity_id: this._entity,
      summary: summary
    });

    input.value = '';
  }

  /**
   * Handle toggling item completion
   */
  _handleToggleItem(uid, checked) {
    if (!uid) return;

    const newStatus = checked ? 'completed' : 'needs_action';

    this._hass.callService('better_todo', 'update_task', {
      entity_id: this._entity,
      uid: uid,
      status: newStatus
    });
  }

  /**
   * Handle editing an item
   */
  _handleEditItem(uid) {
    if (!uid) return;

    // Get entity state
    const entityState = this._hass.states[this._entity];
    if (!entityState) return;

    // Find the item
    const items = entityState.attributes.items || [];
    const item = items.find(i => i.uid === uid);
    if (!item) return;

    // Open more-info dialog
    const event = new Event('hass-more-info', {
      bubbles: true,
      composed: true,
    });
    event.detail = { entityId: this._entity };
    this.dispatchEvent(event);
  }
}

// Define the custom element
customElements.define('better-todo-simple-card', BetterTodoSimpleCard);

// Register with Home Assistant's card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'better-todo-simple-card',
  name: 'Better ToDo Simple Card',
  description: 'A simple card for Better ToDo lists that replicates Local Todo functionality',
  preview: false,
  documentationURL: 'https://github.com/Geek-MD/Better_ToDo',
});

console.info(
  '%c BETTER-TODO-SIMPLE-CARD %c v1.0.0 ',
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
