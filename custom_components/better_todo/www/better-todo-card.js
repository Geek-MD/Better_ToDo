/**
 * Better ToDo Card
 * Custom Lovelace card for Better ToDo integration
 * 
 * Uses the same HTML structure as Home Assistant's native todo-list card
 * but with custom category headers:
 * - No due date
 * - This week
 * - Forthcoming
 * - Completed
 */

class BetterTodoCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._cardElement = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Please define an entity');
    }
    this._config = config;
    this._createCard();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateCard();
  }

  _createCard() {
    // Create the card structure using HA's native components
    if (!this._cardElement) {
      this._cardElement = document.createElement('ha-card');
      this.appendChild(this._cardElement);
    }
  }

  /**
   * Get the start of the week based on locale
   * @returns {number} 0 for Monday, 6 for Sunday
   */
  _getWeekStartDay() {
    const language = this._hass.language || 'en';
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
      // Convert Sunday=0 to Monday=0 system
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
    // Completed items
    if (item.status === 'completed') {
      return 'completed';
    }
    
    // No due date
    if (!item.due) {
      return 'no_due_date';
    }
    
    // Parse due date
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
   * Handle checkbox change
   * @param {Event} e - Change event
   */
  async _handleCheckboxChange(e) {
    const checkbox = e.target;
    const uid = checkbox.dataset.uid;
    const completed = checkbox.checked;
    
    const entity = this._config.entity;
    
    try {
      await this._hass.callService('todo', 'update_item', {
        entity_id: entity,
        item: uid,
        status: completed ? 'completed' : 'needs_action'
      });
    } catch (err) {
      console.error('Error updating todo item:', err);
      // Revert checkbox state on error
      checkbox.checked = !completed;
    }
  }

  /**
   * Update the card content
   */
  _updateCard() {
    if (!this._hass || !this._config || !this._cardElement) {
      return;
    }

    const entity = this._config.entity;
    const state = this._hass.states[entity];
    
    if (!state) {
      this._cardElement.innerHTML = `
        <div class="card-content">
          <p>Entity not found: ${entity}</p>
        </div>
      `;
      return;
    }

    const items = state.attributes.todo_items || [];
    const title = this._config.title || state.attributes.friendly_name || 'Better ToDo';
    
    // Group items
    const groups = this._groupItems(items);
    
    // Build card HTML using HA's structure
    const cardHeader = `
      <div class="card-header">
        <div class="name">${title}</div>
      </div>
    `;
    
    const cardContent = `
      <div class="card-content">
        ${this._renderGroup('no_due_date', groups.no_due_date)}
        ${this._renderGroup('this_week', groups.this_week)}
        ${this._renderGroup('forthcoming', groups.forthcoming)}
        ${this._renderGroup('completed', groups.completed)}
      </div>
    `;
    
    this._cardElement.innerHTML = cardHeader + cardContent;
    
    // Add event listeners for checkboxes
    this._cardElement.querySelectorAll('ha-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => this._handleCheckboxChange(e));
    });
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
   * Render a todo item using HA's structure
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
    return 3;
  }

  static getStubConfig() {
    return {
      entity: 'todo.tasks'
    };
  }

  static getConfigElement() {
    // Return card editor element if needed
    return document.createElement('better-todo-card-editor');
  }
}

customElements.define('better-todo-card', BetterTodoCard);

// Register the card with the card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'better-todo-card',
  name: 'Better ToDo Card',
  description: 'A custom card for Better ToDo with category headers',
  preview: true,
  documentationURL: 'https://github.com/Geek-MD/Better_ToDo'
});

console.info(
  '%c BETTER-TODO-CARD %c v0.4.1 ',
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
