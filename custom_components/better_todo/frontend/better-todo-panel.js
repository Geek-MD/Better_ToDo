// Better To-do custom panel
// LitElement is accessed from HA's already-loaded component registry (no CDN required).
// html/css shims produce objects matching Lit 3's internal TemplateResult and CSSResult
// structures so that the LitElement rendering engine (from HA's bundle) processes them
// correctly.
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

class BetterTodoPanel extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      narrow: { type: Boolean, reflect: true },
      mobile: { type: Boolean, reflect: true },
      _showPane: { state: true },
    };
  }

  constructor() {
    super();
    this.narrow = false;
    this.mobile = false;
    this._showPane = false;
    this._resizeObserver = null;
    this._mql = null;
    this._onMqlChange = null;
  }

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

  render() {
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

        <div slot="title">Better ToDo</div>

        <!-- Left pane: empty — content will be added in future iterations -->
        <ha-list slot="pane" activatable></ha-list>

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
