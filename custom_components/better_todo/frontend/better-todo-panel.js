// Better To-do custom panel: HA To-do panel baseline (v0.5.1a1)
(function () {
  function _definePanel() {
    if (customElements.get("better-todo-panel")) return;

    const LitElement = Object.getPrototypeOf(customElements.get("ha-card"));

    const html = (strings, ...values) => ({ _$litType$: 1, strings, values });

    const css = (strings, ...values) => {
      const cssText = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ""), "");
      let _styleSheet;
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

    const nothing = html``;

    const _mdiChevronDown = "M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z";
    const _mdiCommentProcessingOutline =
      "M10,9V13H14V9M8,9A2,2 0 0,0 6,11V19L10,15H18A2,2 0 0,0 20,13V5A2,2 0 0,0 18,3H8A2,2 0 0,0 6,5V11";
    const _mdiDelete =
      "M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6Z";
    const _mdiDotsVertical =
      "M12,8A2,2 0 0,1 14,10A2,2 0 0,1 12,12A2,2 0 0,1 10,10A2,2 0 0,1 12,8M12,14A2,2 0 0,1 14,16A2,2 0 0,1 12,18A2,2 0 0,1 10,16A2,2 0 0,1 12,14M12,2A2,2 0 0,1 14,4A2,2 0 0,1 12,6A2,2 0 0,1 10,4A2,2 0 0,1 12,2Z";
    const _mdiInformationOutline =
      "M11,9H13V7H11M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M11,17H13V11H11V17Z";
    const _mdiPlus = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";

    const TodoListEntityFeature = {
      CREATE_TODO_ITEM: 1,
    };

    function _supportsFeature(stateObj, feature) {
      const features = stateObj?.attributes?.supported_features;
      return typeof features === "number" && (features & feature) !== 0;
    }

    function _computeStateName(stateObj) {
      const fn = stateObj?.attributes?.friendly_name;
      if (fn !== undefined) return fn || "";
      return stateObj.entity_id
        .substring(stateObj.entity_id.indexOf(".") + 1)
        .replace(/_/g, " ");
    }

    function _stringCompare(a, b, locale) {
      return String(a).localeCompare(String(b), locale || undefined, {
        sensitivity: "base",
      });
    }

    function _getTodoLists(hass, includeHidden = true) {
      if (!hass) return [];
      return Object.keys(hass.states)
        .filter((entityId) => {
          const stateObj = hass.states[entityId];
          return (
            entityId.startsWith("todo.") &&
            stateObj?.state !== "unavailable" &&
            (includeHidden || hass.entities?.[entityId]?.hidden !== true)
          );
        })
        .map((entityId) => ({
          entity_id: entityId,
          name: _computeStateName(hass.states[entityId]),
          stateObj: hass.states[entityId],
        }))
        .sort((a, b) => _stringCompare(a.name, b.name, hass?.locale?.language));
    }

    function _extractSearchParam(name) {
      try {
        return new URL(window.location.href).searchParams.get(name);
      } catch (_) {
        return null;
      }
    }

    function _replaceSearchParams(updates) {
      try {
        const url = new URL(window.location.href);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null || v === undefined || v === "") url.searchParams.delete(k);
          else url.searchParams.set(k, String(v));
        }
        history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
      } catch (_) {
        // ignore URL sync errors
      }
    }

    class BetterTodoPanel extends LitElement {
      static get properties() {
        return {
          hass: { attribute: false },
          narrow: { type: Boolean, reflect: true },
          mobile: { type: Boolean, reflect: true },
          _entityId: { state: true },
        };
      }

      constructor() {
        super();
        this.narrow = false;
        this.mobile = false;
        this._entityId = undefined;
        this._openAddItemFromUrl = false;
        this._showPane = true;
        this._resizeObserver = null;
        this._mql = null;
        this._onMqlChange = null;
      }

      connectedCallback() {
        super.connectedCallback();
        this._mql = window.matchMedia("(max-width: 450px), all and (max-height: 500px)");
        this._onMqlChange = (ev) => {
          this.mobile = ev.matches;
        };
        this._mql.addEventListener("change", this._onMqlChange);
        this.mobile = this._mql.matches;

        this._resizeObserver = new ResizeObserver((entries) => {
          this._showPane = (entries[0]?.contentRect.width ?? 0) > 750;
          this.requestUpdate();
        });
        this._resizeObserver.observe(this);
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        this._mql?.removeEventListener("change", this._onMqlChange);
        this._mql = null;
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
      }

      willUpdate(changedProps) {
        super.willUpdate(changedProps);

        if (!this.hasUpdated && this.hass) {
          this.hass.loadFragmentTranslation?.("lovelace");

          const urlEntityId = _extractSearchParam("entity_id");
          this._openAddItemFromUrl = _extractSearchParam("add_item") === "true";

          if (urlEntityId) {
            this._entityId = urlEntityId;
          } else {
            if (this._entityId && !(this._entityId in this.hass.states)) {
              this._entityId = undefined;
            }
            if (!this._entityId) {
              this._entityId = _getTodoLists(this.hass, false)[0]?.entity_id;
            }
          }
        }

        if ((changedProps.has("_entityId") || !this.hasUpdated) && this.hass) {
          this._setupTodoElement();
        }

        if (!this._openAddItemFromUrl || !this._entityId || !this.hass?.states[this._entityId]) {
          return;
        }

        this._openAddItemFromUrl = false;
        _replaceSearchParams({ add_item: null });

        if (_supportsFeature(this.hass.states[this._entityId], TodoListEntityFeature.CREATE_TODO_ITEM)) {
          this._addItem();
        }
      }

      _setupTodoElement() {
        if (!this._entityId) {
          _replaceSearchParams({ entity_id: null });
          return;
        }
        _replaceSearchParams({ entity_id: this._entityId });
      }

      _cardConfig(entityId) {
        return {
          type: "todo-list",
          entity: entityId,
        };
      }

      _setEntityId(ev) {
        const item = ev.currentTarget;
        this._entityId = item?.value;
      }

      _addItem() {
        if (!this._entityId) return;
        this.dispatchEvent(
          new CustomEvent("show-dialog", {
            bubbles: true,
            composed: true,
            detail: {
              dialogTag: "dialog-todo-item-editor",
              dialogImport: () =>
                customElements.get("dialog-todo-item-editor")
                  ? Promise.resolve()
                  : Promise.race([
                      customElements.whenDefined("dialog-todo-item-editor").then(() => {}),
                      new Promise((r) => setTimeout(r, 2000)),
                    ]),
              dialogParams: { entity: this._entityId },
            },
          })
        );
      }

      _addList() {
        this.dispatchEvent(
          new CustomEvent("show-dialog", {
            bubbles: true,
            composed: true,
            detail: {
              dialogTag: "ha-config-flow",
              dialogImport: () =>
                customElements.get("ha-config-flow")
                  ? Promise.resolve()
                  : Promise.race([
                      customElements.whenDefined("ha-config-flow").then(() => {}),
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

      _showMoreInfoDialog() {
        if (!this._entityId) return;
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            bubbles: true,
            composed: true,
            detail: { entityId: this._entityId },
          })
        );
      }

      _showVoiceCommandDialog() {
        this.dispatchEvent(
          new CustomEvent("show-dialog", {
            bubbles: true,
            composed: true,
            detail: {
              dialogTag: "ha-voice-command-dialog",
              dialogImport: () =>
                customElements.get("ha-voice-command-dialog")
                  ? Promise.resolve()
                  : Promise.race([
                      customElements.whenDefined("ha-voice-command-dialog").then(() => {}),
                      new Promise((r) => setTimeout(r, 2000)),
                    ]),
              dialogParams: { pipeline_id: "last_used" },
            },
          })
        );
      }

      async _deleteList() {
        if (!this._entityId || !this.hass?.entities?.[this._entityId]) return;
        const entry = this.hass.entities[this._entityId];
        const platform = entry?.platform;
        const entryId = entry?.config_entry_id;

        if (!(platform === "local_todo" || platform === "better_todo") || !entryId) {
          return;
        }

        const listName = this.hass?.states?.[this._entityId]
          ? _computeStateName(this.hass.states[this._entityId])
          : this._entityId;

        const confirmed = window.confirm(
          this.hass?.localize?.("ui.panel.todo.delete_confirm_title", { name: listName }) ||
            `Delete list ${listName}?`
        );
        if (!confirmed) return;

        try {
          await this.hass.callApi("DELETE", `config/config_entries/entry/${entryId}`);
        } catch (_) {
          // ignore
        }

        this._entityId = _getTodoLists(this.hass, false)[0]?.entity_id;
      }

      _isConversationLoaded() {
        const components = this.hass?.config?.components;
        return Array.isArray(components) && components.includes("conversation");
      }

      _handleDropdownSelect(ev) {
        const action = ev?.detail?.item?.value;
        if (!action) return;
        switch (action) {
          case "info":
            this._showMoreInfoDialog();
            break;
          case "assist":
            this._showVoiceCommandDialog();
            break;
          case "delete":
            this._deleteList();
            break;
          default:
            break;
        }
      }

      render() {
        const entityRegistryEntry = this._entityId ? this.hass?.entities?.[this._entityId] : undefined;
        const entityState = this._entityId ? this.hass?.states?.[this._entityId] : undefined;
        const showPane = this._showPane ?? !this.narrow;

        const listItems = _getTodoLists(this.hass, false).map(
          (list) => html`
            <ha-dropdown-item
              @click=${this._setEntityId.bind(this)}
              value=${list.entity_id}
              .selected=${list.entity_id === this._entityId}
            >
              <ha-state-icon .stateObj=${list.stateObj} slot="icon"></ha-state-icon>
              ${list.name}
            </ha-dropdown-item>
          `
        );

        return html`
          <ha-two-pane-top-app-bar-fixed .pane=${showPane} footer .narrow=${this.narrow}>
            <ha-menu-button
              slot="navigationIcon"
              .hass=${this.hass}
              .narrow=${this.narrow}
            ></ha-menu-button>

            <div slot="title">
              ${!showPane
                ? html`
                    <ha-dropdown class="lists">
                      <ha-button slot="trigger">
                        <div>
                          ${this._entityId
                            ? entityState
                              ? _computeStateName(entityState)
                              : this._entityId
                            : nothing}
                        </div>
                        <ha-svg-icon slot="end" .path=${_mdiChevronDown}></ha-svg-icon>
                      </ha-button>
                      ${listItems}
                      ${this.hass?.user?.is_admin
                        ? html`
                            <wa-divider></wa-divider>
                            <ha-dropdown-item @click=${this._addList.bind(this)}>
                              <ha-svg-icon .path=${_mdiPlus} slot="icon"></ha-svg-icon>
                              ${this.hass?.localize("ui.panel.todo.create_list") || "Create list"}
                            </ha-dropdown-item>
                          `
                        : nothing}
                    </ha-dropdown>
                  `
                : this.hass?.localize("panel.todo") || "To-do"}
            </div>

            <ha-list slot="pane" activatable>${listItems}</ha-list>

            ${showPane && this.hass?.user?.is_admin
              ? html`
                  <ha-list-item graphic="icon" slot="pane-footer" @click=${this._addList.bind(this)}>
                    <ha-svg-icon .path=${_mdiPlus} slot="graphic"></ha-svg-icon>
                    ${this.hass?.localize("ui.panel.todo.create_list") || "Create list"}
                  </ha-list-item>
                `
              : nothing}

            <ha-dropdown slot="actionItems" @wa-select=${this._handleDropdownSelect.bind(this)}>
              <ha-icon-button slot="trigger" .label=${""} .path=${_mdiDotsVertical}></ha-icon-button>

              ${this._isConversationLoaded()
                ? html`
                    <ha-dropdown-item value="info" .disabled=${!this._entityId}>
                      <ha-svg-icon .path=${_mdiInformationOutline} slot="icon"></ha-svg-icon>
                      ${this.hass?.localize("ui.panel.todo.information") || "Information"}
                    </ha-dropdown-item>
                  `
                : nothing}

              <wa-divider></wa-divider>

              <ha-dropdown-item value="assist">
                <ha-svg-icon .path=${_mdiCommentProcessingOutline} slot="icon"></ha-svg-icon>
                ${this.hass?.localize("ui.panel.todo.assist") || "Assist"}
              </ha-dropdown-item>

              ${entityRegistryEntry?.platform === "local_todo" || entityRegistryEntry?.platform === "better_todo"
                ? html`
                    <wa-divider></wa-divider>
                    <ha-dropdown-item value="delete" variant="danger" .disabled=${!this._entityId}>
                      <ha-svg-icon .path=${_mdiDelete} slot="icon" class="warning"></ha-svg-icon>
                      ${this.hass?.localize("ui.panel.todo.delete_list") || "Delete list"}
                    </ha-dropdown-item>
                  `
                : nothing}
            </ha-dropdown>

            <div id="columns">
              <div class="column">
                ${this._entityId
                  ? html`
                      <hui-card
                        .hass=${this.hass}
                        .config=${this._cardConfig(this._entityId)}
                      ></hui-card>
                    `
                  : nothing}
              </div>
            </div>

            ${entityState && _supportsFeature(entityState, TodoListEntityFeature.CREATE_TODO_ITEM)
              ? html`
                  <ha-button class="fab" size="large" @click=${this._addItem.bind(this)}>
                    <ha-svg-icon slot="start" .path=${_mdiPlus}></ha-svg-icon>
                    ${this.hass?.localize("ui.panel.todo.add_item") || "Add item"}
                  </ha-button>
                `
              : nothing}
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
            ha-dropdown {
              display: inline-block;
              max-width: 100%;
            }
            ha-dropdown ha-button {
              --ha-font-size-m: var(--ha-font-size-l);
            }
            ha-dropdown ha-button div {
              text-overflow: ellipsis;
              width: 100%;
              overflow: hidden;
              white-space: nowrap;
              display: block;
            }
            .fab {
              position: fixed;
              right: calc(16px + var(--safe-area-inset-right, 0px));
              bottom: calc(16px + var(--safe-area-inset-bottom, 0px));
              inset-inline-end: calc(16px + var(--safe-area-inset-right, 0px));
              inset-inline-start: initial;
              --ha-button-box-shadow: var(--ha-box-shadow-l);
            }
            ha-dropdown.lists ha-dropdown-item {
              max-width: 80vw;
            }
          `,
        ];
      }
    }

    customElements.define("better-todo-panel", BetterTodoPanel);
  }

  if (customElements.get("ha-card")) {
    _definePanel();
  } else {
    customElements.whenDefined("ha-card").then(_definePanel);
  }
})();
