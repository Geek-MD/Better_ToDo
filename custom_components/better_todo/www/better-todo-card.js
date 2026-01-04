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
   * Handle item click to edit
   * @param {Event} e - Click event
   */
  _handleItemClick(e) {
    const listItem = e.currentTarget;
    const uid = listItem.dataset.uid;
    
    if (!uid) return;
    
    // Find the item
    const state = this._hass.states[this._config.entity];
    if (!state) return;
    
    const items = state.attributes.todo_items || [];
    const item = items.find(i => i.uid === uid);
    
    if (item) {
      this._openTaskDialog(item);
    }
  }

  /**
   * Handle add task button click
   */
  _handleAddTask() {
    this._openTaskDialog(null);
  }

  /**
   * Open task creation/edit dialog
   * @param {Object|null} item - Item to edit, or null for new item
   */
  _openTaskDialog(item) {
    const isEdit = item !== null;
    const language = this._hass.language || 'en';
    const isSpanish = language.startsWith('es');
    
    // Get recurrence data for the item if editing
    let recurrenceData = null;
    if (isEdit) {
      const state = this._hass.states[this._config.entity];
      recurrenceData = state?.attributes?.recurrence_data?.[item.uid];
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
        <input type="checkbox" id="task-status" ${isEdit && item.status === 'completed' ? 'checked' : ''}>
        <label for="task-status">${isSpanish ? 'Tarea completada' : 'Task completed'}</label>
      </div>
      
      <div class="form-row">
        <label for="task-summary">${isSpanish ? 'Nombre de la tarea' : 'Task name'} *</label>
        <input type="text" id="task-summary" value="${isEdit ? item.summary : ''}" required>
      </div>
      
      <div class="form-row">
        <label for="task-description">${isSpanish ? 'Descripción' : 'Description'}</label>
        <textarea id="task-description">${isEdit && item.description ? item.description : ''}</textarea>
      </div>
      
      <div class="form-row">
        <label for="task-due">${isSpanish ? 'Fecha de vencimiento' : 'Due date'}</label>
        <input type="date" id="task-due" value="${isEdit && item.due ? item.due : ''}">
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
    
    // Setup button click handlers (since @click in innerHTML doesn't work)
    const saveButton = dialog.querySelector('[slot="primaryAction"] mwc-button');
    const cancelButton = dialog.querySelector('[slot="secondaryAction"] mwc-button');
    
    saveButton.addEventListener('click', () => {
      this._saveTask(item, content);
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
   * @param {Object|null} item - Original item if editing, null if creating
   * @param {HTMLElement} content - Dialog content element
   */
  async _saveTask(item, content) {
    const isEdit = item !== null;
    
    // Get form values
    const status = content.querySelector('#task-status').checked ? 'completed' : 'needs_action';
    const summary = content.querySelector('#task-summary').value.trim();
    const description = content.querySelector('#task-description').value.trim();
    const due = content.querySelector('#task-due').value;
    
    // Validate required fields
    if (!summary) {
      alert(this._hass.language?.startsWith('es') ? 'El nombre de la tarea es obligatorio' : 'Task name is required');
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
          entity_id: this._config.entity,
          uid: item.uid,
          summary: summary,
          description: description || null,
          due: due || null,
          status: status,
        });
        
        // Set recurrence if enabled
        if (recurrenceEnabled) {
          const recurrenceData = {
            entity_id: this._config.entity,
            task_uid: item.uid,
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
            entity_id: this._config.entity,
            task_uid: item.uid,
            recurrence_enabled: false,
          });
        }
      } else {
        // Create new task
        await this._hass.callService('better_todo', 'create_task', {
          entity_id: this._config.entity,
          summary: summary,
          description: description || undefined,
          due: due || undefined,
        });
        
        // If recurrence is enabled, we need to get the UID of the newly created task
        // Note: This is a limitation since the create_task service doesn't return the UID.
        // We wait for state update and find the task by matching summary.
        // This could fail if multiple tasks have the same summary or if task creation
        // takes longer than expected. A future improvement would be for the backend
        // service to return the created task UID.
        if (recurrenceEnabled) {
          // Wait for the task to be created and state to update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get the latest state
          const state = this._hass.states[this._config.entity];
          const items = state?.attributes?.todo_items || [];
          
          // Find the newly created task (first one with matching summary that's not a header)
          // Note: This assumes task summaries are reasonably unique
          const newTask = items.find(i => i.summary === summary && !i.uid.startsWith('header_'));
          
          if (newTask) {
            const recurrenceData = {
              entity_id: this._config.entity,
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
      console.error('Error saving task:', err);
      alert(this._hass.language?.startsWith('es') ? 'Error al guardar la tarea' : 'Error saving task');
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
        <ha-icon-button class="add-task-button" style="margin-left: auto;">
          <ha-icon icon="mdi:plus"></ha-icon>
        </ha-icon-button>
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
    
    // Add event listener for add task button
    const addButton = this._cardElement.querySelector('.add-task-button');
    if (addButton) {
      addButton.addEventListener('click', () => this._handleAddTask());
    }
    
    // Add event listeners for checkboxes
    this._cardElement.querySelectorAll('ha-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => this._handleCheckboxChange(e));
    });
    
    // Add event listeners for item clicks (for editing)
    this._cardElement.querySelectorAll('ha-check-list-item').forEach(item => {
      const uid = item.dataset.uid;
      if (uid) {
        item.style.cursor = 'pointer';
        item.addEventListener('click', (e) => {
          // Don't trigger edit if clicking on checkbox
          if (e.target.tagName !== 'HA-CHECKBOX' && !e.target.closest('ha-checkbox')) {
            this._handleItemClick(e);
          }
        });
      }
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
      <ha-check-list-item data-uid="${item.uid}">
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
  '%c BETTER-TODO-CARD %c v0.6.6 ',
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
