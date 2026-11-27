// Better To-do custom panel
// LitElement is accessed from HA's already-loaded component registry (no CDN required).
// html/css shims produce objects matching Lit 3's internal TemplateResult and CSSResult
// structures so that the LitElement rendering engine (from HA's bundle) processes them
// correctly.
//
// Registration uses any already-defined HA Lit host (normally the application
// root) rather than depending on the lazily loaded ha-card element. If the app
// root is still being registered, the browser upgrades the panel placeholder as
// soon as that first Lit host becomes available.
(function () {
  function _getLitElementBase() {
    const hosts = ["ha-card", "home-assistant", "hc-main", "ha-panel-lovelace"];
    for (const tag of hosts) {
      let constructor = customElements.get(tag);
      while (constructor && constructor !== HTMLElement) {
        // Lit marks the actual LitElement constructor (not its subclasses) with
        // this own static property. Walking to it avoids inheriting HA mixins
        // from application-root elements during a cold load.
        if (Object.prototype.hasOwnProperty.call(constructor, "_$litElement$")) {
          return constructor;
        }
        constructor = Object.getPrototypeOf(constructor);
      }
    }
    return null;
  }

  function _definePanel() {
    // Keep this release's tags separate from older bundles already registered
    // by Home Assistant in the same browser tab.
    if (customElements.get("better-todo-panel-v091")) return;

    const LitElement = _getLitElementBase();
    if (!LitElement) return;

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

    // Font Awesome Free 6.7.2 Solid, Fonticons, Inc. (CC BY 4.0).
    // Original paths: https://github.com/FortAwesome/Font-Awesome/tree/6.7.2/svgs/solid
    const _icons = {
      gear: [512,512,"M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"],
      house: [576,512,"M575.8 255.5c0 18-15 32.1-32 32.1l-32 0 .7 160.2c0 2.7-.2 5.4-.5 8.1l0 16.2c0 22.1-17.9 40-40 40l-16 0c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1L416 512l-24 0c-22.1 0-40-17.9-40-40l0-24 0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32l0 64 0 24c0 22.1-17.9 40-40 40l-24 0-31.9 0c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2l-16 0c-22.1 0-40-17.9-40-40l0-112c0-.9 0-1.9 .1-2.8l0-69.7-32 0c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"],
      circleCheck: [512,512,"M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"],
      squareCheck: [448,512,"M64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L64 32zM337 209L209 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L303 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"],
      cartShopping: [576,512,"M0 24C0 10.7 10.7 0 24 0L69.5 0c22 0 41.5 12.8 50.6 32l411 0c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3l-288.5 0 5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5L488 336c13.3 0 24 10.7 24 24s-10.7 24-24 24l-288.3 0c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5L24 48C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"],
      layerGroup: [576,512,"M264.5 5.2c14.9-6.9 32.1-6.9 47 0l218.6 101c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 149.8C37.4 145.8 32 137.3 32 128s5.4-17.9 13.9-21.8L264.5 5.2zM476.9 209.6l53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 277.8C37.4 273.8 32 265.3 32 256s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0l152-70.2zm-152 198.2l152-70.2 53.2 24.6c8.5 3.9 13.9 12.4 13.9 21.8s-5.4 17.9-13.9 21.8l-218.6 101c-14.9 6.9-32.1 6.9-47 0L45.9 405.8C37.4 401.8 32 393.3 32 384s5.4-17.9 13.9-21.8l53.2-24.6 152 70.2c23.4 10.8 50.4 10.8 73.8 0z"],
      plus: [448,512,"M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z"],
      inbox: [512,512,"M121 32C91.6 32 66 52 58.9 80.5L1.9 308.4C.6 313.5 0 318.7 0 323.9L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-92.1c0-5.2-.6-10.4-1.9-15.5l-57-227.9C446 52 420.4 32 391 32L121 32zm0 64l270 0 48 192-51.2 0c-12.1 0-23.2 6.8-28.6 17.7l-14.3 28.6c-5.4 10.8-16.5 17.7-28.6 17.7l-120.4 0c-12.1 0-23.2-6.8-28.6-17.7l-14.3-28.6c-5.4-10.8-16.5-17.7-28.6-17.7L73 288 121 96z"],
      calendarDays: [448,512,"M128 0c17.7 0 32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 48 0c26.5 0 48 21.5 48 48l0 48L0 160l0-48C0 85.5 21.5 64 48 64l48 0 0-32c0-17.7 14.3-32 32-32zM0 192l448 0 0 272c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 192zm64 80l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm128 0l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM64 400l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zm112 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16z"],
      repeat: [512,512,"M0 224c0 17.7 14.3 32 32 32s32-14.3 32-32c0-53 43-96 96-96l160 0 0 32c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l64-64c12.5-12.5 12.5-32.8 0-45.3l-64-64c-9.2-9.2-22.9-11.9-34.9-6.9S320 19.1 320 32l0 32L160 64C71.6 64 0 135.6 0 224zm512 64c0-17.7-14.3-32-32-32s-32 14.3-32 32c0 53-43 96-96 96l-160 0 0-32c0-12.9-7.8-24.6-19.8-29.6s-25.7-2.2-34.9 6.9l-64 64c-12.5 12.5-12.5 32.8 0 45.3l64 64c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6l0-32 160 0c88.4 0 160-71.6 160-160z"],
      eyeSlash: [640,512,"M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"],
      eye: [576,512,"M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"],
      arrowLeft: [448,512,"M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.2 288 416 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-306.7 0L214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"],
      xmark: [384,512,"M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"],
      bars: [448,512,"M0 96C0 78.3 14.3 64 32 64l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 128C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32L32 448c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"],
      arrowUp: [384,512,"M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2 160 448c0 17.7 14.3 32 32 32s32-14.3 32-32l0-306.7L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"],
      trash: [448,512,"M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"],
      listCheck: [512,512,"M152.1 38.2c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 113C-2.3 103.6-2.3 88.4 7 79s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zm0 160c9.9 8.9 10.7 24 1.8 33.9l-72 80c-4.4 4.9-10.6 7.8-17.2 7.9s-12.9-2.4-17.6-7L7 273c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l22.1 22.1 55.1-61.2c8.9-9.9 24-10.7 33.9-1.8zM224 96c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zm0 160c0-17.7 14.3-32 32-32l224 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32zM160 416c0-17.7 14.3-32 32-32l288 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-288 0c-17.7 0-32-14.3-32-32zM48 368a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"],
    };

    function _icon(name) {
      const [width, height, path] = _icons[name];
      return html`<svg aria-hidden="true" focusable="false" viewBox=${`0 0 ${width} ${height}`}
        width="1em" height="1em" fill="currentColor"><path d=${path}></path></svg>`;
    }

    // ── Shared helpers ───────────────────────────────────────────────────────

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

    const _boardTranslations = {
      en: ["My lists", "New list", "New task", "Hide completed", "Show completed", "List progress", (done, total) => `${done} of ${total} completed`, "No tasks", "Uncategorized", "Could not load tasks"],
      es: ["Mis listas", "Nueva lista", "Nueva tarea", "Ocultar completadas", "Mostrar completadas", "Progreso de la lista", (done, total) => `${done} de ${total} completadas`, "Sin tareas", "Sin categoría", "No se pudieron cargar las tareas"],
      de: ["Meine Listen", "Neue Liste", "Neue Aufgabe", "Erledigte ausblenden", "Erledigte anzeigen", "Listenfortschritt", (done, total) => `${done} von ${total} erledigt`, "Keine Aufgaben", "Ohne Kategorie", "Aufgaben konnten nicht geladen werden"],
      fr: ["Mes listes", "Nouvelle liste", "Nouvelle tâche", "Masquer les tâches terminées", "Afficher les tâches terminées", "Progression de la liste", (done, total) => `${done} sur ${total} terminées`, "Aucune tâche", "Sans catégorie", "Impossible de charger les tâches"],
      pt: ["Minhas listas", "Nova lista", "Nova tarefa", "Ocultar concluídas", "Mostrar concluídas", "Progresso da lista", (done, total) => `${done} de ${total} concluídas`, "Sem tarefas", "Sem categoria", "Não foi possível carregar as tarefas"],
    };
    const _boardText = (hass) => _boardTranslations[hass?.locale?.language?.split("-")[0]] || _boardTranslations.en;
    const _isComplete = (item) => item.status === "completed";

    const _listSettingsTranslations = {
      en: ["List settings", "List name", "Automatic cleanup", "Retention", "Default (1 calendar month)", "Custom period", "Calendar months", "The shopping list shares cleanup settings with the list that hosts it.", "Could not load list settings", "Could not save list settings"],
      es: ["Configurar lista", "Nombre de la lista", "Limpieza automática", "Retención", "Predeterminado (1 mes calendario)", "Plazo personalizado", "Meses calendario", "La lista de compras comparte la limpieza automática con la lista que la contiene.", "No se pudo cargar la configuración de la lista", "No se pudo guardar la configuración de la lista"],
      de: ["Listeneinstellungen", "Listenname", "Automatisches Löschen", "Aufbewahrung", "Standard (1 Kalendermonat)", "Benutzerdefinierte Dauer", "Kalendermonate", "Die Einkaufsliste verwendet die Einstellungen der zugehörigen Liste.", "Listeneinstellungen konnten nicht geladen werden", "Listeneinstellungen konnten nicht gespeichert werden"],
      fr: ["Paramètres de la liste", "Nom de la liste", "Nettoyage automatique", "Durée de conservation", "Par défaut (1 mois calendaire)", "Durée personnalisée", "Mois calendaires", "La liste de courses partage les paramètres de nettoyage de la liste qui l’héberge.", "Impossible de charger les paramètres de la liste", "Impossible d’enregistrer les paramètres de la liste"],
      pt: ["Configurar lista", "Nome da lista", "Limpeza automática", "Retenção", "Padrão (1 mês de calendário)", "Prazo personalizado", "Meses de calendário", "A lista de compras compartilha as configurações de limpeza com a lista que a contém.", "Não foi possível carregar as configurações da lista", "Não foi possível salvar as configurações da lista"],
    };
    const _listSettingsText = (hass) =>
      _listSettingsTranslations[hass?.locale?.language?.split("-")[0]] || _listSettingsTranslations.en;

    const _dueSections = ["overdue", "today", "soon", "scheduled", "pending"];
    const _dueLabels = {
      en: ["Overdue", "Due today", "Due soon", "Scheduled", "Pending"],
      es: ["Vencidas", "Vencen hoy", "Próximas a vencer", "Programadas", "Pendientes"],
      de: ["Überfällig", "Heute fällig", "Bald fällig", "Geplant", "Offen"],
      fr: ["En retard", "Pour aujourd’hui", "Échéance proche", "Planifiées", "En attente"],
      pt: ["Vencidas", "Vencem hoje", "Próximas do vencimento", "Programadas", "Pendentes"],
    };
    const _dayMs = 86_400_000;

    function _parseDue(value) {
      if (!value) return null;
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const timestamp = Date.parse(value);
      if (!Number.isFinite(timestamp)) return null;
      // Date-only due dates are calendar days. Keep their original day in all zones.
      if (dateOnly && new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
      return { timestamp, dateOnly };
    }

    function _calendarDay(formatter, timestamp) {
      const parts = formatter.formatToParts(timestamp);
      const year = parts.find(({ type }) => type === "year").value.padStart(4, "0");
      const month = parts.find(({ type }) => type === "month").value;
      const day = parts.find(({ type }) => type === "day").value;
      return Date.parse(`${year}-${month}-${day}`) / _dayMs;
    }

    function _dueSection(due, { formatter, today, now }) {
      if (!due) return "pending";
      if (!due.dateOnly && due.timestamp <= now) return "overdue";
      const dueDay = due.dateOnly ? due.timestamp / _dayMs : _calendarDay(formatter, due.timestamp);
      const daysRemaining = dueDay - today;
      if (daysRemaining < 0) return "overdue";
      if (!daysRemaining) return "today";
      return daysRemaining <= 7 ? "soon" : "scheduled";
    }

    function _isBetterTodoShoppingList(hass, entityId) {
      if (hass?.states?.[entityId]?.attributes?.better_todo_shopping_list) return true;
      const entry = hass?.entities?.[entityId];
      return entry?.platform === "better_todo" &&
        (entry.translation_key === "shopping_list" || entry.unique_id?.includes("default_shopping_list"));
    }

    function _canAssignTasks(hass, entityId) {
      if (_isBetterTodoShoppingList(hass, entityId)) return false;
      const attributes = hass?.states?.[entityId]?.attributes;
      // Older or refreshed state snapshots need not include an empty map.
      return attributes?.task_assignees !== undefined ||
        hass?.entities?.[entityId]?.platform === "better_todo";
    }

    function _listIcon(state) {
      const identity = `${state?.attributes?.icon || ""} ${state?.entity_id || ""} ${state ? _computeStateName(state) : ""}`;
      if (/cart|shopping|compras|épicerie|einkauf/i.test(identity)) return "cartShopping";
      if (/house|home|casa|maison|zuhause/i.test(identity)) return "house";
      if (/project|proyect|projet|projekt/i.test(identity)) return "layerGroup";
      return "listCheck";
    }

    function _boardHeading(hass, entityId, hideCompleted, toggle, add, unavailable, configure) {
      const [, , addLabel, hide, show] = _boardText(hass);
      const state = hass?.states?.[entityId];
      return html`
        <header class="board-heading">
          <h1>${state ? _computeStateName(state) : ""}</h1>
          <div class="board-actions">
            ${configure ? html`
              <button type="button" class="board-button" @click=${configure}>
                ${_icon("gear")} ${_listSettingsText(hass)[0]}
              </button>
            ` : ""}
            <button type="button" class="board-button" @click=${toggle}>
              ${_icon(hideCompleted ? "eye" : "eyeSlash")} ${hideCompleted ? show : hide}
            </button>
            ${add ? html`
              <button type="button" class="board-button primary" @click=${add} ?disabled=${unavailable}>
                ${_icon("plus")} ${addLabel}
              </button>
            ` : ""}
          </div>
        </header>
      `;
    }

    function _boardProgress(hass, entityId, items, deadlineContext) {
      const [, , , , , title, progressLabel] = _boardText(hass);
      const counted = deadlineContext
        ? items.filter((item) => _dueSection(_parseDue(item.due), deadlineContext) !== "scheduled")
        : items;
      const done = counted.filter(_isComplete).length;
      const total = counted.length;
      const percent = total ? Math.round((100 * done) / total) : 0;
      return html`
        <section class="board-progress" aria-label=${title}>
          <span class="progress-icon">
            ${_icon(_listIcon(hass?.states?.[entityId]))}
            <span class="progress-check">${_icon("circleCheck")}</span>
          </span>
          <div class="progress-content">
            <h2>${title}</h2>
            <p>${progressLabel(done, total)}</p>
            <div class="progress-meter">
              <progress aria-label=${progressLabel(done, total)} .value=${done} .max=${total || 1}></progress>
              <strong>${percent}%</strong>
            </div>
          </div>
        </section>
      `;
    }

    function _taskCheck(item, disabled, toggle) {
      return html`
        <button type="button" class="task-check" role="checkbox"
          aria-checked=${String(_isComplete(item))} aria-label=${item.summary}
          ?disabled=${disabled} @click=${toggle}>
          ${_isComplete(item) ? _icon("circleCheck") : html`<span class="unchecked"></span>`}
        </button>
      `;
    }

    function _stopItemSubscription(view) {
      view._itemSubscription?.unsubscribe?.();
      view._itemSubscription = undefined;
    }

    function _startItemSubscription(view) {
      _stopItemSubscription(view);
      const connection = view.hass?.connection;
      if (!connection?.subscribeMessage || !view.entityId || !view.isConnected) return;
      const subscription = {};
      const entityId = view.entityId;
      view._itemSubscription = subscription;
      connection.subscribeMessage(({ items }) => {
        if (view._itemSubscription !== subscription || view.entityId !== entityId) return;
        view._fetchSequence++;
        view._items = items || [];
        view._loading = false;
        view._itemsError = false;
      }, { type: "todo/item/subscribe", entity_id: entityId }).then((unsubscribe) => {
        if (view._itemSubscription === subscription) subscription.unsubscribe = unsubscribe;
        else return unsubscribe();
      }).catch(() => {
        // The existing entity-state refresh remains available on older HA versions.
      });
    }

    const _boardStyles = css`
      :host { display: block; min-width: 0; }
      .board-heading, .board-actions, .progress-meter { display: flex; align-items: center; gap: 12px; }
      .board-heading { flex-wrap: wrap; justify-content: space-between; margin-block-end: 18px; }
      .board-heading h1 { font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1.05; margin: 0; overflow-wrap: anywhere; }
      .board-actions { flex-wrap: wrap; }
      .board-button {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 9px 13px; min-height: 42px; border: 1px solid var(--bt-accent);
        border-radius: 10px; background: transparent; color: var(--bt-ink);
        font: inherit; font-weight: 650; cursor: pointer;
      }
      .board-button.primary { background: var(--bt-primary); color: white; border-color: transparent; }
      .board-button:disabled, .task-check:disabled { opacity: .5; cursor: default; }
      .board-progress {
        display: flex; align-items: center; gap: clamp(12px, 3vw, 26px);
        background: var(--bt-surface); border: 1px solid var(--bt-border); border-radius: 18px;
        padding: clamp(12px, 2vw, 20px); margin-block-end: 20px;
      }
      .progress-icon {
        position: relative; display: grid; place-items: center; flex: 0 0 auto;
        width: clamp(54px, 8vw, 100px); aspect-ratio: 1; border-radius: 18%;
        font-size: clamp(1.6rem, 4vw, 3.6rem); color: var(--bt-accent); background: var(--bt-lilac);
      }
      .progress-check {
        position: absolute; inset-inline-end: 7%; inset-block-end: 7%; display: grid;
        place-items: center; border-radius: 50%; color: #303900; background: #c6ed33;
        font-size: .48em;
      }
      .progress-content { flex: 1; min-width: 0; }
      .progress-content h2 { font-size: clamp(1rem, 2vw, 1.45rem); margin: 0; }
      .progress-content p { margin: 5px 0; color: var(--bt-muted); }
      progress {
        appearance: none; flex: 1; min-width: 0; height: 12px; overflow: hidden; border: 0;
        border-radius: 999px; background: var(--bt-lilac); accent-color: #a6c522;
      }
      progress::-webkit-progress-bar { background: var(--bt-lilac); }
      progress::-webkit-progress-value { background: #b4da26; border-radius: 999px; }
      progress::-moz-progress-bar { background: #b4da26; border-radius: 999px; }
      .task-check {
        border: 0; background: transparent; color: var(--bt-ink); flex: 0 0 auto;
        display: grid; place-items: center; width: 38px; height: 42px; padding: 0;
        cursor: pointer; font-size: 22px;
      }
      .task-check[aria-checked="true"] { color: var(--bt-done); }
      .unchecked { width: 17px; height: 17px; border: 2px solid currentColor; border-radius: 50%; }
      .board-button:focus-visible, .task-check:focus-visible { outline: 2px solid var(--bt-accent); outline-offset: 2px; }
    `;

    // Mirrors the Python _decode_description_structured logic: extract only the
    // free-text notes portion from the description, skipping leading tag lines
    // like "[quantity:2] [unit:kg] [category:Meat]".
    const _tagLineRe = /^\[([a-z_]+):[^\]]+\](\s*\[([a-z_]+):[^\]]+\])*\s*$/;
    function _parseDescriptionNotes(description) {
      if (!description) return "";
      const lines = description.split("\n");
      const notes = [];
      let inMeta = true;
      for (const line of lines) {
        if (inMeta) {
          if (_tagLineRe.test(line.trim())) continue;
          if (line.trim() === "") { inMeta = false; continue; }
          inMeta = false;
          notes.push(line);
        } else {
          notes.push(line);
        }
      }
      return notes.join("\n").trim();
    }

    const _FREQ_BY_UNIT = {
      days: "DAILY", weeks: "WEEKLY", months: "MONTHLY", years: "YEARLY",
    };

    function _recurrenceEnd(endMode, endDate, endCount) {
      if (endMode === "date" && endDate) {
        return `UNTIL=${endDate.replaceAll("-", "")}`;
      }
      if (endMode === "count") {
        const count = Math.max(1, Number.parseInt(endCount, 10) || 1);
        return `COUNT=${count}`;
      }
      return "";
    }

    // Build an RRULE string from the dialog's friendly recurrence controls.
    function _buildRrule(preset, weekdays, recurrence) {
      let rule;
      switch (preset) {
        case "daily":   rule = "FREQ=DAILY"; break;
        case "weekly": {
          const days = (weekdays || []).filter(Boolean).join(",");
          rule = days ? `FREQ=WEEKLY;BYDAY=${days}` : "FREQ=WEEKLY";
          break;
        }
        case "monthly": rule = "FREQ=MONTHLY"; break;
        case "yearly":  rule = "FREQ=YEARLY"; break;
        case "custom": {
          if (recurrence.customMode === "pattern") {
            const days = recurrence.patternDays
              .filter(Boolean)
              .map((day) => `${recurrence.patternOrdinal}${day}`)
              .join(",");
            rule = `FREQ=MONTHLY;BYDAY=${days}`;
          } else {
            const interval = Math.max(
              1, Number.parseInt(recurrence.intervalNumber, 10) || 1
            );
            rule = `FREQ=${_FREQ_BY_UNIT[recurrence.intervalUnit]};INTERVAL=${interval}`;
          }
          break;
        }
        default:        return "";
      }
      const end = _recurrenceEnd(
        recurrence.endMode, recurrence.endDate, recurrence.endCount
      );
      return end ? `${rule};${end}` : rule;
    }

    // Parse supported RRULE fields back into the dialog's friendly controls.
    function _parseRrule(rrule) {
      const defaults = {
        preset: "none", weekdays: [], customMode: "time", intervalNumber: "1",
        intervalUnit: "days", patternOrdinal: "1", patternDays: [],
        endMode: "never", endDate: "", endCount: "10",
      };
      if (!rrule) return defaults;
      const up = rrule.trim().toUpperCase();
      const parts = up.split(";");
      const value = (name) =>
        (parts.find((part) => part.startsWith(`${name}=`)) || "").slice(name.length + 1);
      const freq = value("FREQ");
      const bydayRaw = value("BYDAY");
      const weekdays = bydayRaw ? bydayRaw.split(",").filter(Boolean) : [];
      const interval = value("INTERVAL");
      const bysetpos = value("BYSETPOS");
      const until = value("UNTIL");
      const count = value("COUNT");
      const end = count
        ? { endMode: "count", endCount: count }
        : until
          ? { endMode: "date", endDate: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` }
          : {};

      const ordinalDays = weekdays.map((day) => day.match(/^(-?\d)([A-Z]{2})$/));
      const sharedOrdinal = ordinalDays.length && ordinalDays.every(
        (match) => match && match[1] === ordinalDays[0][1]
      ) ? ordinalDays[0][1] : "";
      if ((bysetpos || sharedOrdinal) && weekdays.length) {
        return {
          ...defaults, ...end, preset: "custom", customMode: "pattern",
          patternOrdinal: bysetpos || sharedOrdinal,
          patternDays: sharedOrdinal ? ordinalDays.map((match) => match[2]) : weekdays,
        };
      }
      if (interval) {
        const unit = Object.keys(_FREQ_BY_UNIT).find(
          (key) => _FREQ_BY_UNIT[key] === freq
        ) || "days";
        return {
          ...defaults, ...end, preset: "custom", customMode: "time",
          intervalNumber: interval, intervalUnit: unit,
        };
      }
      if (freq === "DAILY") return { ...defaults, ...end, preset: "daily" };
      if (freq === "WEEKLY") return { ...defaults, ...end, preset: "weekly", weekdays };
      if (freq === "MONTHLY") return { ...defaults, ...end, preset: "monthly" };
      if (freq === "YEARLY") return { ...defaults, ...end, preset: "yearly" };
      return defaults;
    }

    let coreTodoLoad;

    function _loadCoreTodoElements() {
      coreTodoLoad ??= _importCoreTodoElements().catch((err) => {
        coreTodoLoad = undefined;
        throw err;
      });
      return coreTodoLoad;
    }

    async function _importCoreTodoElements() {
      if (customElements.get("ha-panel-todo") && customElements.get("hui-card")) return;

      // A direct cold load of /better-todo has not imported HA's To-do panel
      // yet. Ask the same panel resolver used by the app shell to import it
      // without navigating away. That module registers hui-card, the core
      // todo-list card, and every UI element used by the native panel.
      await customElements.whenDefined("partial-panel-resolver");
      const resolver = document.createElement("partial-panel-resolver");
      const getRoutes = resolver._getRoutes || resolver.getRoutes;
      if (getRoutes) {
        const panel = { component_name: "todo", url_path: "todo" };
        let routes = getRoutes.call(resolver, { todo: panel });
        // Older HA releases accepted an array instead of the panel map.
        if (!routes?.routes?.todo) {
          routes = getRoutes.call(resolver, [panel]);
        }
        await routes?.routes?.todo?.load?.();
      }
      if (!customElements.get("hui-card")) {
        throw new Error("Home Assistant's core To-do card is unavailable");
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoTaskDialog
    // Custom create/edit dialog with Better ToDo-specific fields (recurrence).
    // ═══════════════════════════════════════════════════════════════════════════
    const _assignmentLabels = {
      en: ["Assigned to", "Unassigned", "Unavailable user", "Could not load users"],
      es: ["Asignar a", "Sin asignar", "Usuario no disponible", "No se pudieron cargar los usuarios"],
      de: ["Zugewiesen an", "Nicht zugewiesen", "Benutzer nicht verfügbar", "Benutzer konnten nicht geladen werden"],
      fr: ["Attribuer à", "Non attribué", "Utilisateur indisponible", "Impossible de charger les utilisateurs"],
      pt: ["Atribuir a", "Sem atribuição", "Utilizador indisponível", "Não foi possível carregar os utilizadores"],
    };
    const _assignmentText = (hass) =>
      _assignmentLabels[hass?.locale?.language?.split("-")[0]] || _assignmentLabels.en;

    class BetterTodoTaskDialog extends LitElement {
      static get properties() {
        return {
          hass:      { attribute: false },
          entityId:  { type: String },
          users:     { attribute: false },
          supportsAssignment: { type: Boolean },
          usersError: { type: Boolean },
          _assignee: { state: true },
          _open:     { state: true },
          _item:     { state: true },
          _summary:  { state: true },
          _dueDate:  { state: true },
          _dueTime:  { state: true },
          _notes:    { state: true },
          _preset:   { state: true },
          _weekdays: { state: true },
          _customMode: { state: true },
          _intervalNumber: { state: true },
          _intervalUnit: { state: true },
          _patternOrdinal: { state: true },
          _patternDays: { state: true },
          _endMode: { state: true },
          _endDate: { state: true },
          _endCount: { state: true },
          _saving:   { state: true },
          _error:    { state: true },
        };
      }

      constructor() {
        super();
        this._open     = false;
        this._item     = null;
        this._summary  = "";
        this._dueDate  = "";
        this._dueTime  = "";
        this._notes    = "";
        this._preset   = "none";
        this._weekdays = [];
        this._resetRecurrenceControls();
        this._saving   = false;
        this._error    = "";
      }

      _resetRecurrenceControls() {
        this._customMode = "time";
        this._intervalNumber = "1";
        this._intervalUnit = "days";
        this._patternOrdinal = "1";
        this._patternDays = [];
        this._endMode = "never";
        this._endDate = "";
        this._endCount = "10";
      }

      // Public API called by BetterTodoTaskList.
      openCreate() {
        this._item     = null;
        this._assignee = "";
        this._summary  = "";
        this._dueDate  = "";
        this._dueTime  = "";
        this._notes    = "";
        this._preset   = "none";
        this._weekdays = [];
        this._resetRecurrenceControls();
        this._saving   = false;
        this._error    = "";
        this._open     = true;
      }

      openEdit(item, rrule, assignee) {
        this._item = item;
        this._assignee = assignee || "";
        this._initialAssignee = this._assignee;
        this._summary = item.summary || "";
        const dueStr = item.due ? String(item.due) : "";
        if (dueStr.includes("T")) {
          const [d, t] = dueStr.split("T");
          this._dueDate = d;
          this._dueTime = (t || "").substring(0, 5);
        } else {
          this._dueDate = dueStr.substring(0, 10);
          this._dueTime = "";
        }
        this._notes = _parseDescriptionNotes(item.description);
        const p = _parseRrule(rrule);
        this._preset   = p.preset;
        this._weekdays = p.weekdays;
        this._customMode = p.customMode;
        this._intervalNumber = p.intervalNumber;
        this._intervalUnit = p.intervalUnit;
        this._patternOrdinal = p.patternOrdinal;
        this._patternDays = p.patternDays;
        this._endMode = p.endMode;
        this._endDate = p.endDate;
        this._endCount = p.endCount;
        this._initialEdit = {
          summary: this._summary.trim(),
          notes: this._notes.trim(),
          dueDate: this._dueDate,
          dueTime: this._dueTime,
          recurrence: this._getRecurrenceRule(),
        };
        this._saving   = false;
        this._error    = "";
        this._open     = true;
      }

      _close() {
        if (this._saving) return;
        this._open = false;
      }

      updated(changedProps) {
        super.updated(changedProps);
        if (!changedProps.has("_open")) return;
        if (this._open) {
          this._previousFocus = this.getRootNode().activeElement;
          this.shadowRoot.querySelector("#better-todo-task-name")?.focus();
        } else {
          this._previousFocus?.focus();
          this._previousFocus = undefined;
        }
      }

      _dialogKeydown(event) {
        if (event.key === "Escape") {
          event.stopPropagation();
          this._close();
        }
        if (event.key !== "Tab") return;
        const controls = [...this.shadowRoot.querySelectorAll(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
        )];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && event.target === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && event.target === last) {
          event.preventDefault();
          first?.focus();
        }
      }

      _clickOverlay(e) {
        if (e.target === e.currentTarget) this._close();
      }

      _toggleDay(day) {
        this._weekdays = this._weekdays.includes(day)
          ? this._weekdays.filter((d) => d !== day)
          : [...this._weekdays, day];
      }

      async _listItemUids() {
        const result = await this.hass.callWS({
          type: "todo/item/list", entity_id: this.entityId,
        });
        return result?.items || [];
      }

      async _findCreatedItemUid(summary, previousUids) {
        // The todo.add_item service does not return the generated UID. Poll the
        // local entity briefly and identify the item by set difference, which
        // remains correct when multiple tasks share the same summary.
        for (let attempt = 0; attempt < 8; attempt++) {
          if (attempt > 0) {
            await new Promise((resolve) => {
              setTimeout(resolve, 100 * attempt);
            });
          }
          const items = await this._listItemUids();
          const created = items.find(
            (item) => item.summary === summary && !previousUids.has(item.uid)
          );
          if (created) return created.uid;
        }
        return null;
      }

      _getRecurrenceRule() {
        return _buildRrule(this._preset, this._weekdays, {
          customMode: this._customMode,
          intervalNumber: this._intervalNumber,
          intervalUnit: this._intervalUnit,
          patternOrdinal: this._patternOrdinal,
          patternDays: this._patternDays,
          endMode: this._endMode,
          endDate: this._endDate,
          endCount: this._endCount,
        });
      }

      async _save() {
        const summary = this._summary.trim();
        if (!summary || this._saving) return;
        this._saving = true;
        this._error = "";

        const rruleStr = this._getRecurrenceRule();
        const notes = this._notes.trim();

        try {
          if (this._item) {
            const target = { entity_id: this.entityId, item: this._item.uid };
            const changes = {};
            const initial = this._initialEdit;
            if (summary !== initial.summary) changes.rename = summary;
            if (notes !== initial.notes) {
              const tags = [];
              for (const line of (this._item.description || "").split("\n")) {
                if (!_tagLineRe.test(line.trim())) break;
                tags.push(line);
              }
              changes.description = [tags.join("\n"), notes].filter(Boolean).join("\n\n");
            }
            if (this._dueDate !== initial.dueDate || this._dueTime !== initial.dueTime) {
              if (this._dueDate && this._dueTime) {
                changes.due_datetime = `${this._dueDate}T${this._dueTime}:00`;
              } else {
                changes.due_date = this._dueDate || null;
              }
            }
            if (Object.keys(changes).length) {
              await this.hass.callService("todo", "update_item", { ...target, ...changes });
            }
            if (rruleStr !== initial.recurrence) {
              await this.hass.callService("better_todo", "set_task_recurrence", {
                ...target, rrule: rruleStr || null,
              });
            }
            if (this.supportsAssignment && this._assignee !== this._initialAssignee) {
              await this.hass.callService("better_todo", "set_task_assignee", {
                ...target, user_id: this._assignee || null,
              });
            }
          } else if (this.supportsAssignment && this._assignee) {
            const data = {
              entity_id: this.entityId,
              summary,
              description: notes,
              user_id: this._assignee,
            };
            if (this._dueDate && this._dueTime) data.due_datetime = `${this._dueDate}T${this._dueTime}:00`;
            else if (this._dueDate) data.due_date = this._dueDate;
            if (rruleStr) data.rrule = rruleStr;
            await this.hass.callService("better_todo", "add_assigned_task", data);
          } else {
            // ── Create new item ──────────────────────────────────────────────
            // Snapshot existing UIDs before creation so recurrence is attached
            // to the exact new item, even when task names are duplicated.
            const previousUids = rruleStr
              ? new Set((await this._listItemUids()).map((item) => item.uid))
              : null;
            const cr = {
              entity_id:   this.entityId,
              item:        summary,
              description: notes,
            };
            if (this._dueDate) {
              if (this._dueTime) cr.due_datetime = `${this._dueDate}T${this._dueTime}:00`;
              else               cr.due_date     = this._dueDate;
            }
            await this.hass.callService("todo", "add_item", cr);

            // To set recurrence on the brand-new item we first need its UID.
            if (rruleStr) {
              const newUid = await this._findCreatedItemUid(summary, previousUids);
              if (newUid) {
                await this.hass.callService("better_todo", "set_task_recurrence", {
                  entity_id: this.entityId, item: newUid, rrule: rruleStr,
                });
              } else {
                throw new Error("The new task was created, but its recurrence could not be set.");
              }
            }
          }

          this._saving = false;
          this._open   = false;
          this.dispatchEvent(new CustomEvent("item-saved"));
        } catch (err) {
          this._error  = err?.message || "Error saving task. Please try again.";
          this._saving = false;
        }
      }

      render() {
        if (!this._open) return html``;

        const isCreate = !this._item;
        const L = (k, fb) => this.hass?.localize(k) || fb;
        const [assignLabel, unassigned, unavailableUser, usersErrorLabel] = _assignmentText(this.hass);
        const users = this.users || [];

        // Short day labels built from the browser's Intl API for locale-aware names.
        // Jan 4–10 2021 is Mon–Sun; we reorder to MO–SU (Mon first).
        const _locale = this.hass?.locale?.language || navigator.language || "en";
        const _fmt = (d) =>
          new Date(2021, 0, d).toLocaleDateString(_locale, { weekday: "short" });
        const DAYS = [
          { k: "MO", label: _fmt(4) },
          { k: "TU", label: _fmt(5) },
          { k: "WE", label: _fmt(6) },
          { k: "TH", label: _fmt(7) },
          { k: "FR", label: _fmt(8) },
          { k: "SA", label: _fmt(9) },
          { k: "SU", label: _fmt(10) },
        ];

        return html`
          <div class="overlay" @click=${(e) => this._clickOverlay(e)}>
            <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="better-todo-dialog-title"
              @keydown=${this._dialogKeydown}>
              <div class="dlg-header">
                <span id="better-todo-dialog-title" class="dlg-title">
                  ${isCreate
                    ? L("ui.panel.todo.action.add_item", "Add task")
                    : L("ui.common.edit", "Edit")}
                </span>
                <button type="button" class="close-dialog"
                  aria-label=${L("ui.common.close", "Close")}
                  @click=${() => this._close()}
                  ?disabled=${this._saving}
                >${_icon("xmark")}</button>
              </div>

              <div class="dlg-body">
                <!-- Task name -->
                <div class="field">
                  <label class="lbl" for="better-todo-task-name">
                    ${L("ui.components.todo-list-item.summary", "Task name")}
                    <span class="req">*</span>
                  </label>
                  <input
                    id="better-todo-task-name"
                    class="inp"
                    type="text"
                    .value=${this._summary}
                    @input=${(e) => { this._summary = e.target.value; }}
                    ?disabled=${this._saving}
                    autocomplete="off"
                  />
                </div>

                ${this.supportsAssignment ? html`
                  <div class="field">
                    <label class="lbl" for="task-assignee">${assignLabel}</label>
                    <select id="task-assignee" class="inp sel"
                      @change=${(e) => { this._assignee = e.target.value; }}
                      ?disabled=${this._saving}>
                      <option value="" ?selected=${!this._assignee}>${unassigned}</option>
                      ${this._assignee && !users.some((user) => user.id === this._assignee)
                        ? html`<option value=${this._assignee} selected>${unavailableUser}</option>`
                        : ""}
                      ${users.map((user) => html`
                        <option value=${user.id} ?selected=${this._assignee === user.id}>${user.name}</option>
                      `)}
                    </select>
                    ${this.usersError ? html`<span role="status">${usersErrorLabel}</span>` : ""}
                  </div>
                ` : ""}

                <!-- Due date -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.todo-list-item.due_date", "Due date")}
                  </label>
                  <input
                    class="inp"
                    type="date"
                    .value=${this._dueDate}
                    @input=${(e) => { this._dueDate = e.target.value; }}
                    ?disabled=${this._saving}
                  />
                </div>

                <!-- Due time (only visible when a date has been entered) -->
                ${this._dueDate ? html`
                  <div class="field">
                    <label class="lbl">${L("ui.common.time", "Time")}</label>
                    <input
                      class="inp"
                      type="time"
                      .value=${this._dueTime}
                      @input=${(e) => { this._dueTime = e.target.value; }}
                      ?disabled=${this._saving}
                    />
                  </div>
                ` : ""}

                <!-- Notes -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.calendar.event.description", "Notes")}
                  </label>
                  <textarea
                    class="inp textarea"
                    rows="3"
                    .value=${this._notes}
                    @input=${(e) => { this._notes = e.target.value; }}
                    ?disabled=${this._saving}
                  ></textarea>
                </div>

                <!-- Recurrence preset -->
                <div class="field">
                  <label class="lbl">
                    ${L("ui.components.calendar.event.recurrence.repeat", "Repeat")}
                  </label>
                  <select
                    class="inp sel"
                    @change=${(e) => { this._preset = e.target.value; }}
                    ?disabled=${this._saving}
                  >
                    <option value="none"    ?selected=${this._preset === "none"}>
                      ${L("ui.components.calendar.event.recurrence.no_repeat", "None")}
                    </option>
                    <option value="daily"   ?selected=${this._preset === "daily"}>
                      ${L("ui.components.calendar.event.recurrence.daily", "Daily")}
                    </option>
                    <option value="weekly"  ?selected=${this._preset === "weekly"}>
                      ${L("ui.components.calendar.event.recurrence.weekly", "Weekly")}
                    </option>
                    <option value="monthly" ?selected=${this._preset === "monthly"}>
                      ${L("ui.components.calendar.event.recurrence.monthly", "Monthly")}
                    </option>
                    <option value="yearly"  ?selected=${this._preset === "yearly"}>
                      ${L("ui.components.calendar.event.recurrence.yearly", "Yearly")}
                    </option>
                    <option value="custom"  ?selected=${this._preset === "custom"}>
                      ${L("ui.components.calendar.event.recurrence.custom", "Custom")}
                    </option>
                  </select>
                </div>

                <!-- Weekday picker (only for Weekly) -->
                ${this._preset === "weekly" ? html`
                  <div class="field">
                    <label class="lbl">
                      ${L("ui.components.calendar.event.repeat.on", "On")}
                    </label>
                    <div class="days">
                      ${DAYS.map((d) => html`
                        <button
                          type="button"
                          class="day ${this._weekdays.includes(d.k) ? "day--on" : ""}"
                          @click=${() => this._toggleDay(d.k)}
                          ?disabled=${this._saving}
                        >${d.label}</button>
                      `)}
                    </div>
                  </div>
                ` : ""}

                <!-- Friendly custom recurrence builder -->
                ${this._preset === "custom" ? html`
                  <div class="field">
                    <label class="lbl">${L("ui.common.type", "Repeat by")}</label>
                    <select
                      class="inp sel"
                      @change=${(e) => { this._customMode = e.target.value; }}
                      ?disabled=${this._saving}
                    >
                      <option value="time" ?selected=${this._customMode === "time"}>
                        ${L("ui.components.calendar.event.recurrence.interval", "Time interval")}
                      </option>
                      <option value="pattern" ?selected=${this._customMode === "pattern"}>
                        ${L("ui.components.calendar.event.recurrence.pattern", "Pattern")}
                      </option>
                    </select>
                  </div>

                  ${this._customMode === "time" ? html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.every", "Every")}</label>
                      <div class="inline-fields">
                        <input
                          class="inp compact-number"
                          type="number"
                          min="1"
                          .value=${this._intervalNumber}
                          @input=${(e) => { this._intervalNumber = e.target.value; }}
                          ?disabled=${this._saving}
                        />
                        <select
                          class="inp sel"
                          @change=${(e) => { this._intervalUnit = e.target.value; }}
                          ?disabled=${this._saving}
                        >
                          <option value="days" ?selected=${this._intervalUnit === "days"}>${L("ui.components.calendar.event.recurrence.days", "Days")}</option>
                          <option value="weeks" ?selected=${this._intervalUnit === "weeks"}>${L("ui.components.calendar.event.recurrence.weeks", "Weeks")}</option>
                          <option value="months" ?selected=${this._intervalUnit === "months"}>${L("ui.components.calendar.event.recurrence.months", "Months")}</option>
                          <option value="years" ?selected=${this._intervalUnit === "years"}>${L("ui.components.calendar.event.recurrence.years", "Years")}</option>
                        </select>
                      </div>
                    </div>
                  ` : html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.occurrence", "Occurrence")}</label>
                      <select
                        class="inp sel"
                        @change=${(e) => { this._patternOrdinal = e.target.value; }}
                        ?disabled=${this._saving}
                      >
                        <option value="1" ?selected=${this._patternOrdinal === "1"}>${L("ui.common.first", "First")}</option>
                        <option value="2" ?selected=${this._patternOrdinal === "2"}>${L("ui.common.second", "Second")}</option>
                        <option value="3" ?selected=${this._patternOrdinal === "3"}>${L("ui.common.third", "Third")}</option>
                        <option value="4" ?selected=${this._patternOrdinal === "4"}>${L("ui.common.fourth", "Fourth")}</option>
                        <option value="-1" ?selected=${this._patternOrdinal === "-1"}>${L("ui.common.last", "Last")}</option>
                      </select>
                    </div>
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.repeat.on", "Weekdays")}</label>
                      <select
                        class="inp multi-select"
                        multiple
                        size="7"
                        @change=${(e) => {
                          this._patternDays = [...e.target.selectedOptions].map(
                            (option) => option.value
                          );
                        }}
                        ?disabled=${this._saving}
                      >
                        ${DAYS.map((d) => html`
                          <option value=${d.k} ?selected=${this._patternDays.includes(d.k)}>
                            ${d.label}
                          </option>
                        `)}
                      </select>
                    </div>
                  `}
                ` : ""}

                ${this._preset !== "none" ? html`
                  <div class="field">
                    <label class="lbl">${L("ui.components.calendar.event.recurrence.ends", "Ends")}</label>
                    <select
                      class="inp sel"
                      @change=${(e) => { this._endMode = e.target.value; }}
                      ?disabled=${this._saving}
                    >
                      <option value="never" ?selected=${this._endMode === "never"}>${L("ui.components.calendar.event.recurrence.never", "Never")}</option>
                      <option value="date" ?selected=${this._endMode === "date"}>${L("ui.components.calendar.event.recurrence.on_date", "On a date")}</option>
                      <option value="count" ?selected=${this._endMode === "count"}>${L("ui.components.calendar.event.recurrence.after_count", "After a number of repetitions")}</option>
                    </select>
                  </div>
                  ${this._endMode === "date" ? html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.end_date", "End date")}</label>
                      <input class="inp" type="date" .value=${this._endDate}
                        @input=${(e) => { this._endDate = e.target.value; }}
                        ?disabled=${this._saving} />
                    </div>
                  ` : ""}
                  ${this._endMode === "count" ? html`
                    <div class="field">
                      <label class="lbl">${L("ui.components.calendar.event.recurrence.repetitions", "Repetitions")}</label>
                      <input class="inp" type="number" min="1" .value=${this._endCount}
                        @input=${(e) => { this._endCount = e.target.value; }}
                        ?disabled=${this._saving} />
                    </div>
                  ` : ""}
                ` : ""}

                ${this._error ? html`<p class="err">${this._error}</p>` : ""}
              </div>

              <div class="dlg-actions">
                <button
                  class="btn btn-ghost"
                  @click=${() => this._close()}
                  ?disabled=${this._saving}
                >
                  ${L("ui.common.cancel", "Cancel")}
                </button>
                <button
                  class="btn btn-primary"
                  @click=${() => this._save()}
                  ?disabled=${!this._summary.trim() || this._saving
                    || (this._preset === "custom" && this._customMode === "pattern"
                      && !this._patternDays.length)
                    || (this._preset !== "none" && this._endMode === "date"
                      && !this._endDate)}
                >
                  ${this._saving
                    ? "…"
                    : isCreate
                      ? L("ui.common.add", "Add")
                      : L("ui.common.save", "Save")}
                </button>
              </div>
            </div>
          </div>
        `;
      }

      static get styles() {
        return [css`
          :host { display: contents; }

          .overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.48);
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
          }

          .dialog {
            width: 100%;
            max-width: 480px;
            max-height: calc(100vh - 32px);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-radius: var(--ha-card-border-radius, 12px);
            background: var(--bt-surface, var(--card-background-color, white));
            box-shadow: 0 20px 60px #0004;
          }

          .close-dialog {
            display: grid; place-items: center; width: 42px; height: 42px;
            border: 0; border-radius: 9px; background: transparent;
            color: var(--primary-text-color); font-size: 20px; cursor: pointer;
          }

          .dlg-header {
            display: flex;
            align-items: center;
            padding: 16px 8px 0 20px;
            flex-shrink: 0;
          }

          .dlg-title {
            flex: 1;
            font-size: 1.2rem;
            font-weight: 500;
            color: var(--primary-text-color);
          }

          .dlg-body {
            padding: 12px 20px 8px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .field {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .lbl {
            font-size: 0.73rem;
            font-weight: 500;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--secondary-text-color);
          }

          .req {
            color: var(--error-color, #b00020);
            margin-left: 2px;
          }

          .inp {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            border-radius: 8px;
            background: var(--input-fill-color, var(--secondary-background-color, #f5f5f5));
            color: var(--primary-text-color);
            font-size: 0.95rem;
            font-family: inherit;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s;
            -webkit-appearance: none;
          }

          .inp:focus { border-color: var(--primary-color); }

          .inp:disabled { opacity: 0.55; }

          .textarea {
            resize: vertical;
            min-height: 64px;
          }

          .sel { cursor: pointer; }

          .inline-fields {
            display: grid;
            grid-template-columns: minmax(88px, 0.35fr) 1fr;
            gap: 8px;
          }

          .compact-number { min-width: 0; }

          .multi-select {
            min-height: 150px;
            padding: 4px;
          }

          .multi-select option {
            padding: 7px 9px;
            border-radius: 5px;
          }

          .days {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }

          .day {
            padding: 4px 10px;
            border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
            border-radius: 16px;
            background: transparent;
            color: var(--primary-text-color);
            cursor: pointer;
            font-size: 0.82rem;
            font-family: inherit;
            transition: background 0.12s, border-color 0.12s;
          }

          .day--on {
            background: var(--primary-color);
            color: var(--text-primary-color, #fff);
            border-color: var(--primary-color);
          }

          .day:disabled { opacity: 0.5; cursor: default; }

          .err {
            color: var(--error-color, #b00020);
            font-size: 0.85rem;
            margin: 0;
          }

          .dlg-actions {
            display: flex;
            justify-content: flex-end;
            padding: 8px 20px 16px;
            gap: 8px;
            flex-shrink: 0;
          }

          .btn {
            padding: 8px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.88rem;
            font-family: inherit;
            font-weight: 500;
            transition: opacity 0.12s, background 0.12s;
          }

          .btn:disabled { opacity: 0.45; cursor: default; }

          .btn-ghost {
            background: transparent;
            color: var(--primary-text-color);
          }

          .btn-ghost:hover:not(:disabled) { background: var(--secondary-background-color); }

          .btn-primary {
            background: var(--primary-color);
            color: var(--text-primary-color, #fff);
          }

          .btn-primary:hover:not(:disabled) { opacity: 0.85; }
        `];
      }
    }

    customElements.define("better-todo-task-dialog-v091", BetterTodoTaskDialog);

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoTaskList
    // Mirrors HA's ha-todo-list behaviour; opens BetterTodoTaskDialog for
    // create/edit instead of HA's built-in dialog.
    // ═══════════════════════════════════════════════════════════════════════════
    class BetterTodoTaskList extends LitElement {
      static get properties() {
        return {
          hass:     { attribute: false },
          entityId: { type: String },
          hideCompleted: { type: Boolean },
          canConfigure: { type: Boolean },
          _items:   { state: true },
          _loading: { state: true },
          _itemsError: { state: true },
          _card:    { state: true },
          _users:   { state: true },
          _usersError: { state: true },
          _actionError: { state: true },
        };
      }

      constructor() {
        super();
        this._items = [];
        this._loading = true;
        this._itemsError = false;
        this._card = null;
        this._stateKey = null;
        this._fetchSequence = 0;
        this._cardSequence = 0;
        this._users = [];
        this._usersError = false;
        this._actionError = "";
        this._usersSequence = 0;
        this._pendingItems = new Set();
        this._refreshDeadlines = () => {
          this.requestUpdate();
          this._scheduleDeadlineRefresh();
        };
      }

      connectedCallback() {
        super.connectedCallback();
        document.addEventListener("visibilitychange", this._refreshDeadlines);
        this._refreshDeadlines();
        if (this.hasUpdated) {
          _startItemSubscription(this);
          this._fetchItems();
        }
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener("visibilitychange", this._refreshDeadlines);
        clearTimeout(this._deadlineTimer);
        _stopItemSubscription(this);
        this._fetchSequence++;
      }

      async _fetchItems() {
        if (!this.hass || !this.entityId) return;
        const entityId = this.entityId;
        const fetchSequence = ++this._fetchSequence;
        try {
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: entityId,
          });
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._items = res?.items || [];
            this._itemsError = false;
          }
        } catch {
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._itemsError = true;
          }
        } finally {
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._loading = false;
          }
        }
      }

      async _setupCoreCard() {
        if (!this.entityId) return;
        const entityId = this.entityId;
        const cardSequence = ++this._cardSequence;
        this._card = null;
        try {
          await _loadCoreTodoElements();
          this.hass?.loadFragmentTranslation?.("lovelace");
          const card = document.createElement("hui-card");
          card.config = {
            type: "todo-list",
            entity: entityId,
            hide_completed: this.hideCompleted,
          };
          if (cardSequence !== this._cardSequence || entityId !== this.entityId) return;
          card.hass = this.hass;
          this._card = card;
        } catch (err) {
          console.error("Unable to load Home Assistant's To-do list card", err);
        }
      }

      updated(changedProps) {
        super.updated(changedProps);
        if (changedProps.has("_items") || changedProps.has("hass") || changedProps.has("entityId")) {
          this._scheduleDeadlineRefresh();
        }
        // Full reset when the displayed list changes.
        if (changedProps.has("entityId")) {
          this._fetchSequence++;
          this._cardSequence++;
          this._card = null;
          this._items = [];
          this._loading = true;
          this._itemsError = false;
          this._stateKey = null;
          this._users = [];
          this._usersError = false;
          this._actionError = "";
          this._usersSequence++;
          this._pendingItems = new Set();
          if (!this._supportsAssignment) this._setupCoreCard();
        }
        if (changedProps.has("entityId") ||
          (changedProps.has("hass") && changedProps.get("hass")?.connection !== this.hass?.connection)) {
          _startItemSubscription(this);
        }
        // Re-fetch whenever the entity's state fingerprint changes (e.g. an item
        // was added / completed / deleted from outside this panel).
        if (this.hass && (changedProps.has("hass") || changedProps.has("entityId"))) {
          const s = this.hass.states[this.entityId];
          // last_changed does not move for attribute-only/item-detail updates.
          // last_updated ensures those external edits refresh the card too.
          const key = s ? `${s.last_updated}|${s.state}` : null;
          if (changedProps.has("entityId") || key !== this._stateKey) {
            this._stateKey = key;
            this._fetchItems();
          }
        }
        if (changedProps.has("hass") && this._card) {
          this._card.hass = this.hass;
        }
        if (changedProps.has("hideCompleted") && this._card) {
          this._card.config = { ...this._card.config, hide_completed: this.hideCompleted };
        }
        if (
          this._supportsAssignment &&
          (changedProps.has("entityId") || (changedProps.has("hass") &&
            !_canAssignTasks(changedProps.get("hass"), this.entityId)))
        ) {
          this._loadUsers();
        }
      }

      get _assignments() {
        return this.hass?.states?.[this.entityId]?.attributes?.task_assignees;
      }

      get _supportsAssignment() {
        return _canAssignTasks(this.hass, this.entityId);
      }

      async _loadUsers() {
        if (!this._supportsAssignment) return;
        const entityId = this.entityId;
        const request = ++this._usersSequence;
        this._usersError = false;
        try {
          const users = await this.hass.callWS({ type: "better_todo/assignees", entity_id: entityId });
          if (request === this._usersSequence && entityId === this.entityId) {
            this._users = users.sort((a, b) => a.name.localeCompare(b.name, this.hass.locale?.language));
          }
        } catch {
          if (request === this._usersSequence && entityId === this.entityId) this._usersError = true;
        }
      }

      _dialog() {
        return this.shadowRoot?.querySelector("better-todo-task-dialog-v091");
      }

      _openCreate() {
        this._loadUsers();
        this._dialog()?.openCreate();
      }

      openCreate() {
        this._openCreate();
      }

      _openEdit(item) {
        const rrule =
          this.hass?.states[this.entityId]?.attributes?.task_recurrence?.[item.uid] || "";
        this._loadUsers();
        this._dialog()?.openEdit(item, rrule, this._assignments?.[item.uid]);
      }

      async _runTaskAction(item, action) {
        const pending = this._pendingItems;
        if (pending.has(item.uid)) return;
        const entityId = this.entityId;
        pending.add(item.uid);
        this._actionError = "";
        this.requestUpdate();
        try {
          await action({ entity_id: entityId, item: item.uid });
          if (entityId === this.entityId) await this._fetchItems();
        } catch (err) {
          if (entityId === this.entityId) this._actionError = err?.message || "Could not update task";
        } finally {
          pending.delete(item.uid);
          this.requestUpdate();
        }
      }

      _toggleTask(item) {
        const status = item.status === "completed" ? "needs_action" : "completed";
        return this._runTaskAction(item, (data) =>
          this.hass.callService("todo", "update_item", { ...data, status }));
      }

      _deleteTask(item) {
        return this._runTaskAction(item, (data) =>
          this.hass.callService("todo", "remove_item", data));
      }

      _moveTaskUp(item, previousItem) {
        const preceding = this._items[this._items.findIndex(({ uid }) => uid === previousItem.uid) - 1];
        return this._runTaskAction(item, ({ entity_id }) =>
          this.hass.callWS({
            type: "todo/item/move",
            entity_id,
            uid: item.uid,
            ...(preceding ? { previous_uid: preceding.uid } : {}),
          }));
      }

      _scheduleDeadlineRefresh() {
        clearTimeout(this._deadlineTimer);
        if (!this.isConnected || document.hidden || !this._supportsAssignment) return;
        const now = Date.now();
        // Refresh at a clock minute boundary for calendar-day rollovers, or
        // sooner if a task reaches its exact timed deadline.
        let next = now + 60_000 - (now % 60_000);
        let hasDatedTasks = false;
        for (const item of this._items) {
          const due = _parseDue(item.due);
          if (!due) continue;
          hasDatedTasks = true;
          if (!_isComplete(item) && !due.dateOnly && due.timestamp > now) {
            next = Math.min(next, due.timestamp);
          }
        }
        if (hasDatedTasks) this._deadlineTimer = setTimeout(this._refreshDeadlines, next - now);
      }

      _deadlineContext() {
        const timeZone = this.hass?.locale?.time_zone === "local"
          ? undefined : this.hass?.config?.time_zone;
        const formatter = new Intl.DateTimeFormat("en-CA", {
          year: "numeric", month: "2-digit", day: "2-digit", timeZone,
        });
        const now = Date.now();
        return { formatter, now, today: _calendarDay(formatter, now), timeZone };
      }

      _renderAssignmentColumn(title, items, index, deadlineContext) {
        const L = (key, fallback) => this.hass?.localize(key) || fallback;
        const completed = this.hideCompleted ? [] : items.filter(_isComplete);
        const sections = new Map(_dueSections.map((section) => [section, []]));
        for (const item of items) {
          if (_isComplete(item)) continue;
          const due = _parseDue(item.due);
          sections.get(_dueSection(due, deadlineContext)).push({ item, due });
        }
        const moveUp = L("ui.common.move_up", "Move up");
        const remove = L("ui.common.delete", "Delete");
        const locale = this.hass?.locale?.language;
        const labels = _dueLabels[locale?.split("-")[0]] || _dueLabels.en;
        const renderRow = (item, due, previousItem) => {
          const done = _isComplete(item);
          const notes = _parseDescriptionNotes(item.description);
          const rrule = this.hass?.states[this.entityId]?.attributes?.task_recurrence?.[item.uid];
          const recurrence = rrule && _parseRrule(rrule).preset;
          const disabled = this._unavailable || this._pendingItems.has(item.uid);
          return html`
            <li class="task-row ${done ? "completed" : ""}">
              ${_taskCheck(item, disabled, () => this._toggleTask(item))}
              <button type="button" class="task-summary" ?disabled=${disabled} @click=${() => this._openEdit(item)}>
                <span class="task-title">${item.summary}</span>
                ${!done && notes ? html`<small class="task-notes">${notes}</small>` : ""}
                ${!done && (due || rrule) ? html`
                  <span class="task-tags">
                    ${due ? html`<span class="task-tag">${_icon("calendarDays")}
                      ${new Date(due.timestamp).toLocaleString(locale, {
                        day: "numeric", month: "short", year: "numeric",
                        timeZone: due.dateOnly ? "UTC" : deadlineContext.timeZone,
                        ...(!due.dateOnly ? { hour: "numeric", minute: "2-digit" } : {}),
                      })}
                    </span>` : ""}
                    ${rrule ? html`<span class="task-tag repeat">${_icon("repeat")}
                      ${L(`ui.components.calendar.event.recurrence.${recurrence}`,
                        L("ui.components.calendar.event.recurrence.repeat", "Repeat"))}
                    </span>` : ""}
                  </span>
                ` : ""}
              </button>
              <div class="row-actions">
                ${previousItem ? html`
                  <button type="button" aria-label=${moveUp} title=${moveUp} ?disabled=${disabled}
                    @click=${() => this._moveTaskUp(item, previousItem)}>${_icon("arrowUp")}</button>
                ` : ""}
                <button type="button" aria-label=${remove} title=${remove} ?disabled=${disabled}
                  @click=${() => this._deleteTask(item)}>${_icon("trash")}</button>
              </div>
            </li>
          `;
        };
        return html`
          <section class="assignment-column ${index ? (index % 2 ? "lilac" : "peach") : ""}" aria-label=${title}>
            <h2>
              ${index ? html`<span class="avatar" aria-hidden="true">${Array.from(title.trim())[0]?.toLocaleUpperCase(locale)}</span>`
                : _icon("inbox")}
              ${title}
            </h2>
            ${_dueSections.map((key, position) => {
              const entries = sections.get(key);
              return entries.length ? html`
                <div class="due-section" data-due-status=${key}>
                  <h3>${labels[position]}</h3>
                  <ul>${entries.map(({ item, due }, row) => renderRow(item, due, entries[row - 1]?.item))}</ul>
                </div>
              ` : "";
            })}
            ${completed.length ? html`<ul>${completed.map((item) => renderRow(item))}</ul>` : ""}
            ${!items.some((item) => !_isComplete(item)) && !completed.length
              ? html`<p>${_boardText(this.hass)[7]}</p>` : ""}
          </section>
        `;
      }

      _renderAssignmentColumns(deadlineContext) {
        const [, unassigned, unavailableUser] = _assignmentText(this.hass);
        const groups = new Map();
        const unassignedItems = [];
        for (const item of this._items) {
          const assignee = this._assignments?.[item.uid];
          if (!assignee) {
            unassignedItems.push(item);
            continue;
          }
          if (!groups.has(assignee)) groups.set(assignee, []);
          groups.get(assignee).push(item);
        }
        const names = new Map(this._users.map((user) => [user.id, user.name]));
        const columns = [...groups].map(([id, items]) => [names.get(id) || unavailableUser, items]);
        columns.sort(([a], [b]) => a.localeCompare(b, this.hass.locale?.language));
        return html`
          <div class="assignment-columns">
            ${this._renderAssignmentColumn(unassigned, unassignedItems, 0, deadlineContext)}
            ${columns.map(([name, items], index) => this._renderAssignmentColumn(name, items, index + 1, deadlineContext))}
          </div>
        `;
      }

      get _unavailable() {
        return ["unknown", "unavailable"].includes(this.hass?.states?.[this.entityId]?.state);
      }

      render() {
        const own = this._supportsAssignment;
        const loading = this.hass?.localize("ui.common.loading") || "Loading…";
        const ready = !this._loading && !this._itemsError;
        const deadlineContext = own && ready ? this._deadlineContext() : undefined;
        return html`
          ${_boardHeading(this.hass, this.entityId, this.hideCompleted,
            () => this.dispatchEvent(new Event("toggle-completed")),
            own ? () => this.openCreate() : null, this._unavailable,
            this.canConfigure ? () => this.dispatchEvent(new Event("configure-list")) : null)}
          ${ready ? _boardProgress(this.hass, this.entityId, this._items, deadlineContext) : ""}
          ${own
            ? (ready ? this._renderAssignmentColumns(deadlineContext)
              : html`<p role="status">${this._itemsError ? _boardText(this.hass)[9] : loading}</p>`)
            : (this._card || html`<p role="status">${loading}</p>`)}
          ${this._actionError ? html`<p role="alert">${this._actionError}</p>` : ""}
          <better-todo-task-dialog-v091
            .hass=${this.hass}
            .entityId=${this.entityId}
            .supportsAssignment=${own}
            .users=${this._users}
            .usersError=${this._usersError}
            @item-saved=${() => this._fetchItems()}
          ></better-todo-task-dialog-v091>
        `;
      }

      static get styles() {
        return [_boardStyles, css`
          .assignment-columns {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr));
            align-items: start; gap: 12px;
          }
          .assignment-column {
            background: var(--bt-neutral); border: 1px solid var(--bt-border);
            border-radius: 16px; min-width: 0; overflow: hidden;
          }
          .assignment-column h2 {
            margin: 0; padding: 12px; display: flex; align-items: center;
            gap: 10px; font-size: 1.2rem; min-height: 38px; overflow-wrap: anywhere;
          }
          .assignment-column.lilac h2 { background: var(--bt-lilac); }
          .assignment-column.peach h2 { background: var(--bt-peach); }
          .avatar {
            display: grid; place-items: center; width: 34px; height: 34px; flex: 0 0 auto;
            border-radius: 50%; background: var(--bt-avatar); color: var(--bt-ink);
          }
          .peach .avatar { background: var(--bt-avatar-warm); }
          .assignment-column ul {
            display: grid; gap: 8px; list-style: none; margin: 0; padding: 8px;
          }
          .due-section h3 {
            margin: 9px 9px 0; padding: 4px 8px; border-radius: 7px;
            width: fit-content; color: var(--bt-muted); font-size: .86em;
          }
          [data-due-status="overdue"] h3 { color: var(--error-color, #bd3232); background: var(--bt-surface); }
          [data-due-status="today"] h3 { color: var(--bt-ink); background: var(--bt-peach); }
          [data-due-status="soon"] h3 { color: var(--bt-ink); background: var(--bt-lilac); }
          .assignment-column p { margin: 8px 12px 16px; color: var(--bt-muted); }
          .task-row {
            display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start;
            min-height: 54px; background: var(--bt-surface); border: 1px solid var(--bt-border);
            border-radius: 12px; padding: 4px 3px 4px 1px;
          }
          .task-row.completed { background: var(--bt-neutral); }
          .task-summary, .row-actions button {
            font: inherit; border: 0; background: transparent; color: inherit; cursor: pointer;
          }
          .task-summary { text-align: start; overflow-wrap: anywhere; padding: 11px 3px 8px; }
          .task-title { font-weight: 650; }
          .completed .task-title { text-decoration: line-through; color: var(--bt-muted); }
          .task-notes { display: block; color: var(--bt-muted); margin-top: 4px; white-space: pre-line; }
          .task-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
          .task-tag {
            display: inline-flex; align-items: center; gap: 5px; background: var(--bt-peach);
            padding: 4px 7px; border-radius: 7px; font-size: .82em;
          }
          .task-tag.repeat { background: var(--bt-lilac); }
          .row-actions { display: flex; }
          .row-actions button { padding: 0; width: 30px; height: 42px; color: var(--bt-muted); }
          .row-actions button:disabled, .task-summary:disabled { cursor: default; }
          @media (pointer: coarse) {
            .row-actions button, .task-check { width: 44px; height: 44px; }
          }
        `];
      }
    }

    customElements.define("better-todo-task-list-v091", BetterTodoTaskList);

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoShoppingList
    // Displays shopping-list items grouped alphabetically by category, showing
    // name, quantity and unit for each item.
    // ═══════════════════════════════════════════════════════════════════════════
    class BetterTodoShoppingList extends LitElement {
      static get properties() {
        return {
          hass:     { attribute: false },
          entityId: { type: String },
          hideCompleted: { type: Boolean },
          canConfigure: { type: Boolean },
          _actionError: { state: true },
          _itemsError: { state: true },
          _adding: { state: true },
          _saving: { state: true },
          _items:   { state: true },
          _loading: { state: true },
        };
      }

      constructor() {
        super();
        this._items    = [];
        this._loading  = true;
        this._pendingItems = new Set();
        this._stateKey = null;
        this._fetchSequence = 0;
      }

      connectedCallback() {
        super.connectedCallback();
        if (this.hasUpdated) {
          _startItemSubscription(this);
          this._fetchItems();
        }
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        _stopItemSubscription(this);
        this._fetchSequence++;
      }

      async _fetchItems() {
        if (!this.hass || !this.entityId) return;
        const entityId = this.entityId;
        const fetchSequence = ++this._fetchSequence;
        this._loading = true;
        try {
          const res = await this.hass.callWS({
            type: "todo/item/list", entity_id: entityId,
          });
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._items = res?.items || [];
            this._itemsError = false;
          }
        } catch {
          if (fetchSequence === this._fetchSequence && entityId === this.entityId) {
            this._itemsError = true;
          }
        } finally {
          if (fetchSequence === this._fetchSequence) {
            this._loading = false;
          }
        }
      }

      updated(changedProps) {
        super.updated(changedProps);
        if (changedProps.has("entityId") ||
          (changedProps.has("hass") && changedProps.get("hass")?.connection !== this.hass?.connection)) {
          _startItemSubscription(this);
        }
        if (changedProps.has("entityId")) {
          this._fetchSequence++;
          this._items    = [];
          this._stateKey = null;
          this._pendingItems = new Set();
          this._actionError = "";
          this._adding = false;
          this._fetchItems();
          return;
        }
        if (changedProps.has("hass") && this.hass) {
          const s   = this.hass.states[this.entityId];
          const key = s ? `${s.last_updated}|${s.state}` : null;
          if (key !== this._stateKey) {
            this._stateKey = key;
            this._fetchItems();
          }
        }
      }

      async _toggle(item) {
        const pending = this._pendingItems;
        if (pending.has(item.uid)) return;
        const entityId = this.entityId;
        pending.add(item.uid);
        this._actionError = "";
        this.requestUpdate();
        try {
          const status = _isComplete(item) ? "needs_action" : "completed";
          await this.hass.callService("todo", "update_item", {
            entity_id: entityId, item: item.uid, status,
          });
          if (entityId === this.entityId) await this._fetchItems();
        } catch (err) {
          if (entityId === this.entityId) this._actionError = err?.message || _boardText(this.hass)[9];
        } finally {
          pending.delete(item.uid);
          this.requestUpdate();
        }
      }

      async _showAdd() {
        this._adding = true;
        this._actionError = "";
        await this.updateComplete;
        this.shadowRoot.querySelector(".shopping-add input")?.focus();
      }

      async _addItem(event) {
        event.preventDefault();
        const summary = event.currentTarget.elements.namedItem("summary").value.trim();
        if (!summary || this._saving) return;
        const entityId = this.entityId;
        this._saving = true;
        this._actionError = "";
        try {
          await this.hass.callService("todo", "add_item", { entity_id: entityId, item: summary });
          if (entityId === this.entityId) {
            this._adding = false;
            await this._fetchItems();
          }
        } catch (err) {
          if (entityId === this.entityId) this._actionError = err?.message || this.hass.localize("ui.common.error");
        } finally {
          this._saving = false;
        }
      }

      render() {
        const text = _boardText(this.hass);
        const details = this.hass?.states[this.entityId]?.attributes?.task_details || {};
        const unavailable = ["unknown", "unavailable"].includes(this.hass?.states[this.entityId]?.state);
        const groups = new Map();
        for (const item of this._items) {
          if (this.hideCompleted && _isComplete(item)) continue;
          const category = details[item.uid]?.category || "";
          if (!groups.has(category)) groups.set(category, []);
          groups.get(category).push(item);
        }
        const locale = this.hass?.locale?.language;
        const categories = [...groups.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, locale));
        if (groups.has("")) categories.push("");

        return html`
          ${_boardHeading(this.hass, this.entityId, this.hideCompleted,
            () => this.dispatchEvent(new Event("toggle-completed")),
            () => this._showAdd(), unavailable,
            this.canConfigure ? () => this.dispatchEvent(new Event("configure-list")) : null)}
          ${this._adding ? html`
            <form class="shopping-add" @submit=${this._addItem}>
              <input name="summary" aria-label=${text[2]} placeholder=${text[2]} required ?disabled=${this._saving}>
              <button type="submit" class="board-button primary" ?disabled=${this._saving}>
                ${_icon("plus")} ${text[2]}
              </button>
              <button type="button" class="board-button" ?disabled=${this._saving}
                @click=${() => { this._adding = false; }}>
                ${this.hass.localize("ui.common.cancel") || "Cancel"}
              </button>
            </form>
          ` : ""}
          ${!this._loading && !this._itemsError ? _boardProgress(this.hass, this.entityId, this._items) : ""}
          ${this._loading || this._itemsError || !categories.length ? html`
            <p role="status">${this._loading ? this.hass?.localize("ui.common.loading") || "Loading…"
              : this._itemsError ? text[9] : text[7]}</p>` : ""}
          <div class="shopping-categories">
            ${categories.map((category) => {
              const items = groups.get(category);
              const ordered = [...items.filter((item) => !_isComplete(item)), ...items.filter(_isComplete)];
              return html`
                <section class="shopping-category">
                  <h2>${_icon("cartShopping")} ${category || text[8]}</h2>
                  <ul>${ordered.map((item) => {
                    const detailsForItem = details[item.uid] || {};
                    // The backend's quantity already includes the unit.
                    const quantity = detailsForItem.quantity || detailsForItem.unit;
                    return html`
                      <li class=${_isComplete(item) ? "completed" : ""}>
                        ${_taskCheck(item, unavailable || this._pendingItems.has(item.uid), () => this._toggle(item))}
                        <span class="shop-name">${item.summary}</span>
                        ${quantity ? html`<small>${quantity}</small>` : ""}
                      </li>
                    `;
                  })}</ul>
                </section>
              `;
            })}
          </div>
          ${this._actionError ? html`<p role="alert">${this._actionError}</p>` : ""}
        `;
      }

      static get styles() {
        return [_boardStyles, css`
          .shopping-categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 12px; align-items: start; }
          .shopping-category { border-radius: 16px; background: var(--bt-neutral); border: 1px solid var(--bt-border); }
          .shopping-category h2 { display: flex; align-items: center; gap: 8px; font-size: 1.1rem; margin: 0; padding: 12px; }
          ul { list-style: none; margin: 0; padding: 8px; display: grid; gap: 8px; }
          li { display: flex; align-items: center; gap: 6px; padding: 4px; background: var(--bt-surface); border-radius: 10px; border: 1px solid var(--bt-border); }
          .shop-name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
          li small { color: var(--bt-muted); margin-inline-end: 8px; }
          .completed { background: var(--bt-neutral); }
          .completed .shop-name, .completed small { color: var(--bt-muted); text-decoration: line-through; }
          .shopping-add { display: flex; flex-wrap: wrap; gap: 8px; margin-block-end: 12px; }
          .shopping-add input {
            flex: 1 1 140px; min-width: 0; border: 1px solid var(--bt-border);
            border-radius: 10px; background: var(--bt-surface); color: inherit;
            padding: 8px 12px; font: inherit;
          }
        `];
      }
    }

    customElements.define("better-todo-shopping-list-v091", BetterTodoShoppingList);

    // ═══════════════════════════════════════════════════════════════════════════
    // BetterTodoPanel
    // ═══════════════════════════════════════════════════════════════════════════

    class BetterTodoPanel extends LitElement {
      static get properties() {
        return {
          hass: { attribute: false },
          narrow: { type: Boolean },
          _compact: { state: true },
          _selectedEntityId: { state: true },
          _hideCompleted: { state: true },
          _creatingList: { state: true },
          _savingList: { state: true },
          _listError: { state: true },
          _listSettings: { state: true },
        };
      }

      constructor() {
        super();
        this._compact = false;
        this._selectedEntityId = null;
        this._hideCompleted = false;
        this._creatingList = false;
        this._savingList = false;
        this._listError = "";
        this._listSettings = null;
        try {
          this._selectedEntityId = sessionStorage.getItem("better-todo-selected-entity");
          this._hideCompleted = sessionStorage.getItem("better-todo-hide-completed") === "true";
        } catch {
          // Browser storage can be unavailable.
        }
        this._todoListsCache = [];
        this._todoStateRefs = new Map();
        this._entityRegistryRef = null;
        this._resizeObserver = new ResizeObserver(([entry]) => {
          this._compact = entry.contentRect.width < 760;
        });
      }

      /** Returns all todo-domain state objects, sorted alphabetically with the
       *  Better To-do Shopping List pinned to the end of the list. */
      _getTodoLists() {
        if (!this.hass) return [];
        const entities = Object.values(this.hass.states).filter(
          (s) => s.entity_id.startsWith("todo.")
        );
        const registryChanged = this.hass.entities !== this._entityRegistryRef;
        const statesChanged =
          entities.length !== this._todoStateRefs.size ||
          entities.some((state) => this._todoStateRefs.get(state.entity_id) !== state);

        if (!registryChanged && !statesChanged) {
          return this._todoListsCache;
        }

        entities.sort((a, b) => {
          const aShop = this._isShoppingList(a.entity_id);
          const bShop = this._isShoppingList(b.entity_id);
          if (aShop && !bShop) return 1;
          if (!aShop && bShop) return -1;
          return _computeStateName(a).localeCompare(_computeStateName(b));
        });
        this._todoListsCache = entities;
        this._todoStateRefs = new Map(
          entities.map((state) => [state.entity_id, state])
        );
        this._entityRegistryRef = this.hass.entities;
        return this._todoListsCache;
      }

      /** Returns true if the given entity_id belongs to the built-in Better
       *  To-do Shopping List (identified via the entity registry unique_id). */
      _isShoppingList(entityId) {
        return _isBetterTodoShoppingList(this.hass, entityId);
      }

      get _canConfigureList() {
        const entityId = this._selectedEntityId;
        return Boolean(this.hass?.user?.is_admin && entityId &&
          (_canAssignTasks(this.hass, entityId) || this._isShoppingList(entityId)));
      }

      async _openListSettings() {
        if (!this._canConfigureList || this._listSettings) return;
        const request = { entityId: this._selectedEntityId, loading: true };
        this._listSettings = request;
        await this.updateComplete;
        if (this._listSettings !== request) return;
        this.shadowRoot.querySelector(".list-settings").showModal();
        try {
          const result = await this.hass.callWS({
            type: "better_todo/list_settings", entity_id: request.entityId,
          });
          if (this._listSettings !== request) return;
          this._listSettings = {
            entityId: request.entityId,
            original: result,
            name: result.name,
            enabled: result.cleanup_enabled,
            months: result.retention_months,
            custom: result.retention_months !== 1,
            sharedCleanup: result.shared_cleanup,
          };
          await this.updateComplete;
          this.shadowRoot.querySelector("#better-todo-list-name")?.focus();
        } catch {
          if (this._listSettings === request) {
            this._listSettings = { error: _listSettingsText(this.hass)[8] };
          }
        }
      }

      _closeListSettings() {
        this.shadowRoot?.querySelector(".list-settings")?.close();
        this._listSettings = null;
      }

      async _saveListSettings(event) {
        event.preventDefault();
        const current = this._listSettings;
        const name = current?.name?.trim();
        if (!name || current.saving) return;
        const months = current.custom ? current.months : 1;
        if (current.enabled && (!Number.isInteger(months) || months < 1)) return;
        const settings = {};
        if (name !== current.original.name) settings.name = name;
        if (current.enabled !== current.original.cleanup_enabled) settings.cleanup_enabled = current.enabled;
        if (current.enabled && months !== current.original.retention_months) settings.retention_months = months;
        if (!Object.keys(settings).length) {
          this._closeListSettings();
          return;
        }
        const request = { ...current, saving: true, error: "" };
        this._listSettings = request;
        try {
          await this.hass.callWS({
            type: "better_todo/list_settings", entity_id: current.entityId, settings,
          });
          if (this._listSettings === request) this._closeListSettings();
        } catch {
          if (this._listSettings === request) {
            this._listSettings = { ...current, error: _listSettingsText(this.hass)[9] };
          }
        }
      }

      _renderListSettings() {
        const [title, name, cleanup, retention, defaultPeriod, customPeriod, months, shared] = _listSettingsText(this.hass);
        const current = this._listSettings;
        const L = (key, fallback) => this.hass?.localize(key) || fallback;
        return html`
          <dialog class="list-settings" aria-labelledby="better-todo-list-settings-title"
            @cancel=${(event) => {
              event.preventDefault();
              if (!this._listSettings?.saving) this._closeListSettings();
            }}>
            ${current ? html`
              <h2 id="better-todo-list-settings-title">${title}</h2>
              <form @submit=${this._saveListSettings}>
                ${current.loading ? html`<p role="status">${L("ui.common.loading", "Loading…")}</p>` : ""}
                ${current.name !== undefined ? html`
                  <fieldset ?disabled=${current.saving}>
                    <label for="better-todo-list-name">${name}</label>
                    <input id="better-todo-list-name" name="name" .value=${current.name} required
                      @input=${(event) => { this._listSettings = { ...current, name: event.target.value }; }}>
                    <label class="cleanup-toggle">
                      <input type="checkbox" .checked=${current.enabled}
                        @change=${(event) => { this._listSettings = { ...current, enabled: event.target.checked }; }}>
                      ${cleanup}
                    </label>
                    ${current.enabled ? html`
                      <label for="better-todo-list-retention">${retention}</label>
                      <select id="better-todo-list-retention" .value=${current.custom ? "custom" : "default"}
                        @change=${(event) => { this._listSettings = { ...current, custom: event.target.value === "custom" }; }}>
                        <option value="default">${defaultPeriod}</option>
                        <option value="custom">${customPeriod}</option>
                      </select>
                      ${current.custom ? html`
                        <label for="better-todo-list-months">${months}</label>
                        <input id="better-todo-list-months" type="number" min="1" step="1" required
                          .value=${Number.isNaN(current.months) ? "" : String(current.months)}
                          @input=${(event) => { this._listSettings = { ...current, months: event.target.valueAsNumber }; }}>
                      ` : ""}
                    ` : ""}
                    ${current.sharedCleanup ? html`<p class="settings-help">${shared}</p>` : ""}
                  </fieldset>
                ` : ""}
                ${current.error ? html`<p role="alert">${current.error}</p>` : ""}
                <div class="settings-actions">
                  <button type="button" class="board-button" ?disabled=${current.saving}
                    @click=${this._closeListSettings}>${L("ui.common.cancel", "Cancel")}</button>
                  ${current.name !== undefined ? html`
                    <button type="submit" class="board-button primary" ?disabled=${current.saving || !current.name.trim()}>
                      ${L("ui.common.save", "Save")}
                    </button>
                  ` : ""}
                </div>
              </form>
            ` : ""}
          </dialog>
        `;
      }

      _setSelectedEntity(entityId) {
        this._selectedEntityId = entityId;
        try {
          sessionStorage.setItem("better-todo-selected-entity", entityId);
        } catch {
          // The current selection still works without browser storage.
        }
      }

      _toggleCompleted() {
        this._hideCompleted = !this._hideCompleted;
        try {
          sessionStorage.setItem("better-todo-hide-completed", String(this._hideCompleted));
        } catch {
          // The current filter still works without browser storage.
        }
      }

      async _revealNewList() {
        this._creatingList = true;
        this._listError = "";
        await this.updateComplete;
        this.shadowRoot.querySelector(".new-list-form input")?.focus();
      }

      async _createList(event) {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("name");
        const name = input.value.trim();
        if (!name || this._savingList) return;
        this._savingList = true;
        this._listError = "";
        const url = "config/config_entries/flow";
        let flowId;
        const L = (key, fallback) => this.hass.localize(key) || fallback;
        try {
          const flow = await this.hass.callApi("POST", url, { handler: "better_todo" });
          flowId = flow.flow_id;
          if (flow.type !== "form" || flow.step_id !== "user") {
            throw new Error(L("ui.common.error", "Could not create list"));
          }
          const result = await this.hass.callApi("POST", `${url}/${flowId}`, { todo_list_name: name });
          if (result.type !== "create_entry") {
            throw new Error(result.reason === "already_configured"
              ? L("ui.panel.config.integrations.config_flow.abort.already_configured", "A list with this name already exists")
              : L("ui.common.error", "Could not create list"));
          }
          flowId = undefined;
          this._creatingList = false;
        } catch (err) {
          this._listError = err?.body?.message || err?.message || L("ui.common.error", "Could not create list");
        } finally {
          if (flowId) this.hass.callApi("DELETE", `${url}/${flowId}`).catch(() => {});
          this._savingList = false;
        }
      }

      connectedCallback() {
        super.connectedCallback();
        this._resizeObserver.observe(this);
      }

      disconnectedCallback() {
        super.disconnectedCallback();
        this._resizeObserver.disconnect();
        if (this._listSettings) this._closeListSettings();
      }

      willUpdate(changedProps) {
        super.willUpdate(changedProps);
        if (this.hass && !this.hass.states?.[this._selectedEntityId]) {
          this._selectedEntityId = this._getTodoLists()[0]?.entity_id ?? null;
        }
      }

      render() {
        const lists = this._getTodoLists();
        const [myLists, newList] = _boardText(this.hass);
        const isShopping = this._isShoppingList(this._selectedEntityId);
        return html`
          <div class="shell ${this._compact ? "compact" : ""}" ?data-dark=${this.hass?.themes?.darkMode}>
            <aside class="sidebar">
              <div class="brand">
                ${(this.narrow || this.hass?.dockedSidebar === "always_hidden") &&
                  !this.hass?.kioskMode && !this.hass?.auth?.external?.config?.hasSidebar
                  ? html`
                    <button type="button" class="menu-toggle"
                      aria-label=${this.hass?.localize("ui.sidebar.sidebar_toggle") || "Toggle sidebar"}
                      @click=${() => this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }))}>
                      ${_icon("bars")}
                    </button>
                  ` : ""}
                <span class="brand-mark">${_icon("squareCheck")}</span>
                <span>Better ToDo</span>
              </div>
              <div class="list-links">
                <h2>${myLists}</h2>
                <nav aria-label=${myLists}>
                  ${lists.map((list) => html`
                    <button type="button" aria-current=${list.entity_id === this._selectedEntityId ? "true" : "false"}
                      @click=${() => this._setSelectedEntity(list.entity_id)}>
                      ${_icon(_listIcon(list))}<span>${_computeStateName(list)}</span>
                    </button>
                  `)}
                </nav>
              </div>
              ${this._compact && lists.length ? html`
                <select class="list-picker" aria-label=${myLists} @change=${(event) => this._setSelectedEntity(event.target.value)}>
                  ${lists.map((list) => html`<option value=${list.entity_id} .selected=${list.entity_id === this._selectedEntityId}>
                    ${_computeStateName(list)}
                  </option>`)}
                </select>
              ` : ""}
              ${this.hass?.user?.is_admin ? html`
                <div class="list-create">
                  ${this._creatingList ? html`
                    <form class="new-list-form" @submit=${this._createList}>
                      <input name="name" aria-label=${newList} placeholder=${newList} required ?disabled=${this._savingList}>
                      <div>
                        <button type="button" ?disabled=${this._savingList}
                          @click=${() => { this._creatingList = false; }}>
                          ${this.hass.localize("ui.common.cancel") || "Cancel"}
                        </button>
                        <button type="submit" ?disabled=${this._savingList}>${newList}</button>
                      </div>
                      ${this._listError ? html`<p role="alert">${this._listError}</p>` : ""}
                    </form>
                  ` : html`<button type="button" class="new-list" @click=${this._revealNewList}>${_icon("plus")} ${newList}</button>`}
                </div>
              ` : ""}
            </aside>
            <main class="workspace">
              ${this._selectedEntityId ? isShopping ? html`
                <better-todo-shopping-list-v091 .hass=${this.hass} .entityId=${this._selectedEntityId}
                  .hideCompleted=${this._hideCompleted} .canConfigure=${this._canConfigureList}
                  @toggle-completed=${this._toggleCompleted} @configure-list=${this._openListSettings}>
                </better-todo-shopping-list-v091>
              ` : html`
                <better-todo-task-list-v091 .hass=${this.hass} .entityId=${this._selectedEntityId}
                  .hideCompleted=${this._hideCompleted} .canConfigure=${this._canConfigureList}
                  @toggle-completed=${this._toggleCompleted} @configure-list=${this._openListSettings}>
                </better-todo-task-list-v091>
              ` : html`<p>${this.hass?.localize("ui.panel.todo.no_lists") || "No lists found."}</p>`}
            </main>
            ${this._renderListSettings()}
          </div>
        `;
      }

      static get styles() {
        return [_boardStyles, css`
          :host { display: block; }
          .shell {
            --bt-canvas: #fbf5ef; --bt-surface: #fffcf9; --bt-ink: #271629; --bt-muted: #685a69;
            --bt-neutral: #f2eae4; --bt-border: #e9dcd9; --bt-accent: #5b2167;
            --bt-primary: #732487; --bt-lilac: #eadaf6; --bt-peach: #fbe3d0;
            --bt-avatar: #d3a5ee; --bt-avatar-warm: #ffc59c; --bt-done: #628723;
            min-height: 100dvh; box-sizing: border-box; display: grid;
            grid-template-columns: clamp(165px, 19%, 248px) minmax(0, 1fr);
            background: var(--bt-canvas); color: var(--bt-ink);
          }
          .shell[data-dark] {
            --bt-canvas: #211b25; --bt-surface: #33283a; --bt-ink: #f8eefb; --bt-muted: #d4c4d5;
            --bt-neutral: #2c2231; --bt-border: #55465c; --bt-accent: #e3b0f3;
            --bt-primary: #8734a0; --bt-lilac: #48304f; --bt-peach: #573a34;
            --bt-avatar: #755089; --bt-avatar-warm: #8e5544; --bt-done: #c0ed5e;
          }
          .sidebar {
            display: flex; flex-direction: column; gap: 22px; min-width: 0; padding: 20px 12px;
            color: #fff6ff; background: #35123e;
            border-start-end-radius: 16px; border-end-end-radius: 16px;
          }
          .brand { display: flex; align-items: center; gap: 8px; font-size: clamp(1rem, 2vw, 1.4rem); font-weight: 750; }
          .brand-mark { display: grid; place-items: center; color: #e1bdff; font-size: 1.25em; }
          .list-links h2 { margin: 0 0 9px 8px; font-size: .95rem; color: #e8cbed; }
          nav { display: grid; gap: 5px; }
          .sidebar button, .sidebar input, .list-picker {
            font: inherit; color: inherit; border: 0; background: transparent; border-radius: 9px;
          }
          .sidebar button { cursor: pointer; min-height: 42px; }
          .sidebar button:disabled { opacity: .65; cursor: default; }
          .sidebar button:focus-visible, .sidebar input:focus-visible, .list-picker:focus-visible {
            outline: 2px solid #d6eb77; outline-offset: 2px;
          }
          nav button {
            display: flex; align-items: center; gap: 10px; padding: 8px; width: 100%;
            text-align: start; font-weight: 550;
          }
          nav button span { min-width: 0; overflow-wrap: anywhere; }
          nav button svg { flex: 0 0 auto; }
          nav button[aria-current="true"] { background: #81468c; font-weight: 700; }
          nav button:hover:not([aria-current="true"]) { background: #53265e; }
          .menu-toggle { padding-inline: 8px; }
          .list-create { margin-block-start: auto; }
          .new-list {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%; padding: 8px;
          }
          .sidebar .new-list, .new-list-form button[type="submit"] { background: #ecd6f9; color: #35123e; font-weight: 700; }
          .new-list-form { display: grid; gap: 8px; }
          .new-list-form input, .list-picker { min-width: 0; width: 100%; box-sizing: border-box; padding: 9px; background: #53265e; }
          .new-list-form div { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
          .new-list-form p { margin: 0; overflow-wrap: anywhere; }
          .sidebar input::placeholder { color: #e8cbed; }
          .workspace {
            width: 100%; max-width: 1480px; min-width: 0; box-sizing: border-box; margin-inline: auto;
            padding: clamp(14px, 3vw, 36px) clamp(12px, 2.5vw, 30px) 36px;
          }
          .list-settings {
            width: min(430px, calc(100% - 28px)); max-height: calc(100dvh - 28px);
            box-sizing: border-box; padding: clamp(16px, 5vw, 24px); overflow: auto;
            border: 1px solid var(--bt-border); border-radius: 16px;
            background: var(--bt-surface); color: var(--bt-ink); box-shadow: 0 20px 60px #0004;
          }
          .list-settings::backdrop { background: #160b1a99; }
          .list-settings h2 { margin: 0 0 16px; font-size: 1.25rem; }
          .list-settings form, .list-settings fieldset { display: grid; gap: 8px; }
          .list-settings fieldset { min-width: 0; border: 0; margin: 0; padding: 0; }
          .list-settings p { margin: 0; }
          .list-settings label { font-weight: 600; }
          .list-settings input:not([type="checkbox"]), .list-settings select {
            box-sizing: border-box; width: 100%; padding: 9px; font: inherit;
            border: 1px solid var(--bt-border); border-radius: 8px;
            background: var(--bt-neutral); color: var(--bt-ink);
          }
          .cleanup-toggle { display: flex; align-items: center; gap: 8px; padding-block: 6px; }
          .cleanup-toggle input { inline-size: 1.1em; block-size: 1.1em; accent-color: var(--bt-primary); }
          .settings-help { color: var(--bt-muted); font-size: .9rem; }
          .settings-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; margin-top: 8px; }
          .compact { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; }
          .compact .sidebar {
            display: grid; grid-template-columns: minmax(0, 1fr) auto;
            align-items: center; gap: 8px; border-radius: 0; padding: 10px 12px;
          }
          .compact .list-links { display: none; }
          .compact .list-picker { grid-column: 1; }
          .compact .list-create { grid-column: 2; grid-row: 2; margin-block-start: 0; }
          .compact .list-create:has(.new-list-form) { grid-column: 1 / -1; grid-row: auto; }
          .list-picker option { color: #fff6ff; background: #35123e; }
        `];
      }
    }

    customElements.define("better-todo-panel-v091", BetterTodoPanel);
  }

  // ── Registration entry point ────────────────────────────────────────────────
  // Prefer any already-defined Lit host. Unlike ha-card, the application root
  // is present even when a custom panel is the first route after a cold boot.
  if (
    customElements.get("ha-card") ||
    customElements.get("home-assistant") ||
    customElements.get("hc-main") ||
    customElements.get("ha-panel-lovelace")
  ) {
    _definePanel();
  } else {
    Promise.race([
      customElements.whenDefined("home-assistant"),
      customElements.whenDefined("hc-main"),
      customElements.whenDefined("ha-card"),
      customElements.whenDefined("ha-panel-lovelace"),
    ]).then(_definePanel);
  }
})();
