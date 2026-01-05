/**
 * Better ToDo Panel Injection
 * 
 * This script injects todo-list cards directly into the Better ToDo dashboard panel
 * using DOM manipulation, similar to the View Assist approach.
 * This eliminates the need for custom card definitions and JavaScript module registration.
 */

const BETTER_TODO_VERSION = "0.7.0";

// Utility function to wait for an element to be defined and updated
async function awaitElement(el, hard = false) {
  if (el.localName?.includes("-"))
    await customElements.whenDefined(el.localName);
  if (el.updateComplete) await el.updateComplete;
  if (hard) {
    if (el.pageRendered) await el.pageRendered;
    if (el._panelState) {
      let rounds = 0;
      while (el._panelState !== "loaded" && rounds++ < 5)
        await new Promise((r) => setTimeout(r, 100));
    }
  }
}

// Utility function to traverse shadow DOM
async function _selectTree(root, path, all = false) {
  let el = [root];
  if (typeof path === "string") {
    path = path.split(/(\$| )/);
  }
  while (path[path.length - 1] === "") path.pop();
  for (const p of path) {
    const e = el[0];
    if (!e) return null;

    if (!p.trim().length) continue;

    await awaitElement(e);
    el = p === "$" ? [e.shadowRoot] : e.querySelectorAll(p);
  }
  return all ? el : el[0];
}

async function selectTree(root, path, all = false, timeout = 10000) {
  return Promise.race([
    _selectTree(root, path, all),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), timeout)
    ),
  ]).catch((err) => {
    return null;
  });
}

// Get hass object
async function getHass() {
  await Promise.race([
    customElements.whenDefined("home-assistant"),
    customElements.whenDefined("hc-main"),
  ]);

  const element = customElements.get("home-assistant")
    ? "home-assistant"
    : "hc-main";

  while (!document.querySelector(element))
    await new Promise((r) => window.setTimeout(r, 100));
  
  const base = document.querySelector(element);
  while (!base.hass) await new Promise((r) => window.setTimeout(r, 100));
  return base.hass;
}

class BetterTodoPanel {
  constructor() {
    this.hass = null;
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 20;
    
    setTimeout(() => this.initialize(), 100);
  }

  async initialize() {
    try {
      this.hass = await getHass();
      
      // Wait for location changes to inject cards
      window.addEventListener("location-changed", () => {
        setTimeout(() => this.injectCards(), 300);
      });
      
      // Initial injection
      await this.injectCards();
      
      this.initialized = true;
      console.log("Better ToDo panel initialized");
    } catch (e) {
      console.error("Error initializing Better ToDo panel:", e);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => this.initialize(), 1000);
      }
    }
  }

  async injectCards() {
    // Only inject if we're on the Better ToDo dashboard
    if (!window.location.pathname.includes("/better-todo")) {
      return;
    }

    try {
      // Find the hui-view element
      const huiView = await selectTree(
        document.body,
        "home-assistant $ home-assistant-main $ partial-panel-resolver ha-panel-lovelace $ hui-root $ div hui-view"
      );

      if (!huiView) {
        console.log("Better ToDo: hui-view not found, will retry");
        return;
      }

      // Check if cards are already injected
      if (huiView.querySelector("#better-todo-injected-cards")) {
        return;
      }

      // Get all Better ToDo entities
      const entities = this.getBetterTodoEntities();
      
      if (entities.length === 0) {
        console.log("Better ToDo: No entities found");
        return;
      }

      // Create container for cards
      const container = document.createElement("div");
      container.id = "better-todo-injected-cards";
      container.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
        gap: 16px;
        padding: 16px;
      `;

      // Create todo-list card for each entity
      for (const entityId of entities) {
        const card = await this.createTodoCard(entityId);
        if (card) {
          container.appendChild(card);
        }
      }

      // Clear existing content and add our cards
      huiView.innerHTML = "";
      huiView.appendChild(container);

      console.log(`Better ToDo: Injected ${entities.length} cards`);
    } catch (e) {
      console.error("Error injecting Better ToDo cards:", e);
    }
  }

  getBetterTodoEntities() {
    if (!this.hass) return [];
    
    const entities = [];
    Object.keys(this.hass.states).forEach(entityId => {
      if (entityId.startsWith('better_todo.')) {
        const state = this.hass.states[entityId];
        // Check if this is a Better ToDo entity
        // We can identify them by checking if they have our custom attributes
        if (state.attributes && state.attributes.recurrence_data !== undefined) {
          entities.push(entityId);
        }
      }
    });
    
    return entities.sort();
  }

  async createTodoCard(entityId) {
    const state = this.hass.states[entityId];
    if (!state) return null;

    // Create a native todo-list card element
    const card = document.createElement("hui-todo-list-card");
    
    // Set the configuration
    card.setConfig({
      type: "todo-list",
      entity: entityId,
    });

    // Set hass
    card.hass = this.hass;

    // Wrap in ha-card for proper styling
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display: block;";
    wrapper.appendChild(card);

    return wrapper;
  }

  // Update cards when hass state changes
  updateCards() {
    if (!this.initialized) return;
    
    const container = document.querySelector("#better-todo-injected-cards");
    if (!container) return;

    // Update hass for all cards
    const cards = container.querySelectorAll("hui-todo-list-card");
    cards.forEach(card => {
      if (card.hass !== this.hass) {
        card.hass = this.hass;
      }
    });
  }
}

// Initialize when Home Assistant is ready
Promise.all([
  customElements.whenDefined("home-assistant"),
  customElements.whenDefined("hui-view"),
]).then(() => {
  console.info(
    `%c BETTER-TODO-PANEL %c v${BETTER_TODO_VERSION} `,
    "background-color: #555;color: #fff;font-weight: bold;",
    "background-color: #4caf50;color: #fff;font-weight: bold;"
  );
  
  window.betterTodoPanel = new BetterTodoPanel();
  
  // Subscribe to hass updates
  window.addEventListener("hass-more-info", () => {
    window.betterTodoPanel?.updateCards();
  });
});
