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
 * so we use an inline card implementation instead of relying on external modules.
 */

const BETTER_TODO_VERSION = "0.9.1";

// Enable detailed logging for debugging
// Set to false in production to avoid unnecessary console output
const DEBUG_MODE = false;

function debugLog(message, ...args) {
  if (DEBUG_MODE) {
    // Sanitize args to prevent log injection - only log safe types
    const safeArgs = args.map(arg => {
      if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        return arg;
      }
      // For objects, use JSON stringify with error handling
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return '[Object]';
      }
    });
    console.log(`[Better ToDo Panel] ${message}`, ...safeArgs);
  }
}

function errorLog(message, ...args) {
  // Sanitize args to prevent log injection - only log safe types
  const safeArgs = args.map(arg => {
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      return arg;
    }
    // For objects, use JSON stringify with error handling
    try {
      return JSON.stringify(arg);
    } catch (e) {
      return '[Object]';
    }
  });
  console.error(`[Better ToDo Panel ERROR] ${message}`, ...safeArgs);
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
      if (entityId.startsWith('better_todo.')) {
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
  async _updateContent() {
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
      // Use 'items' attribute which contains clean task list
      const items = state.attributes.items || [];
      const activeCount = items.filter(item => item.status !== 'completed').length;
      const isSelected = entityId === this._selectedEntityId;
      
      // Escape values for safe HTML attribute usage
      const safeEntityId = this._escapeHtml(entityId);
      const safeName = this._escapeHtml(name);

      return `
        <div class="list-item ${isSelected ? 'selected' : ''}" data-entity="${safeEntityId}">
          <ha-icon icon="mdi:format-list-checks"></ha-icon>
          <div class="list-item-content">
            <div class="list-item-name">${safeName}</div>
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

    // Render main content with inline task list
    if (this._selectedEntityId) {
      const state = this._hass.states[this._selectedEntityId];
      const name = state.attributes.friendly_name || this._selectedEntityId;
      
      // Render task list inline
      this._renderTaskList(contentContainer, this._selectedEntityId, name);
    }
  }

  /**
   * Render an inline task list (no external card dependency)
   */
  _renderTaskList(container, entityId, title) {
    const state = this._hass.states[entityId];
    if (!state) {
      errorLog('Entity state not found:', entityId);
      return;
    }

    debugLog('Rendering task list for:', entityId, state);

    // Get items from entity attributes
    // Note: Using 'items' instead of 'todo_items' because Better ToDo entities
    // provide a clean 'items' list for native card compatibility, while 'todo_items'
    // includes header items for custom card backward compatibility
    const items = state.attributes.items || [];
    const activeItems = items.filter(item => item.status !== 'completed');
    const completedItems = items.filter(item => item.status === 'completed');

    debugLog(`Found ${activeItems.length} active and ${completedItems.length} completed items`);

    container.innerHTML = `
      <style>
        .task-list-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .task-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .task-list-header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 400;
        }
        .add-task-button {
          --mdc-theme-primary: var(--primary-color);
        }
        .task-card {
          background: var(--card-background-color);
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          margin-bottom: 16px;
        }
        .task-card-header {
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--divider-color);
        }
        .task-card-header-title {
          font-size: 16px;
          font-weight: 500;
        }
        .task-card-content {
          padding: 0;
        }
        .add-task-form {
          padding: 16px;
          border-bottom: 1px solid var(--divider-color);
          display: none;
        }
        .add-task-form.active {
          display: block;
        }
        .add-task-input {
          width: 100%;
          padding: 12px;
          font-size: 14px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          margin-bottom: 8px;
        }
        .add-task-buttons {
          display: flex;
          gap: 8px;
        }
        .task-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--divider-color);
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .task-item:hover {
          background-color: var(--secondary-background-color);
        }
        .task-item:last-child {
          border-bottom: none;
        }
        .task-item.completed {
          opacity: 0.6;
        }
        .task-item ha-checkbox {
          margin-right: 12px;
        }
        .task-item-content {
          flex: 1;
          min-width: 0;
        }
        .task-item-summary {
          font-size: 14px;
          color: var(--primary-text-color);
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .task-item.completed .task-item-summary {
          text-decoration: line-through;
        }
        .task-item-description {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .task-item-due {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-left: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .task-item-due ha-icon {
          --mdc-icon-size: 16px;
        }
        .section-header {
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color);
          background-color: var(--secondary-background-color);
        }
        .empty-state {
          padding: 48px 16px;
          text-align: center;
          color: var(--secondary-text-color);
        }
        .empty-state ha-icon {
          --mdc-icon-size: 64px;
          opacity: 0.3;
          margin-bottom: 16px;
        }
      </style>
      
      <div class="task-list-container">
        <div class="task-list-header">
          <h1>${this._escapeHtml(title)}</h1>
          <mwc-button raised class="add-task-button" id="add-task-btn">
            <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
            Add Task
          </mwc-button>
        </div>
        
        <div class="task-card">
          <div class="add-task-form" id="add-task-form">
            <input 
              type="text" 
              class="add-task-input" 
              id="new-task-input"
              placeholder="Task name..."
            />
            <div class="add-task-buttons">
              <mwc-button raised id="save-task-btn">Save</mwc-button>
              <mwc-button id="cancel-task-btn">Cancel</mwc-button>
            </div>
          </div>
          
          <div class="task-card-content">
            ${activeItems.length === 0 && completedItems.length === 0 ? `
              <div class="empty-state">
                <ha-icon icon="mdi:checkbox-marked-circle-outline"></ha-icon>
                <p>No tasks yet</p>
                <p style="font-size: 0.9em;">Click "Add Task" to create your first task</p>
              </div>
            ` : ''}
            
            ${activeItems.length > 0 ? `
              <div class="active-section">
                ${activeItems.map(item => this._renderTaskItem(item, false)).join('')}
              </div>
            ` : ''}
            
            ${completedItems.length > 0 ? `
              <div class="section-header">Completed</div>
              <div class="completed-section">
                ${completedItems.map(item => this._renderTaskItem(item, true)).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    this._attachTaskListEventListeners(entityId);
  }

  /**
   * Render a single task item
   */
  _renderTaskItem(item, isCompleted) {
    const dueDate = item.due ? new Date(item.due).toLocaleDateString() : '';
    const summary = this._escapeHtml(item.summary || '');
    const description = item.description ? this._escapeHtml(item.description) : '';
    // Escape UID for safe HTML attribute usage
    const safeUid = this._escapeHtml(item.uid || '');
    
    return `
      <div class="task-item ${isCompleted ? 'completed' : ''}" data-uid="${safeUid}">
        <ha-checkbox ${isCompleted ? 'checked' : ''}></ha-checkbox>
        <div class="task-item-content">
          <div class="task-item-summary">${summary}</div>
          ${description ? `<div class="task-item-description">${description}</div>` : ''}
        </div>
        ${dueDate ? `<div class="task-item-due"><ha-icon icon="mdi:calendar"></ha-icon> ${dueDate}</div>` : ''}
      </div>
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
   * Attach event listeners to task list elements
   */
  _attachTaskListEventListeners(entityId) {
    // Add task button
    const addBtn = this.querySelector('#add-task-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this._showAddTaskForm());
    }

    // Save task button
    const saveBtn = this.querySelector('#save-task-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this._saveNewTask(entityId));
    }

    // Cancel button
    const cancelBtn = this.querySelector('#cancel-task-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this._hideAddTaskForm());
    }

    // Enter key on input
    const input = this.querySelector('#new-task-input');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._saveNewTask(entityId);
        }
      });
    }

    // Checkboxes for toggling task status
    const checkboxes = this.querySelectorAll('.task-item ha-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const taskItem = e.target.closest('.task-item');
        const uid = taskItem.dataset.uid;
        const isCompleted = e.target.checked;
        this._toggleTaskStatus(entityId, uid, isCompleted);
      });
    });
  }

  /**
   * Show the add task form
   */
  _showAddTaskForm() {
    const form = this.querySelector('#add-task-form');
    if (form) {
      form.classList.add('active');
      const input = this.querySelector('#new-task-input');
      if (input) {
        input.focus();
      }
    }
  }

  /**
   * Hide the add task form
   */
  _hideAddTaskForm() {
    const form = this.querySelector('#add-task-form');
    if (form) {
      form.classList.remove('active');
      const input = this.querySelector('#new-task-input');
      if (input) {
        input.value = '';
      }
    }
  }

  /**
   * Show a toast notification (Home Assistant style)
   * Uses persistent notifications which can be dismissed by the user
   */
  _showToast(message) {
    if (this._hass) {
      // Sanitize message to prevent XSS
      const safeMessage = this._escapeHtml(String(message));
      this._hass.callService('persistent_notification', 'create', {
        message: safeMessage,
        title: 'Better ToDo',
      }).catch(() => {
        // Fallback to console if notification service fails
        console.warn('[Better ToDo]', safeMessage);
      });
    }
  }

  /**
   * Save a new task
   */
  async _saveNewTask(entityId) {
    const input = this.querySelector('#new-task-input');
    if (!input || !input.value.trim()) {
      return;
    }

    const summary = input.value.trim();
    debugLog('Creating new task:', summary);

    try {
      await this._hass.callService('better_todo', 'create_task', {
        entity_id: entityId,
        summary: summary,
      });
      
      debugLog('Task created successfully');
      this._hideAddTaskForm();
      // The state will update automatically and trigger re-render
    } catch (error) {
      errorLog('Error creating task:', error);
      this._showToast(`Failed to create task: ${error.message}`);
    }
  }

  /**
   * Toggle task completion status
   */
  async _toggleTaskStatus(entityId, uid, isCompleted) {
    debugLog('Toggling task status:', uid, isCompleted);

    try {
      await this._hass.callService('better_todo', 'update_task', {
        entity_id: entityId,
        uid: uid,
        status: isCompleted ? 'completed' : 'needs_action',
      });
      
      debugLog('Task status updated successfully');
      // The state will update automatically and trigger re-render
    } catch (error) {
      errorLog('Error updating task status:', error);
      this._showToast(`Failed to update task: ${error.message}`);
    }
  }
}

customElements.define('better-todo-panel', BetterTodoPanel);

console.info(
  `%c BETTER-TODO-PANEL %c v${BETTER_TODO_VERSION} `,
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
