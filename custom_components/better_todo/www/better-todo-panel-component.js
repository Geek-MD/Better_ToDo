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

const BETTER_TODO_VERSION = "0.10.6";

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
    
    // Sort entities: descending alphabetical order with "Shopping List" always last
    return entities.sort((a, b) => {
      const stateA = this._hass.states[a];
      const stateB = this._hass.states[b];
      const nameA = stateA?.attributes?.friendly_name || a;
      const nameB = stateB?.attributes?.friendly_name || b;
      
      // Shopping List always goes last
      const isShoppingA = nameA.toLowerCase().includes('shopping');
      const isShoppingB = nameB.toLowerCase().includes('shopping');
      
      if (isShoppingA && !isShoppingB) return 1;
      if (!isShoppingA && isShoppingB) return -1;
      
      // For other lists, sort in descending alphabetical order (Z to A)
      return nameB.localeCompare(nameA);
    });
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
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--primary-background-color);
        }
        .panel-header {
          padding: 16px 24px;
          background-color: var(--primary-color);
          color: var(--text-primary-color);
          border-bottom: 1px solid var(--divider-color);
        }
        .panel-header h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 500;
        }
        .better-todo-container {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .sidebar {
          width: 300px;
          border-right: 1px solid var(--divider-color);
          overflow-y: auto;
          background-color: var(--sidebar-background-color, var(--card-background-color));
          display: flex;
          flex-direction: column;
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
        .sidebar-footer {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid var(--divider-color);
        }
        .create-list-button {
          width: 100%;
          padding: 12px;
          background-color: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
          transition: background-color 0.2s;
          border-radius: 4px;
        }
        .create-list-button:hover {
          background-color: var(--secondary-background-color);
        }
        .create-list-button ha-icon {
          margin-right: 8px;
          --mdc-icon-size: 20px;
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
      <div class="panel-header">
        <h1>Better ToDo</h1>
      </div>
      <div class="better-todo-container">
        <div class="sidebar">
          <div id="lists-container"></div>
          <div class="sidebar-footer">
            <button class="create-list-button" id="create-list-button">
              <ha-icon icon="mdi:plus"></ha-icon>
              <span>Create list</span>
            </button>
          </div>
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

    // Add click handler to create list button
    const createListButton = this.querySelector('#create-list-button');
    if (createListButton) {
      createListButton.addEventListener('click', () => {
        this._handleCreateList();
      });
    }

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
    // Note: Using 'items' instead of 'todo_items' to fix display issue
    // The panel was showing "You have no to-do items!" because 'todo_items'
    // includes header items for custom cards, while 'items' provides clean
    // task list for native card compatibility and proper rendering
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
        .fab-button {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow 0.2s, transform 0.2s;
          z-index: 100;
        }
        .fab-button:hover {
          box-shadow: 0 6px 12px rgba(0,0,0,0.4);
          transform: scale(1.05);
        }
        .fab-button ha-icon {
          --mdc-icon-size: 28px;
        }
      </style>
      
      <div class="task-list-container">
        <div class="task-list-header">
          <h1>${this._escapeHtml(title)}</h1>
        </div>
        
        <div class="task-card">
          <div class="add-task-form active" id="add-task-form">
            <input 
              type="text" 
              class="add-task-input" 
              id="new-task-input"
              placeholder="Add item..."
            />
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
        
        <button class="fab-button" id="fab-add-task" title="Add task with options">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>
    `;

    this._attachTaskListEventListeners(entityId);
  }

  /**
   * Render a single task item
   */
  _renderTaskItem(item, isCompleted) {
    // Safely format due date with error handling
    let dueDate = '';
    if (item.due) {
      try {
        dueDate = new Date(item.due).toLocaleDateString();
      } catch (e) {
        // Invalid date format - show raw value
        dueDate = String(item.due);
      }
    }
    
    const summary = this._escapeHtml(item.summary || '');
    const description = item.description ? this._escapeHtml(item.description) : '';
    // Escape UID for safe HTML attribute usage
    const safeUid = this._escapeHtml(item.uid || '');
    // Escape due date for safe HTML content
    const safeDueDate = this._escapeHtml(dueDate);
    
    return `
      <div class="task-item ${isCompleted ? 'completed' : ''}" data-uid="${safeUid}">
        <ha-checkbox ${isCompleted ? 'checked' : ''}></ha-checkbox>
        <div class="task-item-content">
          <div class="task-item-summary">${summary}</div>
          ${description ? `<div class="task-item-description">${description}</div>` : ''}
        </div>
        ${safeDueDate ? `<div class="task-item-due"><ha-icon icon="mdi:calendar"></ha-icon> ${safeDueDate}</div>` : ''}
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
    // Enter key on input - save task directly
    const input = this.querySelector('#new-task-input');
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._saveNewTask(entityId);
        }
      });
      
      // Also save on blur if there's content
      input.addEventListener('blur', () => {
        if (input.value.trim()) {
          this._saveNewTask(entityId);
        }
      });
    }

    // FAB button - open advanced task dialog
    const fabBtn = this.querySelector('#fab-add-task');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => this._openTaskDialog(entityId, null));
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

    // Click on task item to edit
    const taskItems = this.querySelectorAll('.task-item');
    taskItems.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on checkbox
        if (e.target.tagName !== 'HA-CHECKBOX') {
          const uid = item.dataset.uid;
          const state = this._hass.states[entityId];
          const items = state.attributes.items || [];
          const task = items.find(t => t.uid === uid);
          if (task) {
            this._openTaskDialog(entityId, task);
          }
        }
      });
    });
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
      // Clear the input
      input.value = '';
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

  /**
   * Handle create list button click
   */
  _handleCreateList() {
    // Navigate to Better ToDo integration page to add a new list
    const integrationsUrl = '/config/integrations/integration/better_todo';
    window.location.href = integrationsUrl;
  }

  /**
   * Open task dialog for creating or editing a task
   * This opens the full task dialog with all options (description, due date, recurrence, etc.)
   */
  _openTaskDialog(entityId, task) {
    const isEdit = task !== null;
    const language = this._hass.language || 'en';
    const isSpanish = language.startsWith('es');
    
    // Get recurrence data for the task if editing
    let recurrenceData = null;
    if (isEdit) {
      const state = this._hass.states[entityId];
      recurrenceData = state?.attributes?.recurrence_data?.[task.uid];
    }
    
    // Create dialog
    const dialog = document.createElement('ha-dialog');
    dialog.heading = isSpanish 
      ? (isEdit ? 'Editar tarea' : 'Nueva tarea')
      : (isEdit ? 'Edit Task' : 'New Task');
    
    const content = document.createElement('div');
    content.style.padding = '16px';
    
    // Build form HTML
    content.innerHTML = `
      <style>
        .form-row {
          margin-bottom: 16px;
        }
        .form-row label {
          display: block;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .form-row input[type="text"],
        .form-row input[type="date"],
        .form-row input[type="number"],
        .form-row textarea,
        .form-row select {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background-color: var(--card-background-color);
          color: var(--primary-text-color);
          font-family: inherit;
          font-size: 14px;
        }
        .form-row textarea {
          min-height: 80px;
          resize: vertical;
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          margin-bottom: 16px;
        }
        .checkbox-row input[type="checkbox"] {
          margin-right: 8px;
        }
        .section-title {
          font-weight: 600;
          margin-top: 20px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color);
        }
        .inline-fields {
          display: flex;
          gap: 12px;
        }
        .inline-fields .form-row {
          flex: 1;
        }
        .radio-group {
          margin-left: 24px;
          padding: 8px;
          background-color: var(--secondary-background-color);
          border-radius: 4px;
        }
        .radio-option {
          display: flex;
          align-items: center;
          margin-bottom: 8px;
        }
        .radio-option input[type="radio"] {
          margin-right: 8px;
        }
        .radio-option label {
          margin: 0 8px 0 0;
          min-width: 80px;
        }
        .disabled {
          opacity: 0.5;
          pointer-events: none;
        }
      </style>
      
      <div class="checkbox-row">
        <input type="checkbox" id="task-status" ${isEdit && task.status === 'completed' ? 'checked' : ''}>
        <label for="task-status">${isSpanish ? 'Tarea completada' : 'Task completed'}</label>
      </div>
      
      <div class="form-row">
        <label for="task-summary">${isSpanish ? 'Nombre de la tarea' : 'Task name'} *</label>
        <input type="text" id="task-summary" value="${isEdit ? this._escapeHtml(task.summary) : ''}" required>
      </div>
      
      <div class="form-row">
        <label for="task-description">${isSpanish ? 'Descripción' : 'Description'}</label>
        <textarea id="task-description">${isEdit && task.description ? this._escapeHtml(task.description) : ''}</textarea>
      </div>
      
      <div class="form-row">
        <label for="task-due">${isSpanish ? 'Fecha de vencimiento' : 'Due date'}</label>
        <input type="date" id="task-due" value="${isEdit && task.due ? task.due : ''}">
      </div>
      
      <div class="section-title">${isSpanish ? 'Repetición' : 'Recurrence'}</div>
      
      <div class="checkbox-row">
        <input type="checkbox" id="recurrence-enabled" ${recurrenceData?.recurrence_enabled ? 'checked' : ''}>
        <label for="recurrence-enabled">${isSpanish ? 'Activar repetición' : 'Enable recurrence'}</label>
      </div>
      
      <div id="recurrence-settings" class="${recurrenceData?.recurrence_enabled ? '' : 'disabled'}">
        <div class="inline-fields">
          <div class="form-row">
            <label for="recurrence-interval">${isSpanish ? 'Cada' : 'Every'}</label>
            <input type="number" id="recurrence-interval" min="1" max="365" value="${recurrenceData?.recurrence_interval || 1}">
          </div>
          <div class="form-row">
            <label for="recurrence-unit">${isSpanish ? 'Unidad' : 'Unit'}</label>
            <select id="recurrence-unit">
              <option value="days" ${recurrenceData?.recurrence_unit === 'days' || !recurrenceData ? 'selected' : ''}>${isSpanish ? 'días' : 'days'}</option>
              <option value="weeks" ${recurrenceData?.recurrence_unit === 'weeks' ? 'selected' : ''}>${isSpanish ? 'semanas' : 'weeks'}</option>
              <option value="months" ${recurrenceData?.recurrence_unit === 'months' ? 'selected' : ''}>${isSpanish ? 'meses' : 'months'}</option>
              <option value="years" ${recurrenceData?.recurrence_unit === 'years' ? 'selected' : ''}>${isSpanish ? 'años' : 'years'}</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="section-title">${isSpanish ? 'Detener repetición' : 'Stop recurrence'}</div>
      
      <div class="checkbox-row">
        <input type="checkbox" id="recurrence-end-enabled" ${recurrenceData?.recurrence_end_enabled ? 'checked' : ''}>
        <label for="recurrence-end-enabled">${isSpanish ? 'Activar límite de repetición' : 'Enable recurrence limit'}</label>
      </div>
      
      <div id="recurrence-end-settings" class="${recurrenceData?.recurrence_end_enabled ? '' : 'disabled'}">
        <div class="radio-group">
          <div class="radio-option">
            <input type="radio" id="end-type-count" name="end-type" value="count" 
              ${!recurrenceData?.recurrence_end_type || recurrenceData?.recurrence_end_type === 'count' ? 'checked' : ''}>
            <label for="end-type-count">${isSpanish ? 'Después de' : 'After'}</label>
            <input type="number" id="recurrence-end-count" min="1" max="999" value="${recurrenceData?.recurrence_end_count || 1}" 
              style="width: 100px; margin-right: 8px;">
            <span>${isSpanish ? 'repeticiones' : 'repetitions'}</span>
          </div>
          <div class="radio-option">
            <input type="radio" id="end-type-date" name="end-type" value="date"
              ${recurrenceData?.recurrence_end_type === 'date' ? 'checked' : ''}>
            <label for="end-type-date">${isSpanish ? 'Hasta' : 'Until'}</label>
            <input type="date" id="recurrence-end-date" value="${recurrenceData?.recurrence_end_date || ''}" style="flex: 1;">
          </div>
        </div>
      </div>
    `;
    
    dialog.appendChild(content);
    
    // Add event listeners for checkbox toggles
    const recurrenceEnabledCheckbox = content.querySelector('#recurrence-enabled');
    const recurrenceSettings = content.querySelector('#recurrence-settings');
    const recurrenceEndEnabledCheckbox = content.querySelector('#recurrence-end-enabled');
    const recurrenceEndSettings = content.querySelector('#recurrence-end-settings');
    
    recurrenceEnabledCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        recurrenceSettings.classList.remove('disabled');
      } else {
        recurrenceSettings.classList.add('disabled');
      }
    });
    
    recurrenceEndEnabledCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        recurrenceEndSettings.classList.remove('disabled');
      } else {
        recurrenceEndSettings.classList.add('disabled');
      }
    });
    
    // Add event listeners for radio buttons to select when their inputs are focused
    const endCountInput = content.querySelector('#recurrence-end-count');
    const endDateInput = content.querySelector('#recurrence-end-date');
    const endTypeCountRadio = content.querySelector('#end-type-count');
    const endTypeDateRadio = content.querySelector('#end-type-date');
    
    endCountInput.addEventListener('focus', () => {
      endTypeCountRadio.checked = true;
    });
    
    endDateInput.addEventListener('focus', () => {
      endTypeDateRadio.checked = true;
    });
    
    // Set dialog properties
    dialog.setAttribute('open', '');
    dialog.setAttribute('scrimClickAction', '');
    dialog.setAttribute('escapeKeyAction', '');
    
    // Add action buttons
    const actionsDiv = document.createElement('div');
    actionsDiv.slot = 'primaryAction';
    actionsDiv.innerHTML = `
      <mwc-button>
        ${isSpanish ? 'Guardar' : 'Save'}
      </mwc-button>
    `;
    dialog.appendChild(actionsDiv);
    
    const secondaryActionsDiv = document.createElement('div');
    secondaryActionsDiv.slot = 'secondaryAction';
    secondaryActionsDiv.innerHTML = `
      <mwc-button>
        ${isSpanish ? 'Cancelar' : 'Cancel'}
      </mwc-button>
    `;
    dialog.appendChild(secondaryActionsDiv);
    
    // Append to body and show
    document.body.appendChild(dialog);
    
    // Setup button click handlers
    const saveButton = dialog.querySelector('[slot="primaryAction"] mwc-button');
    const cancelButton = dialog.querySelector('[slot="secondaryAction"] mwc-button');
    
    saveButton.addEventListener('click', () => {
      this._saveTaskFromDialog(entityId, task, content);
      dialog.close();
    });
    
    cancelButton.addEventListener('click', () => {
      dialog.close();
    });
    
    // Remove dialog from DOM when closed
    dialog.addEventListener('closed', () => {
      document.body.removeChild(dialog);
    });
  }

  /**
   * Save task from dialog
   */
  async _saveTaskFromDialog(entityId, task, content) {
    const isEdit = task !== null;
    
    // Get form values
    const status = content.querySelector('#task-status').checked ? 'completed' : 'needs_action';
    const summary = content.querySelector('#task-summary').value.trim();
    const description = content.querySelector('#task-description').value.trim();
    const due = content.querySelector('#task-due').value;
    
    // Validate required fields
    if (!summary) {
      this._showToast(this._hass.language?.startsWith('es') ? 'El nombre de la tarea es obligatorio' : 'Task name is required');
      return;
    }
    
    // Get recurrence values
    const recurrenceEnabled = content.querySelector('#recurrence-enabled').checked;
    const recurrenceInterval = parseInt(content.querySelector('#recurrence-interval').value) || 1;
    const recurrenceUnit = content.querySelector('#recurrence-unit').value;
    const recurrenceEndEnabled = content.querySelector('#recurrence-end-enabled').checked;
    const endType = content.querySelector('input[name="end-type"]:checked').value;
    const endCount = parseInt(content.querySelector('#recurrence-end-count').value) || 1;
    const endDate = content.querySelector('#recurrence-end-date').value;
    
    try {
      if (isEdit) {
        // Update existing task
        await this._hass.callService('better_todo', 'update_task', {
          entity_id: entityId,
          uid: task.uid,
          summary: summary,
          description: description || null,
          due: due || null,
          status: status,
        });
        
        // Set recurrence if enabled
        if (recurrenceEnabled) {
          const recurrenceData = {
            entity_id: entityId,
            task_uid: task.uid,
            recurrence_enabled: true,
            recurrence_interval: recurrenceInterval,
            recurrence_unit: recurrenceUnit,
            recurrence_end_enabled: recurrenceEndEnabled,
          };
          
          if (recurrenceEndEnabled) {
            recurrenceData.recurrence_end_type = endType;
            if (endType === 'count') {
              recurrenceData.recurrence_end_count = endCount;
            } else {
              recurrenceData.recurrence_end_date = endDate;
            }
          }
          
          await this._hass.callService('better_todo', 'set_task_recurrence', recurrenceData);
        } else {
          // Disable recurrence
          await this._hass.callService('better_todo', 'set_task_recurrence', {
            entity_id: entityId,
            task_uid: task.uid,
            recurrence_enabled: false,
          });
        }
      } else {
        // Create new task
        await this._hass.callService('better_todo', 'create_task', {
          entity_id: entityId,
          summary: summary,
          description: description || undefined,
          due: due || undefined,
        });
        
        // If recurrence is enabled, we need to get the UID of the newly created task
        if (recurrenceEnabled) {
          // Wait for the task to be created and state to update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get the latest state
          const state = this._hass.states[entityId];
          const items = state?.attributes?.items || [];
          
          // Find the newly created task
          const newTask = items.find(i => i.summary === summary && i.status === 'needs_action');
          
          if (newTask) {
            const recurrenceData = {
              entity_id: entityId,
              task_uid: newTask.uid,
              recurrence_enabled: true,
              recurrence_interval: recurrenceInterval,
              recurrence_unit: recurrenceUnit,
              recurrence_end_enabled: recurrenceEndEnabled,
            };
            
            if (recurrenceEndEnabled) {
              recurrenceData.recurrence_end_type = endType;
              if (endType === 'count') {
                recurrenceData.recurrence_end_count = endCount;
              } else {
                recurrenceData.recurrence_end_date = endDate;
              }
            }
            
            await this._hass.callService('better_todo', 'set_task_recurrence', recurrenceData);
          }
        }
      }
    } catch (err) {
      errorLog('Error saving task:', err);
      this._showToast(this._hass.language?.startsWith('es') ? 'Error al guardar la tarea' : 'Error saving task');
    }
  }
}

// Only define the custom element if it hasn't been defined yet
// This prevents the "already been used with this registry" error
if (!customElements.get('better-todo-panel')) {
  customElements.define('better-todo-panel', BetterTodoPanel);
  console.info(
    `%c BETTER-TODO-PANEL %c v${BETTER_TODO_VERSION} `,
    'background-color: #555;color: #fff;font-weight: bold;',
    'background-color: #4caf50;color: #fff;font-weight: bold;'
  );
} else {
  debugLog('better-todo-panel already registered, skipping registration');
}
