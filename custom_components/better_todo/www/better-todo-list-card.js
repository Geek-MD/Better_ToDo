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

const BETTER_TODO_LIST_CARD_VERSION = "0.10.0";
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
    // Add button - open dialog instead of inline form
    const addButton = this.querySelector('#add-button');
    if (addButton) {
      addButton.addEventListener('click', () => this._openTaskDialog(null));
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

    // Click on item to edit
    const items = this.querySelectorAll('.todo-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking on checkbox
        if (e.target.tagName !== 'HA-CHECKBOX') {
          const uid = item.dataset.uid;
          debugLog('Item clicked:', uid);
          this._handleItemClick(uid);
        }
      });
    });
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

  _handleItemClick(uid) {
    if (!uid || !this._entityId) return;
    
    // Find the item
    const entityState = this._hass.states[this._entityId];
    if (!entityState) return;
    
    const items = entityState.attributes.items || [];
    const item = items.find(i => i.uid === uid);
    
    if (item) {
      this._openTaskDialog(item);
    }
  }

  _openTaskDialog(item) {
    const isEdit = item !== null;
    const language = this._hass.language || 'en';
    const isSpanish = language.startsWith('es');
    
    // Get recurrence data for the item if editing
    let recurrenceData = null;
    if (isEdit) {
      const entityState = this._hass.states[this._entityId];
      recurrenceData = entityState?.attributes?.recurrence_data?.[item.uid];
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
        <input type="text" id="task-summary" value="${isEdit ? this._escapeHtml(item.summary) : ''}" required>
      </div>
      
      <div class="form-row">
        <label for="task-description">${isSpanish ? 'Descripción' : 'Description'}</label>
        <textarea id="task-description">${isEdit && item.description ? this._escapeHtml(item.description) : ''}</textarea>
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
    
    // Add event listeners for radio buttons
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
    
    // Append to body
    document.body.appendChild(dialog);
    
    // Setup button handlers
    const saveButton = dialog.querySelector('[slot="primaryAction"] mwc-button');
    const cancelButton = dialog.querySelector('[slot="secondaryAction"] mwc-button');
    
    saveButton.addEventListener('click', () => {
      this._saveTask(item, content);
      dialog.close();
    });
    
    cancelButton.addEventListener('click', () => {
      dialog.close();
    });
    
    // Remove dialog when closed
    dialog.addEventListener('closed', () => {
      document.body.removeChild(dialog);
    });
  }

  async _saveTask(item, content) {
    const isEdit = item !== null;
    
    // Get form values
    const status = content.querySelector('#task-status').checked ? 'completed' : 'needs_action';
    const summary = content.querySelector('#task-summary').value.trim();
    const description = content.querySelector('#task-description').value.trim();
    const due = content.querySelector('#task-due').value;
    
    // Validate
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
          entity_id: this._entityId,
          uid: item.uid,
          summary: summary,
          description: description || null,
          due: due || null,
          status: status,
        });
        
        // Set recurrence
        if (recurrenceEnabled) {
          const recurrenceData = {
            entity_id: this._entityId,
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
            entity_id: this._entityId,
            task_uid: item.uid,
            recurrence_enabled: false,
          });
        }
      } else {
        // Create new task
        await this._hass.callService('better_todo', 'create_task', {
          entity_id: this._entityId,
          summary: summary,
          description: description || undefined,
          due: due || undefined,
        });
        
        // If recurrence enabled, set it on new task
        if (recurrenceEnabled) {
          // Wait for state update
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const entityState = this._hass.states[this._entityId];
          const items = entityState?.attributes?.items || [];
          const newTask = items.find(i => i.summary === summary && !i.uid.startsWith('header_'));
          
          if (newTask) {
            const recurrenceData = {
              entity_id: this._entityId,
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
      
      debugLog('Task saved successfully');
    } catch (error) {
      errorLog('Error saving task:', error);
      alert(this._hass.language?.startsWith('es') ? 'Error al guardar la tarea' : 'Error saving task');
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
