// Better To-do custom panel
// LitElement is accessed from HA's already-loaded component registry (no CDN required).
// html/css shims produce objects matching Lit 3's internal TemplateResult and CSSResult
// structures so that the LitElement rendering engine (from HA's bundle) processes them
// correctly.
//
// Registration strategy (two paths):
//
//  1. SYNCHRONOUS PATH (common case): When this script executes, HA's core bundle
//     has already run and ha-card is defined. We define better-todo-panel immediately,
//     BEFORE the script's onload event fires. HA's panel_custom resolves its
//     loadCustomPanel() promise on that onload event, then calls
//     document.createElement("better-todo-panel") — which by then finds our element
//     properly registered.
//
//  2. ASYNC FALLBACK PATH (rare fresh-load edge case): If this script somehow executes
//     before ha-card is registered (e.g. the panel bundle loads ahead of the core
//     bundle during a cold start), we fall back to customElements.whenDefined("ha-card").
//     The browser's upgrade mechanism then kicks in: HA creates an HTMLElement
//     placeholder, we define our class shortly after, and the browser upgrades the
//     existing placeholder to our LitElement-based component.
(function () {
  function _definePanel() {
    // Guard: do not register twice (e.g. if the script is somehow executed more than once).
    if (customElements.get("better-todo-panel")) return;

    const LitElement = Object.getPrototypeOf(customElements.get("ha-card"));

    const html = (strings, ...values) => ({ _$litType$: 1, strings, values });

    const css = (strings, ...values) => {
      const cssText = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
      let _styleSheet;
      // Provide a lazy `styleSheet` getter so Lit 3's `adoptStyles` can use the
      // Constructable StyleSheets path (`adoptedStyleSheets`) in modern browsers.
      // Without this getter, `adoptStyles` receives `undefined` for every entry
      // and the `adoptedStyleSheets = [undefined]` assignment throws a TypeError,
      // which prevents the shadow root from being created and leaves the panel blank.
      return {
        cssText,
        _$cssResult$: true,
        get styleSheet() {
          if (_styleSheet === undefined) {
            _styleSheet = new CSSStyleSheet();
            _styleSheet.replaceSync(cssText);
          }
          return _styleSheet;
        },
      };
    };

    // MDI Plus icon path (mdiPlus from @mdi/js).
    const _mdiPlus = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";

    // Compute a human-readable name for a state object, mirroring HA's
    // computeStateName helper: use attributes.friendly_name when available,
    // otherwise derive from the entity_id object-id part.
    function _computeStateName(stateObj) {
      const fn = stateObj.attributes?.friendly_name;
      if (fn !== undefined) return fn || "";
      return stateObj.entity_id
        .substring(stateObj.entity_id.indexOf(".") + 1)
        .replace(/_/g, " ");
    }

    class BetterTodoPanel extends LitElement {
      static get properties() {
        return {
          hass: { attribute: false },
          narrow: { type: Boolean, reflect: true },
          mobile: { type: Boolean, reflect: true },
          _showPane: { state: true },
          _selectedEntityId: { state: true },
        };
      }

      constructor() {
        super();
        this.narrow = false;
        this.mobile = false;
        this._showPane = false;
        // Restore last selected list from session storage so navigation
        // back to the panel re-opens the same list.
        try {
          this._selectedEntityId =
            sessionStorage.getItem("better-todo-selected-entity") || null;
        } catch (_) {
          this._selectedEntityId = null;
        }
        this._resizeObserver = null;
        this._mql = null;
        this._onMqlChange = null;
      }

      // -----------------------------------------------------------------------
      // Helpers
      // -----------------------------------------------------------------------

      /** Returns all todo-domain state objects, sorted alphabetically with the
       *  Better To-do Shopping List pinned to the end of the list. */
      _getTodoLists() {
        if (!this.hass) return [];
        const entities = Object.values(this.hass.states).filter(
          (s) => s.entity_id.startsWith("todo.")
        );
        entities.sort((a, b) => {
          const aShop = this._isShoppingList(a.entity_id);
          const bShop = this._isShoppingList(b.entity_id);
          if (aShop && !bShop) return 1;
          if (!aShop && bShop) return -1;
          return _computeStateName(a).localeCompare(_computeStateName(b));
        });
        return entities;
      }

      /** Returns true if the given entity_id belongs to the built-in Better
       *  To-do Shopping List (identified via the entity registry unique_id). */
      _isShoppingList(entityId) {
        const entry = this.hass?.entities?.[entityId];
        return (
          entry?.platform === "better_todo" &&
          entry?.unique_id?.includes("default_shopping_list")
        );
      }

      // -----------------------------------------------------------------------
      // Event handlers
      // -----------------------------------------------------------------------

      _setSelectedEntity(entityId) {
        this._selectedEntityId = entityId;
        try {
          sessionStorage.setItem("better-todo-selected-entity", entityId);
        } catch (_) {
          // ignore
        }
      }

      /** Open the Better To-do config flow to create a new list.
       *  Dispatches the same show-dialog event that ha-panel-todo uses so that
       *  HA's app shell opens the standard config-flow dialog inline. */
      _addList() {
        this.dispatchEvent(
          new CustomEvent("show-dialog", {
            bubbles: true,
            composed: true,
            detail: {
              dialogTag: "ha-config-flow",
              // Resolve immediately if the dialog element is already registered;
              // otherwise wait up to 2 s for HA to register it (it is loaded
              // lazily by the config/integrations section).
              dialogImport: () =>
                customElements.get("ha-config-flow")
                  ? Promise.resolve()
                  : Promise.race([
                      customElements
                        .whenDefined("ha-config-flow")
                        .then(() => {}),
                      new Promise((r) => setTimeout(r, 2000)),
                    ]),
              dialogParams: {
                startFlowHandler: "better_todo",
                showAdvanced: this.hass?.userData?.showAdvanced ?? false,
              },
            },
          })
        );
      }

      // -----------------------------------------------------------------------
      // Lifecycle
      // -----------------------------------------------------------------------

      connectedCallback() {
        super.connectedCallback();

        // Mirror ha-panel-todo's ResizeController: show left pane when width > 750 px.
        this._resizeObserver = new ResizeObserver((entries) => {
          const showPane = (entries[0]?.contentRect.width ?? 0) > 750;
          if (showPane !== this._showPane) {
            this._showPane = showPane;
          }
        });
        this._resizeObserver.observe(this);

        // Mirror ha-panel-todo's MediaQueryList: detect mobile viewport.
        this._mql = window.matchMedia(
          "(max-width: 450px), all and (max-height: 500px)"
        );
        this._onMqlChange = (ev) => {
          this.mobile = ev.matches;
        };
        this._mql.addEventListener("change", this._onMqlChange);
        this.mobile = this._mql.matches;
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        this._mql?.removeEventListener("change", this._onMqlChange);
        this._mql = null;
      }

      willUpdate(changedProps) {
        super.willUpdate(changedProps);
        // Auto-select the first available list when nothing is selected (or when
        // the previously selected entity no longer exists in the state machine).
        if (this.hass) {
          const lists = this._getTodoLists();
          if (
            !this._selectedEntityId ||
            !this.hass.states[this._selectedEntityId]
          ) {
            const firstId = lists[0]?.entity_id ?? null;
            if (this._selectedEntityId !== firstId) {
              this._selectedEntityId = firstId;
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // Rendering
      // -----------------------------------------------------------------------

      render() {
        const lists = this._getTodoLists();

        const listItems = lists.map(
          (list) => html`
            <ha-list-item
              graphic="icon"
              .activated=${list.entity_id === this._selectedEntityId}
              @click=${() => this._setSelectedEntity(list.entity_id)}
            >
              <ha-state-icon
                .stateObj=${list}
                slot="graphic"
              ></ha-state-icon>
              ${_computeStateName(list)}
            </ha-list-item>
          `
        );

        // "Create list" label: reuse HA's own translation key so the label is
        // automatically localised in every language HA supports.
        const createListLabel =
          this.hass?.localize("ui.panel.todo.create_list") || "Create list";

        return html`
          <ha-two-pane-top-app-bar-fixed
            .pane=${this._showPane}
            footer
            .narrow=${this.narrow}
          >
            <ha-menu-button
              slot="navigationIcon"
              .hass=${this.hass}
              .narrow=${this.narrow}
            ></ha-menu-button>

            <span slot="title">Better ToDo</span>

            <!-- Left pane: sorted todo lists -->
            <ha-list slot="pane" activatable>${listItems}</ha-list>

            <!-- "Create list" footer (visible only when the pane is shown) -->
            ${this._showPane
              ? html`
                  <ha-list-item
                    graphic="icon"
                    slot="pane-footer"
                    @click=${this._addList}
                  >
                    <ha-svg-icon
                      .path=${_mdiPlus}
                      slot="graphic"
                    ></ha-svg-icon>
                    ${createListLabel}
                  </ha-list-item>
                `
              : ""}

            <!-- Action menu: hidden until needed -->
            <div slot="actionItems" hidden></div>

            <!-- Right content: empty — content will be added in future iterations -->
            <div id="columns">
              <div class="column"></div>
            </div>
          </ha-two-pane-top-app-bar-fixed>
        `;
      }

      static get styles() {
        return [
          css`
            :host {
              display: block;
            }
            #columns {
              display: flex;
              flex-direction: row;
              justify-content: center;
              margin: 8px;
              padding-bottom: 70px;
            }
            .column {
              flex: 1 0 0;
              max-width: 500px;
              min-width: 0;
            }
          `,
        ];
      }
    }

    customElements.define("better-todo-panel", BetterTodoPanel);
  }

  // ── Registration entry point ────────────────────────────────────────────────
  // Attempt the synchronous path first (see module-level comment above).
  if (customElements.get("ha-card")) {
    _definePanel();
  } else {
    // Async fallback: ha-card will be defined shortly as HA's core bundle finishes
    // executing. whenDefined resolves as a microtask once that happens.
    customElements.whenDefined("ha-card").then(_definePanel);
  }
})();
