/**
 * Better ToDo Dashboard Injector
 * 
 * Following the View Assist pattern, this script dynamically injects native
 * todo-list cards into the Better ToDo dashboard. This ensures full compatibility
 * with Home Assistant's native todo functionality while maintaining a separate
 * dashboard from the native "To-do lists" panel.
 * 
 * Approach:
 * - Detects when user navigates to the Better ToDo dashboard
 * - Dynamically injects native hui-todo-list-card elements for each Better ToDo entity
 * - Uses DOM manipulation similar to View Assist integration
 * - Provides full CRUD functionality through native cards
 */

const BETTER_TODO_INJECTOR_VERSION = "0.9.0";
const DEBUG_MODE = true;

function debugLog(message, ...args) {
  if (DEBUG_MODE) {
    console.log(`[Better ToDo Injector] ${message}`, ...args);
  }
}

function errorLog(message, ...args) {
  console.error(`[Better ToDo Injector ERROR] ${message}`, ...args);
}

class BetterTodoDashboardInjector {
  constructor() {
    this.initialized = false;
    this.currentPath = null;
    this.observedDashboard = null;
    this.injectedCards = new Set();
    
    debugLog('Initializing Better ToDo Dashboard Injector');
    this.init();
  }

  init() {
    // Wait for Home Assistant to be ready
    if (customElements.get('home-assistant')) {
      this.setupObserver();
    } else {
      setTimeout(() => this.init(), 100);
    }
  }

  setupObserver() {
    debugLog('Setting up route observer');
    
    // Listen for route changes
    window.addEventListener('location-changed', () => {
      this.handleRouteChange();
    });
    
    // Check initial route
    this.handleRouteChange();
  }

  handleRouteChange() {
    const path = window.location.pathname;
    
    // Check if we're on the Better ToDo dashboard
    if (path.includes('/better-todo')) {
      debugLog(`Navigated to Better ToDo dashboard: ${path}`);
      
      if (this.currentPath !== path) {
        this.currentPath = path;
        this.injectCards();
      }
    } else {
      this.currentPath = null;
    }
  }

  async injectCards() {
    debugLog('Attempting to inject cards');
    
    // Wait a bit for the dashboard to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const hass = this.getHass();
      if (!hass) {
        errorLog('Home Assistant object not available');
        return;
      }
      
      // Get all Better ToDo entities
      const entities = this.getBetterTodoEntities(hass);
      debugLog(`Found ${entities.length} Better ToDo entities`, entities);
      
      if (entities.length === 0) {
        debugLog('No Better ToDo entities found, nothing to inject');
        return;
      }
      
      // Find the dashboard view container
      const viewContainer = this.findViewContainer();
      if (!viewContainer) {
        errorLog('Could not find view container');
        return;
      }
      
      debugLog('Found view container, injecting cards');
      
      // Clear existing injected cards
      this.injectedCards.clear();
      
      // Inject a card for each entity
      entities.forEach(entityId => {
        if (!this.injectedCards.has(entityId)) {
          this.injectCardForEntity(viewContainer, entityId, hass);
          this.injectedCards.add(entityId);
        }
      });
      
      debugLog(`Injected ${this.injectedCards.size} cards`);
      
    } catch (error) {
      errorLog('Error injecting cards:', error);
    }
  }

  getHass() {
    const homeAssistant = document.querySelector('home-assistant');
    if (homeAssistant && homeAssistant.hass) {
      return homeAssistant.hass;
    }
    return null;
  }

  getBetterTodoEntities(hass) {
    const entities = [];
    
    Object.keys(hass.states).forEach(entityId => {
      if (entityId.startsWith('todo.')) {
        const state = hass.states[entityId];
        // Identify Better ToDo entities by checking for recurrence_data attribute
        if (state.attributes && state.attributes.recurrence_data !== undefined) {
          entities.push(entityId);
        }
      }
    });
    
    return entities.sort();
  }

  findViewContainer() {
    // Try to find the hui-view element (the dashboard view container)
    const homeAssistant = document.querySelector('home-assistant');
    if (!homeAssistant) {
      errorLog('home-assistant element not found');
      return null;
    }
    
    // Navigate through shadow DOMs to find the view
    let root = homeAssistant.shadowRoot;
    if (!root) {
      errorLog('home-assistant shadow root not found');
      return null;
    }
    
    // Find ha-panel-lovelace
    const panelLovelace = root.querySelector('ha-panel-lovelace');
    if (!panelLovelace || !panelLovelace.shadowRoot) {
      errorLog('ha-panel-lovelace not found or no shadow root');
      return null;
    }
    
    // Find hui-root
    const huiRoot = panelLovelace.shadowRoot.querySelector('hui-root');
    if (!huiRoot || !huiRoot.shadowRoot) {
      errorLog('hui-root not found or no shadow root');
      return null;
    }
    
    // Find hui-view (the cards container)
    const huiView = huiRoot.shadowRoot.querySelector('hui-view');
    if (!huiView) {
      errorLog('hui-view not found');
      return null;
    }
    
    debugLog('Found hui-view container');
    return huiView;
  }

  injectCardForEntity(viewContainer, entityId, hass) {
    try {
      // Create a native todo-list card
      const card = document.createElement('hui-todo-list-card');
      
      // Configure the card
      card.setConfig({
        type: 'todo-list',
        entity: entityId,
      });
      
      // Set hass
      card.hass = hass;
      
      // Find the cards container within the view
      let cardsContainer = viewContainer.querySelector('.cards');
      if (!cardsContainer && viewContainer.shadowRoot) {
        cardsContainer = viewContainer.shadowRoot.querySelector('.cards');
      }
      
      if (cardsContainer) {
        cardsContainer.appendChild(card);
        debugLog(`Injected card for ${entityId}`);
      } else {
        errorLog(`Could not find cards container for ${entityId}`);
      }
      
    } catch (error) {
      errorLog(`Error injecting card for ${entityId}:`, error);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new BetterTodoDashboardInjector();
  });
} else {
  new BetterTodoDashboardInjector();
}

console.info(
  `%c BETTER-TODO-INJECTOR %c v${BETTER_TODO_INJECTOR_VERSION} `,
  'background-color: #555;color: #fff;font-weight: bold;',
  'background-color: #4caf50;color: #fff;font-weight: bold;'
);
