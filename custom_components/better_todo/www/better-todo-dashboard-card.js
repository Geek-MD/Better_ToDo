/**
 * Better ToDo Dashboard Card
 * Custom Lovelace card for Better ToDo dashboard with 2-section layout
 * 
 * Layout:
 * - Left section: List of all Better ToDo lists
 * - Right section: Tasks from the selected list with category headers
 */

class BetterTodoDashboardCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._selectedEntity = null;
    this._cardElement = null;
  }

  setConfig(config) {
    // Config can optionally specify which entities to include
    this._config = config || {};
    this._createCard();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateCard();
  }

  _createCard() {
    if (!this._cardElement) {
      this._cardElement = document.createElement('ha-card');
      this.appendChild(this._cardElement);
    }
  }

  /**
   * Get all Better ToDo entities
   * Note: This filters for all todo.* entities. While not strictly limited to
   * Better ToDo entities, this card is designed to be used exclusively in the
   * Better ToDo dashboard where only Better ToDo entities are expected to be present.
   * For a more strict check, we would need access to entity registry data which
   * is not available from the frontend state object.
   * @returns {Array} - Array of todo entity IDs
   */
  _getTodoEntities() {
    if (!this._hass) return [];
    
    const entities = [];
    Object.keys(this._hass.states).forEach(entityId => {
      if (entityId.startsWith('todo.')) {
        const state = this._hass.states[entityId];
        // Check if this is a Better ToDo entity by looking at integration attribute
        if (state.attributes && state.attributes.supported_features !== undefined) {
          entities.push(entityId);
        }
      }
    });
    
    return entities.sort();
  }

  /**
   * Get the start of the week based on locale
   * Uses Intl.Locale when available for better locale detection
   * @returns {number} 0 for Monday, 6 for Sunday
   */
  _getWeekStartDay() {
    const language = this._hass.language || 'en';
    
    // Try to use Intl.Locale for better locale handling
    try {
      if (typeof Intl !== 'undefined' && Intl.Locale) {
        const locale = new Intl.Locale(language);
        // Check if weekInfo is available (newer browsers)
        if (locale.weekInfo && locale.weekInfo.firstDay !== undefined) {
          // weekInfo.firstDay: 1=Monday, 7=Sunday
          return locale.weekInfo.firstDay === 7 ? 6 : 0;
        }
      }
    } catch (e) {
      // Fall back to hardcoded logic if Intl.Locale is not available
    }
    
    // Fallback: US English traditionally starts on Sunday
    const sundayFirstLocales = ['en-US', 'en_US'];
    return sundayFirstLocales.includes(language) ? 6 : 0;
  }

  /**
   * Calculate week boundaries
   * @param {Date} now - Current date
   * @returns {Object} - { start: Date, end: Date }
   */
  _getWeekBoundaries(now) {
    const weekStart = this._getWeekStartDay();
    const currentWeekday = now.getDay(); // 0=Sunday, 6=Saturday
    
    let daysToStart, daysToEnd;
    
    if (weekStart === 0) { // Week starts on Monday
      const dayOfWeek = currentWeekday === 0 ? 6 : currentWeekday - 1;
      daysToStart = dayOfWeek;
      daysToEnd = 6 - dayOfWeek;
    } else { // Week starts on Sunday
      daysToStart = currentWeekday;
      daysToEnd = 6 - currentWeekday;
    }
    
    const start = new Date(now);
    start.setDate(start.getDate() - daysToStart);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(now);
    end.setDate(end.getDate() + daysToEnd);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }

  /**
   * Get the group for a todo item
   * @param {Object} item - Todo item
   * @returns {string} - Group name
   */
  _getItemGroup(item) {
    if (item.status === 'completed') {
      return 'completed';
    }
    
    if (!item.due) {
      return 'no_due_date';
    }
    
    try {
      const dueDate = new Date(item.due);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      const weekBoundaries = this._getWeekBoundaries(now);
      
      if (dueDate >= weekBoundaries.start && dueDate <= weekBoundaries.end) {
        return 'this_week';
      } else {
        return 'forthcoming';
      }
    } catch (e) {
      return 'no_due_date';
    }
  }

  /**
   * Get translated label for a group
   * @param {string} group - Group key
   * @returns {string} - Translated label
   */
  _getGroupLabel(group) {
    const language = this._hass.language || 'en';
    
    const labels = {
      en: {
        no_due_date: 'No due date',
        this_week: 'This week',
        forthcoming: 'Forthcoming',
        completed: 'Completed'
      },
      es: {
        no_due_date: 'Sin fecha de vencimiento',
        this_week: 'Esta semana',
        forthcoming: 'Próximamente',
        completed: 'Completadas'
      }
    };
    
    const lang = language.startsWith('es') ? 'es' : 'en';
    return labels[lang][group] || group;
  }

  /**
   * Group and sort items
   * @param {Array} items - Todo items
   * @returns {Object} - Grouped items
   */
  _groupItems(items) {
    const groups = {
      no_due_date: [],
      this_week: [],
      forthcoming: [],
      completed: []
    };
    
    items.forEach(item => {
      const group = this._getItemGroup(item);
      if (groups[group]) {
        groups[group].push(item);
      }
    });
    
    // Sort items within each group by due date
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) => {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due) - new Date(b.due);
      });
    });
    
    return groups;
  }

  /**
   * Format due date for display
   * @param {string} due - Due date string
   * @returns {string} - Formatted date
   */
  _formatDueDate(due) {
    if (!due) return '';
    try {
      const date = new Date(due);
      return date.toLocaleDateString(this._hass.language, {
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return due;
    }
  }

  /**
   * Handle list selection
   * @param {Event} e - Click event
   */
  _handleListClick(e) {
    const listItem = e.currentTarget;
    const entityId = listItem.dataset.entity;
    
    // Update selected entity
    this._selectedEntity = entityId;
    
    // Update the card
    this._updateCard();
  }

  /**
   * Handle checkbox change
   * @param {Event} e - Change event
   */
  async _handleCheckboxChange(e) {
    const checkbox = e.target;
    const uid = checkbox.dataset.uid;
    const completed = checkbox.checked;
    
    const entity = this._selectedEntity;
    
    try {
      await this._hass.callService('todo', 'update_item', {
        entity_id: entity,
        item: uid,
        status: completed ? 'completed' : 'needs_action'
      });
    } catch (err) {
      console.error('Error updating todo item:', err);
      checkbox.checked = !completed;
    }
  }

  /**
   * Update the card content
   */
  _updateCard() {
    if (!this._hass || !this._cardElement) {
      return;
    }

    const entities = this._getTodoEntities();
    
    if (entities.length === 0) {
      this._cardElement.innerHTML = `
        <div class="card-content">
          <p>No Better ToDo lists found</p>
        </div>
      `;
      return;
    }

    // Auto-select first entity if none selected
    if (!this._selectedEntity || !this._hass.states[this._selectedEntity]) {
      this._selectedEntity = entities[0];
    }

    // Build the two-section layout
    const listsHtml = this._renderListsPanel(entities);
    const tasksHtml = this._renderTasksPanel();
    
    this._cardElement.innerHTML = `
      <style>
        .dashboard-container {
          display: flex;
          height: 100%;
          min-height: 400px;
        }
        .lists-panel {
          width: 250px;
          border-right: 1px solid var(--divider-color);
          overflow-y: auto;
          padding: 16px 0;
        }
        .list-item {
          padding: 12px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background-color 0.2s;
        }
        .list-item:hover {
          background-color: var(--secondary-background-color);
        }
        .list-item.selected {
          background-color: var(--primary-color);
          color: var(--text-primary-color);
        }
        .list-item-icon {
          margin-right: 12px;
          --mdc-icon-size: 24px;
        }
        .list-item-name {
          flex: 1;
          font-weight: 500;
        }
        .list-item-count {
          font-size: 0.9em;
          opacity: 0.7;
        }
        .tasks-panel {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .tasks-panel .header {
          margin: 16px 0 8px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color);
        }
        .tasks-panel .header h2 {
          margin: 0;
          font-size: 1.1em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .tasks-panel ha-check-list-item {
          margin: 4px 0;
        }
        .secondary {
          font-size: 0.9em;
          color: var(--secondary-text-color);
        }
      </style>
      <div class="dashboard-container">
        <div class="lists-panel">
          ${listsHtml}
        </div>
        <div class="tasks-panel">
          ${tasksHtml}
        </div>
      </div>
    `;
    
    // Add event listeners for list items
    this._cardElement.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => this._handleListClick(e));
    });
    
    // Add event listeners for checkboxes
    this._cardElement.querySelectorAll('ha-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => this._handleCheckboxChange(e));
    });
  }

  /**
   * Render the lists panel
   * @param {Array} entities - Todo entity IDs
   * @returns {string} - HTML string
   */
  _renderListsPanel(entities) {
    return entities.map(entityId => {
      const state = this._hass.states[entityId];
      const name = state.attributes.friendly_name || entityId;
      const items = state.attributes.todo_items || [];
      const activeCount = items.filter(item => item.status !== 'completed').length;
      const isSelected = entityId === this._selectedEntity;
      
      return `
        <div class="list-item ${isSelected ? 'selected' : ''}" data-entity="${entityId}">
          <ha-icon class="list-item-icon" icon="mdi:format-list-checks"></ha-icon>
          <div class="list-item-name">${name}</div>
          <div class="list-item-count">${activeCount}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render the tasks panel
   * @returns {string} - HTML string
   */
  _renderTasksPanel() {
    if (!this._selectedEntity) {
      return '<p>Select a list</p>';
    }
    
    const state = this._hass.states[this._selectedEntity];
    if (!state) {
      return '<p>List not found</p>';
    }
    
    const items = state.attributes.todo_items || [];
    const title = state.attributes.friendly_name || 'Tasks';
    
    // Group items
    const groups = this._groupItems(items);
    
    return `
      <h1 style="margin-top: 0;">${title}</h1>
      ${this._renderGroup('no_due_date', groups.no_due_date)}
      ${this._renderGroup('this_week', groups.this_week)}
      ${this._renderGroup('forthcoming', groups.forthcoming)}
      ${this._renderGroup('completed', groups.completed)}
    `;
  }

  /**
   * Render a group section with header
   * @param {string} group - Group key
   * @param {Array} items - Items in the group
   * @returns {string} - HTML string
   */
  _renderGroup(group, items) {
    if (items.length === 0) {
      return '';
    }
    
    const label = this._getGroupLabel(group);
    const itemsHtml = items.map(item => this._renderItem(item)).join('');
    
    return `
      <div class="header" role="separator">
        <h2>${label}</h2>
      </div>
      ${itemsHtml}
    `;
  }

  /**
   * Render a todo item
   * @param {Object} item - Todo item
   * @returns {string} - HTML string
   */
  _renderItem(item) {
    const checked = item.status === 'completed' ? 'checked' : '';
    const dueDate = this._formatDueDate(item.due);
    const dueHtml = dueDate ? `<div class="secondary">${dueDate}</div>` : '';
    
    return `
      <ha-check-list-item>
        <ha-checkbox 
          slot="start"
          ${checked}
          data-uid="${item.uid}"
        ></ha-checkbox>
        <div>
          <div>${item.summary}</div>
          ${dueHtml}
        </div>
      </ha-check-list-item>
    `;
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return {};
  }
}

customElements.define('better-todo-dashboard-card', BetterTodoDashboardCard);

// Register the card with the card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'better-todo-dashboard-card',
  name: 'Better ToDo Dashboard Card',
  description: 'Two-section dashboard card with lists and tasks',
  preview: true,
  documentationURL: 'https://github.com/Geek-MD/Better_ToDo'
});

console.info(
  '%c BETTER-TODO-DASHBOARD-CARD %c v0.5.1 ',
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
