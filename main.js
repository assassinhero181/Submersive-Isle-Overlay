// ============================================================
// FUTURE FEATURE DATA — KEEP THIS AREA EASY TO EXTEND
// Inventory, currency, and store definitions live in ./data/.
// Add new data there first; keep UI/network logic below separate.
// Files:
//   ./data/inventory-items.js
//   ./data/currency.js
//   ./data/store-items.js
// ============================================================

"use strict";


/* =========================================================
   SUBMERSIVE ISLE
   Evrima Overlay Controller
   ========================================================= */

const SubmersiveIsle = {

  overlay: null,
  minimalHud: null,
  miniMap: null,


  state: {

    overlayOpen: false,
    currentPage: "status",

    species: null,
    sex: null,
    age: null,

    growth: null,
    growthStage: null,

    health: null,
    stamina: null,
    hunger: null,
    thirst: null,

    location: null,
    temperature: null,
    weather: null,
    time: null,

    serverConnected: false,
    rconConfigured: false,
    rconMessage: "NOT CONFIGURED",

    playerName: null,
    playerId: null,

    mutations: [],
    parentMutations: [],
    elderA: [],
    elderB: [],
    primeElder: false,
    primeConditions: [],
    primeConditionSource: "LOCAL TRACKER",

    primeTracker: {
      lifeKey: null,
      perfectDiet: false,
      sanctuary: false,
      nested: false,
      massMigration: false,
      migrations: [],
      patrols: [],
      noInfertility: true,
      noMuscleSpasms: true,
      raisedChild: false,
      speciesBonus: false,
      zoneDataLoaded: false,
      zoneDataError: null,
      lastZone: null,
      lastZoneAt: 0
    },

    serverName: null,
    players: null,
    ping: null,
    tick: null,

    inventory: [],
    garage: [],
    selectedGarageId: null,

    weight: null,
    speed: null,
    biteForce: null,
    preferredFood: null,
    diet: null,
    dietValues: { protein: null, carbohydrates: null, lipids: null },

    statusEffects: [],
    _visualStatusEffects: {
      bleeding: false,
      fractured: false
    },
    _statusEffectHistory: {},

    group: {
      id: null,
      name: null,
      members: [],
      pairedWith: null,
      spawnCode: null,
      inviteCode: null,
      status: "NOT EXPOSED BY RCON"
    },

    growthRate: null,
    growthEta: null,

    garageBackendConnected: false,
    garageBackendMessage: "GARAGE BACKEND NOT CONNECTED",
    garageBusy: false,

    mutationBusy: false,
    mutationMessage: "READY",

    _coords: null,

    proximity: {
      contacts: [],
      rangeMeters: 250,
      source: "RCON PLAYER DATA",
      aiAvailable: false,
      aiMessage: "AI actor locations are not exposed by Evrima RCON",
      aiContacts: []
    }

  },


  /* =======================================================
     LIVE RCON TELEMETRY CONTROL
     ======================================================= */

  _rconTelemetryRunning: false,
  _rconTelemetryPolling: false,
  _rconTelemetryTimer: null,
  _rconTelemetryRequestId: 0,

  LIVE_TELEMETRY_INTERVAL_MS: 5000,


  /* =======================================================
     AVAILABLE EVRIMA MUTATIONS
     ======================================================= */

  availableMutations: [

    { name: "Hemomania", effect: 0.05 },
    { name: "Hematophagy", effect: 0.25 },
    { name: "Accelerated Prey Drive", effect: 0.1 },
    { name: "Xerocole Adaptation", effect: 0.2 },
    { name: "Hypervigilance", effect: 0.5 },
    { name: "Truculency", effect: 0.05 },
    { name: "Osteophagic", effect: 0.15 },
    { name: "Photosynthetic Regeneration", effect: 0.1 },
    { name: "Cellular Regeneration", effect: 0.15 },
    { name: "Advanced Gestation", effect: 0.5 },
    { name: "Sustained Hydration", effect: 0.2 },
    { name: "Efficient Digestion", effect: 0.2 },
    { name: "Featherweight", effect: 0.5 },
    { name: "Osteosclerosis", effect: 0.2 },
    { name: "Wader", effect: 0.25 },
    { name: "Epidermal Fibrosis", effect: 0.15 },
    { name: "Congenital Hypoalgesia", effect: 0.15 },
    { name: "Photosynthetic Tissue", effect: 0.05 },
    { name: "Nocturnal", effect: 0.05 },
    { name: "Hydroregenerative", effect: 0.25 },
    { name: "Increased Inspiratory Capacity", effect: 0.15 },
    { name: "Hydrodynamic", effect: 0.15 },
    { name: "Submerged Optical Retention", effect: 0.05 },
    { name: "Infrasound Communication", effect: 0.5 },
    { name: "Augmented Tapetum", effect: 1 },
    { name: "Hypermetabolic Inanition", effect: 0.25 },
    { name: "Tactile Endurance", effect: 0.5 },
    { name: "Gastronomic Regeneration", effect: 0.1 },
    { name: "Heightened Ghrelin", effect: 0.25 },
    { name: "Prolific Reproduction", effect: 0.1 },
    { name: "Enhanced Digestion", effect: 0.1 },
    { name: "Reinforced Tendons", effect: 0.5 },
    { name: "Multichambered Lungs", effect: 0.05 },
    { name: "Enlarged meniscus", effect: 1 },
    { name: "Reabsorption", effect: 1 },
    { name: "Cannibalistic", effect: 1 },
    { name: "Barometric Sensitivity", effect: 1 },
    { name: "Social Behavior", effect: 1 },
    { name: "Traumatic Thrombosis", effect: 1 },
    { name: "Reniculate Kidneys", effect: 1 },
    { name: "NHJ-INF", effect: 1 },
    { name: "NHJ-UND", effect: 1 }

  ],


  /* =======================================================
     INIT
     ======================================================= */

  init() {

    this.overlay =
      document.getElementById("overlay");

    this.minimalHud =
      document.getElementById("minimalHud");

    this.miniMap =
      document.getElementById("miniMap");


    /* =====================================================
       LOAD LINKED STEAM ID
       ===================================================== */

    const linkedSteamId =
      localStorage.getItem("submersiveSteamId");

    if (linkedSteamId) {

      this.state.playerId =
        String(linkedSteamId).trim();

      console.log(
        "[IDENTITY] Linked Steam ID loaded:",
        this.state.playerId
      );

    } else {

      console.warn(
        "[IDENTITY] No linked Steam ID found."
      );

    }


    /* =====================================================
       CREATE ONE PERMANENT PLAYER MARKER
       ===================================================== */

    const ping =
      document.createElement("div");

    ping.id =
      "miniMapCoordinatePing";

    ping.className =
      "game-mini-map-coordinate-ping";

    ping.style.display =
      "none";


    const miniMapViewport =
      this.miniMap?.querySelector(
        ".game-mini-map-viewport"
      );

    if (miniMapViewport) {

      miniMapViewport.appendChild(ping);

    }


    this.setupNavigation();
    this.setupSettingsAndSkins();
    this.setupKeyboard();
    this.setupCloseButton();
    this.setupElectronBridge();
    this.setupInventoryGarage();


    this.updateClock();
    this.updateUI();

    this.syncOverlayState();


    setInterval(
      () => {
        this.updateClock();
      },
      1000
    );

  },


  /* =======================================================
     TAB / KEYBOARD
     ======================================================= */

  setupKeyboard() {

    /*
     * Electron owns global Tab/Escape shortcuts.
     */

  },


  /* =======================================================
     OPEN / CLOSE
     ======================================================= */

  toggleOverlay() {

    if (this.state.overlayOpen) {
      this.closeOverlay();
    } else {
      this.openOverlay();
    }

  },


  openOverlay() {

    this.state.overlayOpen = true;

    const s =
      this.overlaySettings || {};


    if (this.overlay) {
      this.overlay.classList.remove("hidden");
    }


    const primeTracker =
      document.getElementById(
        "miniPrimeTracker"
      );

    if (primeTracker) {

      primeTracker.style.width =
        `${s.primeSize}px`;

      primeTracker.style.opacity =
        s.primeOpacity;

      if (s.primeX === 0 && s.primeY === 0) {
        primeTracker.style.left =
          "calc(50% + 365px)";
        primeTracker.style.bottom =
          "20px";
        primeTracker.style.top =
          "auto";
      } else {
        primeTracker.style.left =
          `${s.primeX}px`;
        primeTracker.style.top =
          `${s.primeY}px`;
        primeTracker.style.bottom =
          "auto";
      }

      primeTracker.style.display =
        s.primeEnabled && s.hudEnabled
          ? "block"
          : "none";

      primeTracker.style.visibility =
        this.state.overlayOpen
          ? "hidden"
          : "visible";

    }


    if (this.minimalHud) {
      this.minimalHud.style.opacity = "0";
    }


    const miniPrimeTracker =
      document.getElementById("miniPrimeTracker");

    if (miniPrimeTracker) {
      miniPrimeTracker.style.visibility = "hidden";
    }


    if (this.miniMap) {
      this.miniMap.classList.add("hidden");
    }


    if (window.electronAPI) {
      window.electronAPI.setInteractive(true);
    }


    this.syncOverlayState();
    this.startLiveTelemetry();

  },


  closeOverlay(stopTelemetry = false) {

    this.state.overlayOpen = false;


    if (this.overlay) {
      this.overlay.classList.add("hidden");
    }


    if (this.minimalHud) {
      this.minimalHud.style.opacity = "1";
    }


    const miniPrimeTracker =
      document.getElementById("miniPrimeTracker");

    if (miniPrimeTracker) {
      miniPrimeTracker.style.visibility = "visible";
    }


    if (this.miniMap) {
      this.miniMap.classList.remove("hidden");
    }


    if (window.electronAPI) {
      window.electronAPI.setInteractive(false);
    }


    if (stopTelemetry) {
      this.stopLiveTelemetry();
    }


    this.updateCoordinatePing();
    this.syncOverlayState();

  },


  /* =======================================================
     ELECTRON STATE SYNC
     ======================================================= */

  syncOverlayState() {

    document.body.dataset.overlayOpen =
      this.state.overlayOpen
        ? "true"
        : "false";

  },


  /* =======================================================
     ELECTRON BRIDGE
     ======================================================= */

  setupElectronBridge() {

    if (!window.electronAPI) {

      console.error(
        "[ELECTRON] electronAPI bridge missing."
      );

      return;

    }


    if (window.electronAPI.onOpen) {

      window.electronAPI.onOpen(
        () => {
          this.openOverlay();
        }
      );

    }


    if (window.electronAPI.onToggle) {

      window.electronAPI.onToggle(
        () => {
          this.toggleOverlay();
        }
      );

    }


    if (window.electronAPI.onClose) {

      window.electronAPI.onClose(
        (options) => {

          this.closeOverlay(
            Boolean(options?.stopTelemetry)
          );

        }
      );

    }


    if (window.electronAPI.onIdentityLinked) {

      window.electronAPI.onIdentityLinked(
        (identity) => {

          if (identity?.steamId) {

            const steamId =
              String(identity.steamId).trim();

            this.state.playerId =
              steamId;

            localStorage.setItem(
              "submersiveSteamId",
              steamId
            );

            console.log(
              "[IDENTITY] LIVE TRACKING PLAYER:",
              steamId
            );

            this.stopLiveTelemetry();
            this.startLiveTelemetry();

          }


          if (identity?.discordId) {

            localStorage.setItem(
              "submersiveDiscordId",
              String(identity.discordId)
            );

          }


          this.updateUI();

        }
      );

    }

  },


  /* =======================================================
     CLOSE BUTTON
     ======================================================= */

  setupCloseButton() {

    const closeButton =
      document.getElementById("closeOverlay");

    if (!closeButton) {
      return;
    }


    closeButton.addEventListener(
      "click",
      () => {
        this.closeOverlay();
      }
    );

  },


  /* =======================================================
     SETTINGS + ARKANIS + STORE
     ======================================================= */

  setupSettingsAndSkins() {

    const nav =
      document.querySelector(".nav-links");

    const main =
      document.querySelector(".overlay-main");

    if (!nav || !main) {
      return;
    }


    /* =====================================================
       ADD NAVIGATION BUTTONS
       ===================================================== */

    if (!nav.querySelector('[data-page="settings"]')) {

      nav.insertAdjacentHTML(
        "beforeend",

        '<button class="nav-link" data-page="skins">ARKANIS STUDIO</button>' +
        '<button class="nav-link" data-page="store">STORE</button>' +
        '<button class="nav-link" data-page="settings">SETTINGS</button>' +
        '<button class="nav-link" data-page="server">SERVER</button>' +
        '<button class="nav-link" data-page="exit">EXIT</button>'
      );

    }


    /* =====================================================
       ADD DYNAMIC PAGES
       ===================================================== */

    if (!document.getElementById("page-settings")) {

      main.insertAdjacentHTML(
        "beforeend",
        `

        <section id="page-settings" class="page">

          <div class="page-heading">

            <div>

              <p class="eyebrow">
                CLIENT CONFIGURATION · 08
              </p>

              <h2>
                OVERLAY <strong>SETTINGS</strong>
              </h2>

              <p>
                LOCAL SETTINGS FOR THE OVERLAY AND MINI MAP.
              </p>

            </div>

          </div>


          <div class="settings-grid">

            <article class="settings-card">

              <h3>MINI MAP</h3>

              <label>
                <span>ENABLED</span>
                <input
                  id="setMiniEnabled"
                  type="checkbox"
                >
              </label>

              <label>
                <span>SIZE</span>
                <input
                  id="setMiniSize"
                  type="range"
                  min="200"
                  max="600"
                  step="10"
                >
                <b id="setMiniSizeValue"></b>
              </label>

              <label>
                <span>OPACITY</span>
                <input
                  id="setMiniOpacity"
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                >
                <b id="setMiniOpacityValue"></b>
              </label>

              <label>
                <span>SHOW POSITION PING</span>
                <input
                  id="setMiniPing"
                  type="checkbox"
                >
              </label>

              <button
                id="editMiniMap"
                class="settings-action"
                type="button"
              >
                EDIT MINI MAP POSITION
              </button>

              <button
                id="resetMiniMap"
                class="settings-action"
                type="button"
              >
                RESET MINI MAP
              </button>

              <small id="miniMapEditStatus">
                Position is saved locally on this PC.
              </small>

            </article>


            <article class="settings-card">

              <h3>PRIME TRACKER</h3>

              <label>
                <span>ENABLED</span>
                <input
                  id="setPrimeEnabled"
                  type="checkbox"
                >
              </label>

              <label>
                <span>SIZE</span>
                <input
                  id="setPrimeSize"
                  type="range"
                  min="180"
                  max="320"
                  step="5"
                >
                <b id="setPrimeSizeValue"></b>
              </label>

              <label>
                <span>OPACITY</span>
                <input
                  id="setPrimeOpacity"
                  type="range"
                  min="0.4"
                  max="1"
                  step="0.05"
                >
                <b id="setPrimeOpacityValue"></b>
              </label>

              <button
                id="editPrimeTracker"
                class="settings-action"
                type="button"
              >
                EDIT PRIME POSITION
              </button>

              <button
                id="resetPrimeTracker"
                class="settings-action"
                type="button"
              >
                RESET PRIME TRACKER
              </button>

              <small id="primeTrackerEditStatus">
                Drag the Prime window anywhere on screen.
              </small>

            </article>


            <article class="settings-card">

              <h3>OVERLAY</h3>

              <label>
                <span>HUD OPACITY</span>
                <input
                  id="setHudOpacity"
                  type="range"
                  min="0.4"
                  max="1"
                  step="0.05"
                >
                <b id="setHudOpacityValue"></b>
              </label>

              <label>
                <span>HUD SCALE</span>
                <input
                  id="setHudScale"
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                >
                <b id="setHudScaleValue"></b>
              </label>

              <label>
                <span>SHOW MINI HUD</span>
                <input
                  id="setHudEnabled"
                  type="checkbox"
                >
              </label>

              <button
                id="resetOverlaySettings"
                class="settings-action"
                type="button"
              >
                RESET OVERLAY SETTINGS
              </button>

            </article>

          </div>

        </section>


        <!-- =================================================
             ARKANIS STUDIO
             ================================================= -->

        <section id="page-skins" class="page">

          <div class="page-heading">

            <div>

              <p class="eyebrow">
                ARKANIS · ARKANIS STUDIO
              </p>

              <h2>
                <strong>ARKANIS</strong> STUDIO
              </h2>

              <p>
                SERVER SKIN CUSTOMIZATION
              </p>

            </div>

          </div>


          <div class="skin-studio-frame">

            <webview
              id="arkanisSkinStudio"
              src="https://arkanis.gg/dashboard/1546684286038446110/panels/isle/skin-studio"
              partition="persist:arkanis"
              allowpopups
              webpreferences="contextIsolation=yes,nodeIntegration=no"
            ></webview>

          </div>

        </section>


        <!-- =================================================
             STORE
             ================================================= -->

        <section id="page-store" class="page">

          <div class="page-heading">

            <div>

              <p class="eyebrow">
                SUBMERSIVE ISLE · STORE
              </p>

              <h2>
                <strong>SERVER</strong> STORE
              </h2>

              <p>
                AVAILABLE SERVER CONTENT AND PURCHASES
              </p>

            </div>

          </div>


          <div class="store-placeholder">

            <div class="store-placeholder-inner">

              <span class="store-placeholder-code">
                STORE // ONLINE
              </span>

              <h3>
                STORE
              </h3>

              <p>
                SERVER STORE CONTENT WILL APPEAR HERE.
              </p>


            </div>

          </div>

        </section>

        `
      );

    }


    /* =====================================================
       EXIT CONFIRMATION
       ===================================================== */

    if (!document.getElementById("overlayExitConfirm")) {

      main.insertAdjacentHTML(
        "beforeend",
        `
          <div id="overlayExitConfirm" class="overlay-exit-confirm" aria-hidden="true">
            <div class="overlay-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="overlayExitTitle">
              <div class="overlay-exit-kicker">SYSTEM ACTION</div>
              <div id="overlayExitTitle" class="overlay-exit-title">ARE YOU SURE?</div>
              <div class="overlay-exit-text">Return to the Submersive Isle launcher?</div>
              <div class="overlay-exit-actions">
                <button id="overlayExitNo" class="overlay-exit-button overlay-exit-no" type="button">NO</button>
                <button id="overlayExitYes" class="overlay-exit-button overlay-exit-yes" type="button">YES</button>
              </div>
            </div>
          </div>
        `
      );

      const exitModal =
        document.getElementById("overlayExitConfirm");

      const noButton =
        document.getElementById("overlayExitNo");

      const yesButton =
        document.getElementById("overlayExitYes");

      const closeExitConfirm = () => {

        exitModal?.classList.remove("is-open");
        exitModal?.setAttribute("aria-hidden", "true");

      };

      noButton?.addEventListener(
        "click",
        closeExitConfirm
      );

      yesButton?.addEventListener(
        "click",
        () => {

          closeExitConfirm();

          if (window.electronAPI?.returnToLauncher) {
            window.electronAPI.returnToLauncher();
          }

        }
      );

      exitModal?.addEventListener(
        "click",
        (event) => {

          if (event.target === exitModal) {
            closeExitConfirm();
          }

        }
      );

    }

    /* =====================================================
       BIND SETTINGS / ARKANIS / STORE BUTTONS
       ===================================================== */

    nav
      .querySelectorAll(
        '[data-page="settings"], [data-page="skins"], [data-page="store"], [data-page="server"], [data-page="exit"]'
      )
      .forEach(
        (button) => {

          if (button.dataset.settingsBound === "1") {
            return;
          }

          button.dataset.settingsBound = "1";

          button.addEventListener(
            "click",
            () => {
              if (button.dataset.page === "exit") {

                const exitModal =
                  document.getElementById("overlayExitConfirm");

                if (exitModal) {

                  exitModal.classList.add("is-open");
                  exitModal.setAttribute("aria-hidden", "false");

                  document
                    .getElementById("overlayExitNo")
                    ?.focus();

                }

                return;

              }

              this.switchPage(
                button.dataset.page
              );

              button.blur();
            }
          );

        }
      );



    /* =====================================================
       SETTINGS
       ===================================================== */

    const defaults = {

      miniEnabled: true,
      miniSize: 350,
      miniOpacity: 0.65,
      miniPing: true,

      hudOpacity: 1,
      hudScale: 1,
      hudEnabled: true,

      miniX: 24,
      miniY: 24,

      primeEnabled: true,
      primeSize: 235,
      primeOpacity: 0.92,
      primeX: 0,
      primeY: 0

    };


    let settings =
      defaults;

    try {

      settings = {
        ...defaults,
        ...JSON.parse(
          localStorage.getItem(
            "submersiveOverlaySettings"
          ) || "{}"
        )
      };

    } catch (_) {}


    this.overlaySettings =
      settings;


    const save =
      () => {

        localStorage.setItem(
          "submersiveOverlaySettings",
          JSON.stringify(
            this.overlaySettings
          )
        );

      };


    const bindRange =
      (
        id,
        key,
        out,
        suffix = ""
      ) => {

        const el =
          document.getElementById(id);

        const output =
          document.getElementById(out);

        if (!el) {
          return;
        }

        el.value =
          this.overlaySettings[key];


        const render =
          () => {

            this.overlaySettings[key] =
              Number(el.value);

            if (output) {

              output.textContent =
                el.value + suffix;

            }

            save();
            this.applyOverlaySettings();

          };


        el.addEventListener(
          "input",
          render
        );

        render();

      };


    const bindCheck =
      (
        id,
        key
      ) => {

        const el =
          document.getElementById(id);

        if (!el) {
          return;
        }

        el.checked =
          Boolean(
            this.overlaySettings[key]
          );


        el.addEventListener(
          "change",
          () => {

            this.overlaySettings[key] =
              el.checked;

            save();
            this.applyOverlaySettings();

          }
        );

      };


    bindCheck(
      "setMiniEnabled",
      "miniEnabled"
    );

     bindRange(
       "setMiniSize",
       "miniSize",
       "setMiniSizeValue",
       " px"
    );

    bindRange(
      "setMiniOpacity",
      "miniOpacity",
      "setMiniOpacityValue"
    );

    bindCheck(
      "setMiniPing",
      "miniPing"
    );

    bindCheck(
      "setPrimeEnabled",
      "primeEnabled"
    );

    bindRange(
      "setPrimeSize",
      "primeSize",
      "setPrimeSizeValue",
      " px"
    );

    bindRange(
      "setPrimeOpacity",
      "primeOpacity",
      "setPrimeOpacityValue"
    );

    bindRange(
      "setHudOpacity",
      "hudOpacity",
      "setHudOpacityValue"
    );

    bindRange(
      "setHudScale",
      "hudScale",
      "setHudScaleValue"
    );

    bindCheck(
      "setHudEnabled",
      "hudEnabled"
    );


    const editPrime =
      document.getElementById(
        "editPrimeTracker"
      );

    if (editPrime) {

      editPrime.onclick =
        () => this.togglePrimeTrackerEditor();

    }


    const resetPrime =
      document.getElementById(
        "resetPrimeTracker"
      );

    if (resetPrime) {

      resetPrime.onclick =
        () => {

          Object.assign(
            this.overlaySettings,
            {
              primeEnabled: true,
              primeSize: 235,
              primeOpacity: 0.92,
              primeX: 0,
              primeY: 0
            }
          );

          save();
          this.refreshSettingsControls();
          this.applyOverlaySettings();

        };

    }


    const edit =
      document.getElementById(
        "editMiniMap"
      );

    if (edit) {

      edit.onclick =
        () => this.toggleMiniMapEditor();

    }


    const reset =
      document.getElementById(
        "resetMiniMap"
      );

    if (reset) {

      reset.onclick =
        () => {

          Object.assign(
            this.overlaySettings,
            {
              miniX: 24,
              miniY: 24,
              miniSize: 350,
              miniOpacity: 0.65,
              miniEnabled: true,
              miniPing: true
            }
          );

          save();
          this.refreshSettingsControls();
          this.applyOverlaySettings();

        };

    }


    const resetOverlay =
      document.getElementById(
        "resetOverlaySettings"
      );

    if (resetOverlay) {

      resetOverlay.onclick =
        () => {

          this.overlaySettings.hudOpacity = 1;
          this.overlaySettings.hudScale = 1;
          this.overlaySettings.hudEnabled = true;

          save();
          this.refreshSettingsControls();
          this.applyOverlaySettings();

        };

    }

    this.applyOverlaySettings();

  },


  refreshSettingsControls() {

    const s =
      this.overlaySettings || {};


    const ids = {

      setMiniEnabled: "miniEnabled",
      setMiniSize: "miniSize",
      setMiniOpacity: "miniOpacity",
      setMiniPing: "miniPing",
      setPrimeEnabled: "primeEnabled",
      setPrimeSize: "primeSize",
      setPrimeOpacity: "primeOpacity",
      setHudOpacity: "hudOpacity",
      setHudScale: "hudScale",
      setHudEnabled: "hudEnabled"

    };


    Object
      .entries(ids)
      .forEach(
        ([id, key]) => {

          const element =
            document.getElementById(id);

          if (!element) {
            return;
          }

          if (element.type === "checkbox") {

            element.checked =
              Boolean(s[key]);

          } else {

            element.value =
              s[key];

          }

        }
      );


    [
      [
        "setMiniSizeValue",
        s.miniSize + " px"
      ],
      [
        "setMiniOpacityValue",
        s.miniOpacity
      ],
      [
        "setPrimeSizeValue",
        s.primeSize + " px"
      ],
      [
        "setPrimeOpacityValue",
        s.primeOpacity
      ],
      [
        "setHudOpacityValue",
        s.hudOpacity
      ],
      [
        "setHudScaleValue",
        s.hudScale
      ]
    ]
      .forEach(
        ([id, value]) => {

          const element =
            document.getElementById(id);

          if (element) {
            element.textContent =
              value;
          }

        }
      );

  },


  applyOverlaySettings() {

    const s =
      this.overlaySettings || {};


    if (this.miniMap) {

      this.miniMap.style.width =
        `${s.miniSize}px`;

      this.miniMap.style.height =
        `${s.miniSize}px`;

      this.miniMap.style.left =
        `${s.miniX}px`;

      this.miniMap.style.top =
        `${s.miniY}px`;

      this.miniMap.style.setProperty(
        "--mini-map-opacity",
        s.miniOpacity
      );


      this.miniMap.style.display =
        s.miniEnabled
          ? ""
          : "none";


    }


    if (this.minimalHud) {

      this.minimalHud.style.opacity =
        s.hudEnabled
          ? s.hudOpacity
          : 0;

      this.minimalHud.style.transform =
        `translateX(-50%) scale(${s.hudScale})`;

    }


    /* =====================================================
       PRIME MINI HUD
       Keep settings changes live and preserve saved position.
       ===================================================== */

    const primeTracker =
      document.getElementById(
        "miniPrimeTracker"
      );

    if (primeTracker) {

      primeTracker.style.width =
        `${s.primeSize}px`;

      primeTracker.style.opacity =
        s.primeOpacity;

      if (s.primeX === 0 && s.primeY === 0) {

        primeTracker.style.left =
          "calc(50% + 365px)";

        primeTracker.style.top =
          "auto";

        primeTracker.style.bottom =
          "20px";

      } else {

        primeTracker.style.left =
          `${s.primeX}px`;

        primeTracker.style.top =
          `${s.primeY}px`;

        primeTracker.style.bottom =
          "auto";

      }

      primeTracker.style.display =
        s.primeEnabled && s.hudEnabled
          ? "block"
          : "none";

    }


    const ping =
      document.getElementById(
        "miniMapCoordinatePing"
      );

    if (ping) {

      ping.style.display =
        s.miniPing
          ? ping.style.display
          : "none";

    }

  },


  selectSkin(name) {

    const valid =
      name === "default"
        ? name
        : "default";


    localStorage.setItem(
      "submersiveOverlaySkin",
      valid
    );


    document
      .querySelectorAll(".skin-card")
      .forEach(
        (card) => {

          card.classList.toggle(
            "active",
            card.dataset.skin === valid
          );

        }
      );


    const status =
      document.getElementById(
        "skinStatus"
      );

    if (status) {

      status.textContent =
        "DEFAULT SKIN ACTIVE · FUTURE SKIN PACKS READY";

    }

  },


  togglePrimeTrackerEditor() {

    const tracker =
      document.getElementById(
        "miniPrimeTracker"
      );

    if (!tracker) {
      return;
    }


    tracker.classList.toggle(
      "mini-prime-editing"
    );


    const editing =
      tracker.classList.contains(
        "mini-prime-editing"
      );


    if (editing) {

      /* Make the Prime window visibly pop above the settings page
         exactly like the Mini Map editor does. */
      tracker.style.visibility =
        "visible";

      tracker.style.display =
        "block";

      tracker.style.zIndex =
        "160";

      tracker.style.pointerEvents =
        "auto";

      if (this.overlaySettings.primeX === 0 && this.overlaySettings.primeY === 0) {
        const rect = tracker.getBoundingClientRect();
        this.overlaySettings.primeX = rect.left;
        this.overlaySettings.primeY = rect.top;
        tracker.style.left = `${rect.left}px`;
        tracker.style.top = `${rect.top}px`;
        tracker.style.bottom = "auto";
      }

    } else {

      tracker.style.zIndex =
        "56";

      tracker.style.pointerEvents =
        "none";

      tracker.style.visibility =
        this.state.overlayOpen
          ? "hidden"
          : "visible";

      localStorage.setItem(
        "submersiveOverlaySettings",
        JSON.stringify(this.overlaySettings)
      );

    }


    const status =
      document.getElementById(
        "primeTrackerEditStatus"
      );

    if (status) {

      status.textContent =
        editing
          ? "DRAG THE PRIME WINDOW · CLICK AGAIN TO SAVE"
          : "Prime tracker position saved locally.";

    }


    if (this._primeTrackerDragBound) {
      return;
    }


    this._primeTrackerDragBound = true;

    let drag = null;


    tracker.addEventListener(
      "pointerdown",
      event => {

        if (
          !tracker.classList.contains(
            "mini-prime-editing"
          )
        ) {
          return;
        }

        drag = {
          x: event.clientX,
          y: event.clientY,
          l: tracker.getBoundingClientRect().left,
          t: tracker.getBoundingClientRect().top
        };

        tracker.setPointerCapture?.(
          event.pointerId
        );

      }
    );


    window.addEventListener(
      "pointermove",
      event => {

        if (!drag) {
          return;
        }

        const width =
          tracker.getBoundingClientRect().width;

        const height =
          tracker.getBoundingClientRect().height;

        const left =
          Math.max(
            0,
            Math.min(
              window.innerWidth - width,
              drag.l + event.clientX - drag.x
            )
          );

        const top =
          Math.max(
            0,
            Math.min(
              window.innerHeight - height,
              drag.t + event.clientY - drag.y
            )
          );

        this.overlaySettings.primeX = left;
        this.overlaySettings.primeY = top;

        tracker.style.left =
          `${left}px`;

        tracker.style.top =
          `${top}px`;

        tracker.style.bottom =
          "auto";

      }
    );


    window.addEventListener(
      "pointerup",
      () => {

        if (!drag) {
          return;
        }

        drag = null;

        localStorage.setItem(
          "submersiveOverlaySettings",
          JSON.stringify(this.overlaySettings)
        );

      }
    );

  },


  toggleMiniMapEditor() {

    if (!this.miniMap) {
      return;
    }


    this.miniMap.classList.toggle(
      "mini-map-editing"
    );


    const editing =
      this.miniMap.classList.contains(
        "mini-map-editing"
      );


    if (editing) {

      this.miniMap.classList.remove(
        "hidden"
      );

      this.miniMap.style.zIndex =
        "150";

    } else {

      this.miniMap.style.zIndex =
        "55";

    }


    const status =
      document.getElementById(
        "miniMapEditStatus"
      );


    if (status) {

      status.textContent =
        editing
          ? "DRAG THE MINI MAP · CLICK AGAIN TO SAVE"
          : "Position saved locally on this PC.";

    }


    if (!editing) {

      localStorage.setItem(
        "submersiveOverlaySettings",
        JSON.stringify(
          this.overlaySettings
        )
      );

      return;

    }


    if (this._miniMapDragBound) {
      return;
    }


    this._miniMapDragBound =
      true;


    let drag =
      null;


    const down =
      (event) => {

        if (
          !this.miniMap.classList.contains(
            "mini-map-editing"
          )
        ) {
          return;
        }


        drag = {

          x: event.clientX,
          y: event.clientY,

          l: this.overlaySettings.miniX,
          t: this.overlaySettings.miniY

        };


        this.miniMap.setPointerCapture?.(
          event.pointerId
        );

      };


    const move =
      (event) => {

        if (!drag) {
          return;
        }


        this.overlaySettings.miniX =
          Math.max(
            0,
            Math.min(
              window.innerWidth -
                this.overlaySettings.miniSize,

              drag.l +
                (
                  event.clientX -
                  drag.x
                )
            )
          );


        this.overlaySettings.miniY =
          Math.max(
            0,
            Math.min(
              window.innerHeight -
                this.overlaySettings.miniSize,

              drag.t +
                (
                  event.clientY -
                  drag.y
                )
            )
          );


        this.applyOverlaySettings();

      };


    const up =
      () => {

        if (drag) {

          drag =
            null;

          localStorage.setItem(
            "submersiveOverlaySettings",
            JSON.stringify(
              this.overlaySettings
            )
          );

        }

      };


    this.miniMap.addEventListener(
      "pointerdown",
      down
    );

    window.addEventListener(
      "pointermove",
      move
    );

    window.addEventListener(
      "pointerup",
      up
    );

  },


  /* =======================================================
     NAVIGATION
     ======================================================= */

  setupNavigation() {

    const buttons =
      document.querySelectorAll(
        ".nav-link, .nav-button"
      );


    buttons.forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const page =
              button.dataset.page;

            this.switchPage(
              page
            );

            button.blur();

          }
        );

      }
    );

  },


  switchPage(pageName) {

    const pages =
      document.querySelectorAll(
        ".page"
      );

    const buttons =
      document.querySelectorAll(
        ".nav-link, .nav-button"
      );


    pages.forEach(
      (page) => {

        page.classList.remove(
          "active"
        );

      }
    );


    buttons.forEach(
      (button) => {

        button.classList.remove(
          "active"
        );

      }
    );


    const selectedPage =
      document.getElementById(
        `page-${pageName}`
      );


    const selectedButton =
      document.querySelector(
        `.nav-link[data-page="${pageName}"], .nav-button[data-page="${pageName}"]`
      );


    if (selectedPage) {

      selectedPage.classList.add(
        "active"
      );

    }


    if (selectedButton) {

      selectedButton.classList.add(
        "active"
      );

    }


    this.state.currentPage =
      pageName;

  },


  /* =======================================================
     CLOCK
     ======================================================= */

  updateClock() {

    const now =
      new Date();


    const hours =
      String(
        now.getHours()
      ).padStart(
        2,
        "0"
      );


    const minutes =
      String(
        now.getMinutes()
      ).padStart(
        2,
        "0"
      );


    const seconds =
      String(
        now.getSeconds()
      ).padStart(
        2,
        "0"
      );


    const clock =
      document.getElementById(
        "clock"
      );


    if (clock) {

      clock.textContent =
        `${hours}:${minutes}:${seconds}`;

    }


    const timeValue =
      document.getElementById(
        "timeValue"
      );


    if (timeValue) {

      timeValue.textContent =
        `${hours}:${minutes}`;

    }

  },


  /* =======================================================
     LIVE DATA STATUS DISPLAY
     ======================================================= */

  updateLiveDataStatus(
    status,
    message
  ) {

    const statusIds = [

      "liveDataStatus",
      "dataStatus",
      "telemetryStatus",
      "rconStatus",
      "serverDataStatus"

    ];


    statusIds.forEach(
      (id) => {

        const element =
          document.getElementById(id);

        if (!element) {
          return;
        }


        element.textContent =
          message;


        element.dataset.status =
          status;

      }
    );


    const badge =
      document.getElementById(
        "mapDataBadge"
      );


    if (
      badge &&
      status === "live"
    ) {

      const span =
        badge.querySelector(
          "span"
        );


      if (span) {

        span.textContent =
          "LIVE POSITION TRACKING";

      }

    }

  },


  /* =======================================================
     UI UPDATE
     ======================================================= */

  updateUI() {

    this.updateSpecies();

    this.updateGrowth();


    this.updateSurvival(
      "health",
      this.state.health
    );


    this.updateSurvival(
      "stamina",
      this.state.stamina
    );


    this.updateSurvival(
      "hunger",
      this.state.hunger
    );


    this.updateSurvival(
      "thirst",
      this.state.thirst
    );


    this.updateEnvironment();

    this.updateServer();


    const staminaData =
      document.getElementById(
        "staminaData"
      );


    if (staminaData) {

      staminaData.textContent =
        this.state.stamina == null
          ? "--%"
          : `${Math.round(
              this.state.stamina
            )}%`;

    }


    const growthData =
      document.getElementById(
        "growthData"
      );


    if (growthData) {

      growthData.textContent =
        this.state.growth == null
          ? "--%"
          : `${Number(
              this.state.growth
            ).toFixed(1)}%`;

    }


    this.updateCreatureDataUI();
    this.updateCoordinatesUI();
    this.updateCoordinatePing();
    this.updateProximityRadar();
    this.updateInventoryUI();
    this.updateGarageUI();
    this.updateMutationsUI();
    this.updateGroupUI();
    this.updatePrimeEligibilityUI();
    this.updatePrimeMiniUI();

  },


  /* =======================================================
     REAL PROXIMITY RADAR

     Evrima RCON exposes player locations, but not live AI actor
     locations. The radar renders only verified nearby player contacts.
     ======================================================= */

  updateProximityRadar() {
    const state = this.state.proximity || {};
    const radar = document.querySelector(".radar-map");
    const mapImage = document.getElementById("radarMapImage");
    const contactsLayer = document.getElementById("radarLiveContacts");
    const contactsEl = document.getElementById("radarContacts");
    const rangeEl = document.getElementById("radarRange");
    const stateEl = document.getElementById("radarState");
    if (!radar || !mapImage || !contactsLayer) return;

    contactsLayer.replaceChildren();

    const range = Math.max(25, Number(state.rangeMeters) || 250);
    const contacts = Array.isArray(state.contacts) ? state.contacts : [];
    const coords = this.state._coords;

    // Gateway map calibration used by the full mini-map.
    const MIN_X = -607;
    const MAX_X = 509;
    const MIN_Y = -505;
    const MAX_Y = 607;
    const IMAGE_W = 7800;
    const IMAGE_H = 7817;
    // The radar is a true 250 m radius scan: 500 m diameter fills the viewport.
    // The map spans roughly 1,116 km horizontally, so the image must be scaled
    // by about 2,232x relative to the full-map viewport.
    const MAP_WIDTH_KM = MAX_Y - MIN_Y;
    const MAP_HEIGHT_KM = MAX_X - MIN_X;

    // Keep enough surrounding terrain visible to make the map readable.
    // The actual scan radius remains 250m; the map is a 20km contextual view.
    // Contacts are still plotted from their true world-coordinate offsets.
    const MAP_VIEW_KM = 25;
    const ZOOM_X = MAP_WIDTH_KM / MAP_VIEW_KM;
    const ZOOM_Y = MAP_HEIGHT_KM / MAP_VIEW_KM;

    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
      const centerX = ((coords.x / 1000 - MIN_Y) / MAP_WIDTH_KM) * 100;
      const centerY = ((coords.y / 1000 - MIN_X) / MAP_HEIGHT_KM) * 100;
      mapImage.style.width = `${ZOOM_X * 100}%`;
      mapImage.style.height = `${ZOOM_Y * 100}%`;
      mapImage.style.left = `${50 - centerX * ZOOM_X}%`;
      mapImage.style.top = `${50 - centerY * ZOOM_Y}%`;
      mapImage.style.transform = "none";
      mapImage.style.objectFit = "fill";
    } else {
      mapImage.style.width = "100%";
      mapImage.style.height = "100%";
      mapImage.style.left = "0";
      mapImage.style.top = "0";
      mapImage.style.transform = "none";
    }

    if (contactsEl) contactsEl.textContent = String(contacts.length).padStart(2, "0");
    if (rangeEl) rangeEl.textContent = `${Math.round(range)}M`;
    if (stateEl) {
      stateEl.textContent = state.aiAvailable
        ? "LIVE AI + PLAYERS"
        : contacts.length
          ? "LIVE PLAYERS · AI FEED OFFLINE"
          : coords
            ? "LIVE POSITION · AI FEED OFFLINE"
            : "WAITING FOR POSITION";
    }

    const addContact = (contact, type = "player") => {
      const x = Number(contact.relativeX);
      const y = Number(contact.relativeY);
      const distance = Number(contact.distanceMeters);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(distance) || distance > range) return;

      // World X maps to horizontal map movement; world Y maps to vertical map movement.
      const dxPercent = (x / 1000) / MAP_WIDTH_KM * 100;
      const dyPercent = (y / 1000) / MAP_HEIGHT_KM * 100;
      const left = 50 + dxPercent * ZOOM_X;
      const top = 50 - dyPercent * ZOOM_Y;
      if (left < -8 || left > 108 || top < -8 || top > 108) return;

      const blip = document.createElement("div");
      blip.className = `radar-map-contact ${type === "ai" ? "radar-ai-contact" : "radar-player-contact"}`;
      blip.style.left = `${left}%`;
      blip.style.top = `${top}%`;
      blip.title = `${contact.name || contact.species || type.toUpperCase()} · ${Math.round(distance)}M`;
      contactsLayer.appendChild(blip);
    };

    contacts.forEach(contact => addContact(contact, "player"));
    const aiContacts = Array.isArray(state.aiContacts) ? state.aiContacts : [];
    aiContacts.forEach(contact => addContact(contact, "ai"));

    // Keep the player's location fixed at the center of the zoomed map.
    const center = document.createElement("div");
    center.className = "radar-map-player-ping";
    center.title = "YOUR LOCATION";
    contactsLayer.appendChild(center);
  },

  /* =======================================================
     SPECIES
     ======================================================= */

  updateSpecies() {

    const speciesElements = [

      "speciesName",
      "miniSpecies"

    ];


    speciesElements.forEach(
      (id) => {

        const element =
          document.getElementById(id);


        if (element) {

          element.textContent =
            this.state.species ||
            "--";

        }

      }
    );


    const sex =
      document.getElementById(
        "sex"
      );


    if (sex) {

      sex.textContent =
        this.state.sex ||
        "--";

    }


    const age =
      document.getElementById(
        "age"
      );


    if (age) {

      age.textContent =
        this.state.age ||
        "--";

    }

  },


  /* =======================================================
     GROWTH
     ======================================================= */

  updateGrowth() {

    const rawGrowth =
      Number(
        this.state.growth
      );


    const growth =
      Number.isFinite(
        rawGrowth
      )
        ? Math.max(
            0,
            Math.min(
              100,
              rawGrowth
            )
          )
        : 0;


    const percent =
      growth.toFixed(1);


    const ids = [

      "growthValue",
      "growthPercent",
      "growthProgress",
      "miniGrowth"

    ];


    ids.forEach(
      (id) => {

        const element =
          document.getElementById(id);


        if (!element) {
          return;
        }


        if (
          id ===
          "growthPercent"
        ) {

          element.textContent =
            percent;

        } else {

          element.textContent =
            `${percent}%`;

        }

      }
    );


    // Use the stage reported by live player data when available.
    // Keep the existing growth thresholds only as a fallback for older
    // responses that do not expose a stage field.
    let stage =
      this.state.growthStage ||
      "JUVENILE";

    let next =
      "SUB-ADULT";


    if (!this.state.growthStage) {

      if (
        growth >= 25 &&
        growth < 60
      ) {

        stage =
          "SUB-ADULT";

        next =
          "ADULT";

      }


      if (growth >= 60) {

        stage =
          "ADULT";

        next =
          "FULL MATURITY";

      }

    } else {

      const normalizedStage =
        String(stage).toUpperCase();

      if (/SUB.?ADULT/.test(normalizedStage)) {
        next = "ADULT";
      } else if (/ADULT|MATURE/.test(normalizedStage)) {
        next = "FULL MATURITY";
      } else {
        next = "SUB-ADULT";
      }

    }


    const stageElement =
      document.getElementById(
        "growthStage"
      );


    const nextElement =
      document.getElementById(
        "nextStage"
      );


    if (stageElement) {

      stageElement.textContent =
        stage;

    }


    if (nextElement) {

      nextElement.textContent =
        next;

    }


    const circle =
      document.getElementById(
        "growthCircle"
      );


    if (circle) {

      const circumference =
        490;


      circle.style.strokeDashoffset =
        circumference -
        (
          circumference *
          growth /
          100
        );

    }

  },


  /* =======================================================
     SURVIVAL
     ======================================================= */

  updateSurvival(
    type,
    value
  ) {

    const numericValue =
      Number(
        value
      );


    const amount =
      Number.isFinite(
        numericValue
      )
        ? Math.max(
            0,
            Math.min(
              100,
              numericValue
            )
          )
        : 0;


    const valueElement =
      document.getElementById(
        `${type}Value`
      );


    if (valueElement) {

      valueElement.textContent =
        value == null
          ? "--%"
          : `${Math.round(
              amount
            )}%`;

    }


    const bar =
      document.getElementById(
        `${type}Bar`
      );


    if (bar) {

      bar.style.width =
        `${amount}%`;

    }


    const detailValue =
      document.getElementById(
        `detail${this.capitalize(type)}`
      );


    if (detailValue) {

      detailValue.textContent =
        value == null
          ? "--%"
          : `${Math.round(
              amount
            )}%`;

    }


    const detailBar =
      document.getElementById(
        `detail${this.capitalize(type)}Bar`
      );


    if (detailBar) {

      detailBar.style.width =
        `${amount}%`;

    }


    const miniBar =
      document.getElementById(
        `mini${this.capitalize(type)}`
      );


    if (miniBar) {

      miniBar.style.width =
        `${amount}%`;

    }


    const miniText =
      document.getElementById(
        `mini${this.capitalize(type)}Text`
      );


    if (miniText) {

      miniText.textContent =
        value == null
          ? "--%"
          : `${Math.round(
              amount
            )}%`;

    }

  },


  /* =======================================================
     ENVIRONMENT
     ======================================================= */

  updateEnvironment() {

    const location =
      document.getElementById(
        "location"
      );


    const miniLocation =
      document.getElementById(
        "miniLocation"
      );


    if (location) {

      location.textContent =
        this.state.location ||
        "--";

    }


    if (miniLocation) {

      miniLocation.textContent =
        this.state.location ||
        "--";

    }


    const temperature =
      document.getElementById(
        "temperature"
      );


    if (temperature) {

      temperature.textContent =
        this.state.temperature === null
          ? "-- °C"
          : `${this.state.temperature} °C`;

    }


    const weather =
      document.getElementById(
        "weatherValue"
      );


    if (weather) {

      weather.textContent =
        this.state.weather ||
        "--";

    }


    const gameTime =
      document.getElementById(
        "gameTime"
      );


    if (
      gameTime &&
      this.state.time != null
    ) {

      gameTime.textContent =
        String(
          this.state.time
        );

    }


    /* =====================================================
       STATUS EFFECTS
       ===================================================== */

    this.updateStatusEffects();

  },


  /* =======================================================
     STATUS EFFECT NORMALIZER
     ======================================================= */

  normalizeStatusEffect(value) {

    if (value == null) {
      return null;
    }

    let raw = "";

    if (typeof value === "string") {
      raw = value;
    } else if (typeof value === "object") {
      raw =
        value.name ??
        value.Name ??
        value.label ??
        value.Label ??
        value.effect ??
        value.Effect ??
        value.status ??
        value.Status ??
        value.type ??
        value.Type ??
        value.statusName ??
        value.StatusName ??
        "";
    }

    raw =
      String(raw)
        .trim()
        .toUpperCase();

    if (!raw) {
      return null;
    }

    const key =
      raw
        .replace(/[\s-]+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");

    const aliases = {
      BLEED: "BLEEDING",
      BLEEDING: "BLEEDING",
      LACERATION: "LACERATIONS",
      LACERATIONS: "LACERATIONS",
      BLEEDING_FROM_LACERATION: "BLEEDING",

      FRACTURE: "FRACTURED",
      FRACTURED: "FRACTURED",
      BROKEN_BONE: "FRACTURED",
      BROKEN_BONES: "FRACTURED",

      DEHYDRATED: "DEHYDRATION",
      DEHYDRATION: "DEHYDRATION",

      STARVING: "STARVATION",
      STARVATION: "STARVATION",

      EXHAUSTED: "EXHAUSTION",
      EXHAUSTION: "EXHAUSTION",

      POISON: "POISONED",
      POISONED: "POISONED",

      VENOM: "VENOMED",
      VENOMED: "VENOMED"
    };

    return (
      aliases[key] ||
      raw.replace(/_/g, " ")
    );

  },


  /* =======================================================
     VISUAL GAME STATUS
     ======================================================= */

  applyVisualStatusScan(scan) {

    this.state._visualStatusEffects = {
      bleeding: Boolean(scan?.bleeding),
      fractured: Boolean(scan?.fractured)
    };

    this.updateStatusEffects();

  },


  /* =======================================================
     STATUS EFFECT UI
     ======================================================= */

  updateStatusEffects() {

    const container =
      document.getElementById(
        "statusEffects"
      );

    const state =
      document.getElementById(
        "statusEffectsState"
      );

    if (!container) {
      return;
    }

    const source =
      Array.isArray(this.state.statusEffects)
        ? [...this.state.statusEffects]
        : [];

    const visual =
      this.state._visualStatusEffects || {};

    if (visual.bleeding) {
      source.push({
        name: "BLEEDING",
        details: { source: "GAME HUD" }
      });
    }

    if (visual.fractured) {
      source.push({
        name: "FRACTURED",
        details: { source: "GAME STATUS REPORT" }
      });
    }

    /*
     * Keep a complete readable catalog. Any new effect returned by
     * the server is appended automatically so we never hide an effect
     * just because it was not in the built-in list.
     */
    const catalog = [
      "BLEEDING",
      "LACERATIONS",
      "FRACTURED",
      "DEHYDRATION",
      "STARVATION",
      "EXHAUSTION",
      "POISONED",
      "VENOMED",
      "WOUNDED",
      "BLINDED",
      "STUNNED",
      "SLOWED",
      "HYPOTHERMIA",
      "HYPERTHERMIA"
    ];

    const active = new Map();

    source.forEach((effect) => {

      const normalized =
        this.normalizeStatusEffect(effect);

      if (!normalized) {
        return;
      }

      if (!active.has(normalized)) {
        active.set(normalized, []);
      }

      active.get(normalized).push(
        typeof effect === "object"
          ? effect
          : { name: normalized }
      );

    });

    active.forEach((_value, name) => {

      if (!catalog.includes(name)) {
        catalog.push(name);
      }

    });

    const activeCount = active.size;

    if (state) {
      state.textContent =
        activeCount
          ? `${activeCount} ACTIVE`
          : "CLEAR";

      state.style.color =
        activeCount
          ? "var(--red)"
          : "var(--green)";
    }

    const now = Date.now();

    /*
     * Capture numeric values when the backend gives us one. This lets
     * the overlay show a measured change rate between live samples
     * without inventing a game value.
     */
    active.forEach((entries, name) => {

      const effect =
        entries[0] || {};

      const details =
        effect.details &&
        typeof effect.details === "object"
          ? effect.details
          : effect;

      const numeric =
        this.extractStatusNumber(
          details,
          [
            "remaining",
            "remainingPercent",
            "percent",
            "percentage",
            "amount",
            "value",
            "progress",
            "duration",
            "remainingDuration",
            "healing",
            "healingRate",
            "healRate",
            "recoveryRate",
            "bleedRate"
          ]
        );

      const previous =
        this.state._statusEffectHistory[name];

      let measuredRate = null;

      if (
        numeric != null &&
        previous &&
        now > previous.time
      ) {

        const minutes =
          (now - previous.time) / 60000;

        if (minutes > 0) {
          measuredRate =
            (numeric - previous.value) /
            minutes;
        }

      }

      if (numeric != null) {
        this.state._statusEffectHistory[name] = {
          value: numeric,
          time: now
        };
      }

      effect._measuredRate = measuredRate;
    });

    /*
     * Drop stale history for effects that are no longer active.
     */
    Object.keys(
      this.state._statusEffectHistory
    ).forEach((name) => {

      if (!active.has(name)) {
        delete this.state._statusEffectHistory[name];
      }

    });

    container.innerHTML =
      catalog.map((name) => {

        const entries =
          active.get(name) || [];

        const isActive =
          entries.length > 0;

        const effect =
          entries[0] || null;

        const details =
          effect?.details &&
          typeof effect.details === "object"
            ? effect.details
            : effect || {};

        const detailText =
          isActive
            ? this.formatStatusEffectDetails(
                name,
                details,
                effect?._measuredRate
              )
            : "";

        return `
          <div class="status-effect-row ${
            isActive
              ? "status-effect-active"
              : "status-effect-inactive"
          }">

            <span class="status-effect-icon">
              ${isActive ? "✓" : "✕"}
            </span>

            <span class="status-effect-name">
              ${this.escapeHtml(name)}
            </span>

            ${
              detailText
                ? `
                  <span class="status-effect-detail">
                    ${this.escapeHtml(detailText)}
                  </span>
                `
                : ""
            }

          </div>
        `;

      }).join("");

  },


  extractStatusNumber(value, names) {

    if (!value || typeof value !== "object") {
      return null;
    }

    for (const name of names) {

      const key =
        Object.keys(value).find(
          existing =>
            existing.toLowerCase() ===
            name.toLowerCase()
        );

      if (!key) {
        continue;
      }

      const raw =
        value[key];

      if (
        raw == null ||
        raw === ""
      ) {
        continue;
      }

      const match =
        String(raw).match(
          /[-+]?\d+(?:\.\d+)?/
        );

      if (match) {

        const number =
          Number(match[0]);

        if (Number.isFinite(number)) {
          return number;
        }

      }

    }

    return null;

  },


  formatStatusEffectDetails(
    name,
    details,
    measuredRate
  ) {

    const preferred =
      [
        ["remaining", "REMAINING"],
        ["remainingPercent", "REMAINING"],
        ["percent", "PROGRESS"],
        ["percentage", "PROGRESS"],
        ["healingRate", "HEAL"],
        ["healRate", "HEAL"],
        ["recoveryRate", "HEAL"],
        ["bleedRate", "RATE"],
        ["duration", "TIME"],
        ["remainingDuration", "TIME"],
        ["severity", "SEVERITY"],
        ["stacks", "STACKS"],
        ["value", "VALUE"]
      ];

    for (const [keyName, label] of preferred) {

      const key =
        Object.keys(details || {}).find(
          existing =>
            existing.toLowerCase() ===
            keyName.toLowerCase()
        );

      if (!key) {
        continue;
      }

      const raw =
        details[key];

      if (raw == null || raw === "") {
        continue;
      }

      return `${label}: ${raw}`;

    }

    if (
      measuredRate != null &&
      Number.isFinite(measuredRate) &&
      Math.abs(measuredRate) >= 0.01
    ) {

      const direction =
        measuredRate < 0
          ? "DECREASING"
          : "INCREASING";

      return `RATE: ${Math.abs(measuredRate).toFixed(2)}/MIN ${direction}`;

    }

    return "ACTIVE";

  },


  /* =======================================================
     SERVER
     ======================================================= */

  updateServer() {

    const connected =
      this.state.serverConnected;


    const connectionText =
      connected
        ? "CONNECTED"
        : "DISCONNECTED";


    const connection =
      document.getElementById(
        "serverConnection"
      );


    if (connection) {

      connection.textContent =
        connectionText;

    }


    const bigStatus =
      document.getElementById(
        "serverStatusBig"
      );


    if (bigStatus) {

      bigStatus.textContent =
        connectionText;

    }


    const serverName =
      document.getElementById(
        "serverName"
      );


    if (serverName) {

      serverName.textContent =
        this.state.serverName ||
        "--";

    }


    const players =
      document.getElementById(
        "playerCount"
      );


    if (players) {

      players.textContent =
        this.state.players ||
        "--";

    }


    const ping =
      document.getElementById(
        "serverPing"
      );


    if (ping) {

      ping.textContent =
        this.state.ping === null
          ? "-- ms"
          : `${this.state.ping} ms`;

    }


    const tick =
      document.getElementById(
        "serverTick"
      );


    if (tick) {

      tick.textContent =
        this.state.tick === null
          ? "-- Hz"
          : `${this.state.tick} Hz`;

    }

  },


  /* =======================================================
     EVENT LOG
     ======================================================= */

  addEvent(message) {

    const log =
      document.getElementById(
        "eventLog"
      );


    if (!log) {
      return;
    }


    const now =
      new Date();


    const time =
      `${String(
        now.getHours()
      ).padStart(2, "0")}:` +
      `${String(
        now.getMinutes()
      ).padStart(2, "0")}`;


    const event =
      document.createElement(
        "div"
      );


    event.className =
      "event";


    event.innerHTML = `
      <span class="event-time">${time}</span>
      <span class="event-indicator"></span>
      <span class="event-text"></span>
    `;


    event.querySelector(
      ".event-text"
    ).textContent =
      message;


    log.prepend(
      event
    );


    while (
      log.children.length > 7
    ) {

      log.removeChild(
        log.lastChild
      );

    }

  },


  /* =======================================================
     DEMO TELEMETRY
     ======================================================= */

  startDemoTelemetry() {

    console.warn(
      "[DEMO] Demo telemetry is disabled."
    );

  },


  /* =======================================================
     STOP LIVE TELEMETRY
     ======================================================= */

  stopLiveTelemetry() {

    this._rconTelemetryRunning =
      false;

    this._rconTelemetryPolling =
      false;

    this._rconTelemetryRequestId++;


    if (
      this._rconTelemetryTimer
    ) {

      clearTimeout(
        this._rconTelemetryTimer
      );

      this._rconTelemetryTimer =
        null;

    }


    console.log(
      "[LIVE] Telemetry stopped."
    );

  },


  /* =======================================================
     START LIVE EVRIMA RCON TELEMETRY
     ======================================================= */

  startLiveTelemetry() {

    if (
      !window.electronAPI ||
      typeof window.electronAPI.getLivePlayerData !==
        "function"
    ) {

      console.error(
        "[LIVE] getLivePlayerData bridge is missing."
      );


      this.state.serverConnected =
        false;

      this.state.rconMessage =
        "RCON BRIDGE MISSING";


      this.updateLiveDataStatus(
        "error",
        "RCON BRIDGE MISSING"
      );


      this.updateUI();

      return;

    }


    if (
      this._rconTelemetryRunning
    ) {

      console.log(
        "[LIVE] Telemetry already running."
      );

      return;

    }


    this._rconTelemetryRunning =
      true;

    this._rconTelemetryPolling =
      false;


    const telemetrySession =
      ++this._rconTelemetryRequestId;


    console.log(
      "[LIVE] Telemetry started."
    );


    const poll =
      async () => {

        if (
          !this._rconTelemetryRunning ||
          telemetrySession !==
            this._rconTelemetryRequestId
        ) {

          return;

        }


        if (
          this._rconTelemetryPolling
        ) {

          return;

        }


        this._rconTelemetryPolling =
          true;


        let linkedSteamId =
          "";


        try {

          linkedSteamId =
            String(
              this.state.playerId ||
              localStorage.getItem(
                "submersiveSteamId"
              ) ||
              ""
            ).trim();


          if (!linkedSteamId) {

            this.state.serverConnected =
              false;

            this.state.rconConfigured =
              false;

            this.state.rconMessage =
              "NO LINKED STEAM ID";


            this.updateLiveDataStatus(
              "waiting",
              "WAITING FOR LINKED STEAM ID"
            );


            this.updateUI();

            return;

          }


          this.state.playerId =
            linkedSteamId;


          console.log(
            "[LIVE] Requesting player data:",
            linkedSteamId
          );


          const livePlayer =
            await window.electronAPI.getLivePlayerData(
              linkedSteamId
            );


          if (
            !this._rconTelemetryRunning ||
            telemetrySession !==
              this._rconTelemetryRequestId
          ) {

            return;

          }


          if (livePlayer) {

            this.applyRconSnapshot(
              livePlayer
            );

            // IMPORTANT: Do not block the live RCON/API loop on the
            // Electron desktop-capture HUD scanner. The scanner can be
            // CPU-heavy and must never hold up player telemetry.
            if (
              window.electronAPI &&
              typeof window.electronAPI.getVisualStatusScan ===
                "function" &&
              this.state.overlayOpen &&
              this.state.currentPage === "status"
            ) {

              window.electronAPI.getVisualStatusScan()
                .then((visualStatus) => {
                  this.applyVisualStatusScan(visualStatus);
                })
                .catch((visualError) => {
                  console.debug(
                    "[STATUS] Visual scan unavailable:",
                    visualError
                  );
                });

            }

          } else {

            this.state.serverConnected =
              false;

            this.state.rconMessage =
              "NO LIVE DATA";


            this.updateLiveDataStatus(
              "waiting",
              "WAITING FOR LIVE DATA"
            );


            this.updateUI();

          }


        } catch (error) {

          console.error(
            "[LIVE] Telemetry error:",
            error
          );


          this.state.serverConnected =
            false;

          this.state.rconMessage =
            error?.message ||
            "RCON LIVE ERROR";


          this.updateLiveDataStatus(
            "error",
            "RCON LIVE ERROR"
          );


          this.updateUI();


        } finally {

          this._rconTelemetryPolling =
            false;


          if (
            this._rconTelemetryRunning &&
            telemetrySession ===
              this._rconTelemetryRequestId
          ) {

            this._rconTelemetryTimer =
              setTimeout(
                poll,
                this.LIVE_TELEMETRY_INTERVAL_MS
              );

          }

        }

      };


    poll();

  },


  /* =======================================================
     APPLY LIVE RCON PLAYER DATA
     ======================================================= */

  applyRconSnapshot(snapshot) {

    if (!snapshot) {

      this.state.serverConnected =
        false;

      this.state.rconMessage =
        "NO LIVE DATA";


      this.updateLiveDataStatus(
        "waiting",
        "WAITING FOR LIVE DATA"
      );


      this.updateUI();

      return;

    }


    /* =====================================================
       RCON CONNECTION
       ===================================================== */

    this.state.rconConfigured =
      Boolean(
        snapshot.configured
      );


    this.state.serverConnected =
      Boolean(
        snapshot.connected
      );


    this.state.rconMessage =
      snapshot.message ||
      (
        snapshot.connected
          ? "LIVE"
          : "DISCONNECTED"
      );


    /* =====================================================
       LIVE DATA STATUS
       ===================================================== */

    if (
      snapshot.connected
    ) {

      if (
        snapshot.player
      ) {

        this.updateLiveDataStatus(
          "live",
          "UP TO DATE WITH DATA"
        );

      } else {

        this.updateLiveDataStatus(
          "waiting",
          "SERVER CONNECTED · PLAYER NOT FOUND"
        );

      }

    } else {

      this.updateLiveDataStatus(
        "error",
        snapshot.message ||
        "DISCONNECTED"
      );

    }


    /* =====================================================
       SERVER INFORMATION
       ===================================================== */

    if (
      snapshot.latency != null
    ) {

      this.state.ping =
        snapshot.latency;

    }


    if (snapshot.server) {

      if (
        snapshot.server.tick != null
      ) {

        this.state.tick =
          snapshot.server.tick;

      }


      if (
        snapshot.server.name
      ) {

        this.state.serverName =
          String(
            snapshot.server.name
          ).toUpperCase();

      }


      if (
        snapshot.server.currentPlayers != null
      ) {

        this.state.players =
          `${snapshot.server.currentPlayers} / ${
            snapshot.server.maxPlayers ?? "--"
          }`;

      }

    }


    /* =====================================================
       LIVE ENVIRONMENT DATA
       ===================================================== */

    const environment =
      snapshot.player?.environment ||
      snapshot.server?.environment ||
      null;

    if (environment) {
      if (environment.temperature != null && Number.isFinite(Number(environment.temperature))) {
        this.state.temperature = Number(environment.temperature);
      }
      if (environment.weather != null && String(environment.weather).trim()) {
        this.state.weather = String(environment.weather).trim().toUpperCase();
      }
      if (environment.time != null && String(environment.time).trim()) {
        this.state.time = String(environment.time).trim();
      }
    }


    /* =====================================================
       PROXIMITY DATA
       ===================================================== */

    if (snapshot.proximity) {
      this.state.proximity = {
        contacts: Array.isArray(snapshot.proximity.contacts)
          ? snapshot.proximity.contacts
          : [],
        rangeMeters: Number(snapshot.proximity.rangeMeters) || 250,
        source: snapshot.proximity.source || "RCON PLAYER DATA",
        aiAvailable: Boolean(snapshot.proximity.aiAvailable),
        aiMessage: snapshot.proximity.aiMessage ||
          "AI actor locations are not exposed by Evrima RCON",
        aiContacts: Array.isArray(snapshot.proximity.aiContacts)
          ? snapshot.proximity.aiContacts
          : []
      };
    }


    /* =====================================================
       EXACT STEAM-ID PLAYER
       ===================================================== */

    const p =
      snapshot.player;


    if (!p) {

      this.state.rconMessage =
        snapshot.message ||
        "PLAYER NOT FOUND";


      this.updateUI();

      return;

    }


    /* =====================================================
       DETECT CURRENT SPECIES
       ===================================================== */

    const incomingSpecies =
      p.class != null
        ? String(p.class)
            .toUpperCase()
            .replace(/^BP[_\s-]*/, "")
            .replace(/[_\s-]*C$/, "")
            .replace(/^CHARACTER[_\s-]*/, "")
        : null;


    /*
     * If the active dino changes, clear all
     * species-specific data first so the
     * previous dino cannot remain displayed.
     */

    if (
      incomingSpecies &&
      incomingSpecies !== this.state.species
    ) {

      console.log(
        "[LIVE] Active creature changed:",
        this.state.species,
        "->",
        incomingSpecies
      );


      this.state.weight =
        null;

      this.state.speed =
        null;

      this.state.biteForce =
        null;

      this.state.preferredFood =
        null;

      this.state.diet =
        null;

      this.state.dietValues = {
        protein: null,
        carbohydrates: null,
        lipids: null
      };

      this.resetPrimeTracker(incomingSpecies);

      this.state.statusEffects =
        [];

      this.state._visualStatusEffects = {
        bleeding: false,
        fractured: false
      };

      this.state.growthStage =
        null;

      this.state.growthRate =
        null;

      this.state.growthEta =
        null;

    }


    /* =====================================================
       PLAYER ID
       ===================================================== */

    if (p.playerId) {

      this.state.playerId =
        String(
          p.playerId
        );

    }


    /* =====================================================
       BASIC CREATURE DATA
       ===================================================== */

    if (
      p.name != null
    ) {

      this.state.playerName =
        String(
          p.name
        );

    }


    if (
      incomingSpecies
    ) {

      this.state.species =
        incomingSpecies;

    }


    if (p.diet != null) {

      this.state.diet =
        String(
          p.diet
        ).toUpperCase();

    }


    if (p.dietValues && typeof p.dietValues === "object") {

      this.state.dietValues = {
        protein: Number.isFinite(Number(p.dietValues.protein)) ? Number(p.dietValues.protein) : null,
        carbohydrates: Number.isFinite(Number(p.dietValues.carbohydrates)) ? Number(p.dietValues.carbohydrates) : null,
        lipids: Number.isFinite(Number(p.dietValues.lipids)) ? Number(p.dietValues.lipids) : null
      };

      // Backend may explicitly report Perfect Diet even when the three
      // individual meter values are not exposed by this RCON build.
      if (p.dietValues.perfect === true) {
        this.state.diet = "PERFECT DIET";
      }

    }


    if (
      p.gender != null
    ) {

      this.state.sex =
        String(
          p.gender
        ).toUpperCase();

    }


    if (
      p.age != null
    ) {

      this.state.age =
        String(
          p.age
        );

    }


    /* =====================================================
       REAL LIFE STAGE
       ===================================================== */

    if (
      p.growthStage != null &&
      String(p.growthStage).trim()
    ) {

      this.state.growthStage =
        String(p.growthStage)
          .trim()
          .toUpperCase()
          .replace(/[_-]+/g, " ");

    }


    /* =====================================================
       LIVE PERCENT NORMALIZER
       ===================================================== */

    const livePercent =
      (value) => {

        if (
          value == null ||
          value === ""
        ) {

          return null;

        }


        const n =
          Number(
            value
          );


        if (
          !Number.isFinite(n)
        ) {

          return null;

        }


        if (
          n >= 0 &&
          n <= 1
        ) {

          return Math.max(
            0,
            Math.min(
              100,
              n * 100
            )
          );

        }


        return Math.max(
          0,
          Math.min(
            100,
            n
          )
        );

      };


    /* =====================================================
       CORE SURVIVAL DATA
       ===================================================== */

    const growth =
      livePercent(
        p.growth
      );


    if (
      growth != null
    ) {

      this.state.growth =
        growth;

    }


    const health =
      livePercent(
        p.health
      );


    if (
      health != null
    ) {

      this.state.health =
        health;

    }


    const stamina =
      livePercent(
        p.stamina
      );


    if (
      stamina != null
    ) {

      this.state.stamina =
        stamina;

    }


    const hunger =
      livePercent(
        p.hunger
      );


    if (
      hunger != null
    ) {

      this.state.hunger =
        hunger;

    }


    const thirst =
      livePercent(
        p.thirst
      );


    if (
      thirst != null
    ) {

      this.state.thirst =
        thirst;

    }


    /* =====================================================
       EXTENDED CREATURE DATA
       ===================================================== */

    if (
      p.weight != null
    ) {

      this.state.weight =
        p.weight;

    }


    /*
     * LIVE MAX SPEED
     */

    if (
      p.maxSpeed != null
    ) {

      const speed =
        Number(
          p.maxSpeed
        );


      if (
        Number.isFinite(speed)
      ) {

        this.state.speed =
          speed;

      }

    }


    if (
      p.biteForce != null
    ) {

      const biteForce =
        Number(
          p.biteForce
        );


      if (
        Number.isFinite(biteForce)
      ) {

        this.state.biteForce =
          biteForce;

      }

    }


    if (
      p.preferredFood != null
    ) {

      this.state.preferredFood =
        p.preferredFood;

    }


    if (
      p.growthRate != null
    ) {

      this.state.growthRate =
        p.growthRate;

    }


    if (
      p.growthEta != null
    ) {

      this.state.growthEta =
        p.growthEta;

    }


    /*
     * Status effects are supplied by the backend
     * when available.
     */

    if (
      Array.isArray(
        p.statusEffects
      )
    ) {

      this.state.statusEffects =
        p.statusEffects;

    } else {

      this.state.statusEffects =
        [];

    }


    /* =====================================================
       GROUP DATA
       ===================================================== */

    if (p.group) {
      this.state.group = {
        id: p.group.id ?? null,
        name: p.group.name ?? null,
        members: Array.isArray(p.group.members) ? p.group.members : [],
        pairedWith: p.group.pairedWith ?? null,
        spawnCode: p.group.spawnCode ?? null,
        inviteCode: p.group.inviteCode ?? null,
        status: p.group.status || "NOT EXPOSED BY RCON"
      };
    }


    /* =====================================================
       LIVE POSITION
       ===================================================== */

    if (
      p.location
    ) {

      const x =
        Number(
          p.location.x
        );


      const y =
        Number(
          p.location.y
        );


      const z =
        Number(
          p.location.z
        );


      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z)
      ) {

        this.state._coords = {
          x,
          y,
          z
        };


        this.state.location =
          `${x.toFixed(0)} / ${
            y.toFixed(0)
          } / ${
            z.toFixed(0)
          }`;

      }

    }


    /* =====================================================
       MUTATIONS
       ===================================================== */

    this.state.mutations =
      Array.isArray(
        p.mutations
      )
        ? p.mutations
        : [];


    this.state.parentMutations =
      Array.isArray(
        p.parentMutations
      )
        ? p.parentMutations
        : [];


    this.state.elderA =
      Array.isArray(
        p.elderA
      )
        ? p.elderA
        : [];


    this.state.elderB =
      Array.isArray(
        p.elderB
      )
        ? p.elderB
        : [];


    this.state.primeElder =
      Boolean(
        p.primeElder
      );

    this.state.primeConditions = [];

    this.updatePrimeTracker(p);


    /* =====================================================
       UPDATE EVERYTHING
       ===================================================== */

    this.updateUI();

    this.updateMutationsUI();

    this.updateCoordinatesUI();

    this.updatePrimeEligibilityUI();

    this.updateCoordinatePing();

  },


  /* =======================================================
     LIVE MINI-MAP PLAYER TRACKING
     ======================================================= */

  updateCoordinatePing() {

    if (
      this.overlaySettings &&
      this.overlaySettings.miniPing === false
    ) {
      const disabledPing =
        document.getElementById(
          "miniMapCoordinatePing"
        );

      if (disabledPing) {
        disabledPing.style.display = "none";
      }

      return;
    }


    const ping =
      document.getElementById(
        "miniMapCoordinatePing"
      );

    if (!ping) {
      return;
    }


    const coords =
      this.state._coords;

    if (
      !coords ||
      !Number.isFinite(Number(coords.x)) ||
      !Number.isFinite(Number(coords.y))
    ) {
      ping.style.display = "none";
      return;
    }


    const mapImage =
      this.miniMap?.querySelector("img");

    if (!mapImage) {
      ping.style.display = "none";
      return;
    }


    /*
      USE THE SAME GATEWAY CALIBRATION
      AS THE WORKING AI PROXIMITY SCAN.
    */

    const MIN_X = -607;
    const MAX_X = 509;

    const MIN_Y = -505;
    const MAX_Y = 607;


    const MAP_WIDTH_KM =
      MAX_Y - MIN_Y;

    const MAP_HEIGHT_KM =
      MAX_X - MIN_X;


    /*
      Same coordinate conversion as AI scan.
    */

    const centerX =
      (
        (
          Number(coords.x) / 1000 -
          MIN_Y
        ) /
        MAP_WIDTH_KM
      ) * 100;


    const centerY =
      (
        (
          Number(coords.y) / 1000 -
          MIN_X
        ) /
        MAP_HEIGHT_KM
      ) * 100;


    /*
      Player ping stays in the center.
      The map moves underneath it.
    */

    ping.style.left =
      "50%";

    ping.style.top =
      "50%";

    ping.style.display =
      "block";


    /*
      Keep the existing mini-map zoom.
    */

    const fixedZoom =
      5;


    const offsetX =
      50 -
      (
        centerX *
        fixedZoom
      );


    const offsetY =
      50 -
      (
        centerY *
        fixedZoom
      );


    mapImage.style.width =
      `${fixedZoom * 100}%`;

    mapImage.style.height =
      `${fixedZoom * 100}%`;

    mapImage.style.left =
      `${offsetX}%`;

    mapImage.style.top =
      `${offsetY}%`;

    mapImage.style.transform =
      "none";

  },

  /* =======================================================
     LIVE COORDINATE UI
     ======================================================= */

  updateCoordinatesUI() {

    const c =
      this.state._coords;


    const ml =
      document.getElementById(
        "mapLat"
      );


    const mn =
      document.getElementById(
        "mapLon"
      );


    const mz =
      document.getElementById(
        "mapZ"
      );


    const badge =
      document.getElementById(
        "mapDataBadge"
      );


    if (
      !c ||
      [
        c.x,
        c.y,
        c.z
      ].some(
        v =>
          typeof v !== "number" ||
          !Number.isFinite(v)
      )
    ) {

      if (badge) {

        const span =
          badge.querySelector(
            "span"
          );


        if (span) {

          span.textContent =
            "MAP VIEW READY · POSITION DATA PENDING";

        }

      }


      return;

    }


    if (ml) {

      ml.textContent =
        Number(
          c.x
        ).toFixed(0);

    }


    if (mn) {

      mn.textContent =
        Number(
          c.y
        ).toFixed(0);

    }


    if (mz) {

      mz.textContent =
        Number(
          c.z
        ).toFixed(0);

    }


    const badgeText =
      document.querySelector(
        "#mapDataBadge span"
      );


    if (badgeText) {

      badgeText.textContent =
        "LIVE POSITION TRACKING";

    }

  },


  /* =======================================================
     CREATURE DATA
     ======================================================= */

  updateCreatureDataUI() {

    const food =
      document.getElementById(
        "preferredFood"
      );

    if (!food) return;

    const value =
      this.state.preferredFood;

    if (!value) {
      food.textContent = "--";
      return;
    }

    if (typeof value === "string") {
      food.textContent = value;
      return;
    }

    const groups =
      Object.entries(value)
        .filter(
          ([, items]) =>
            Array.isArray(items) &&
            items.length
        )
        .map(
          ([group, items]) =>
            `${group}: ${items.join(", ")}`
        );

    food.textContent =
      groups.length
        ? groups.join(" • ")
        : "--";

  },

  /* =======================================================
     GROUP
     ======================================================= */

  updateGroupUI() {
    const group = this.state.group || {};
    const id = document.getElementById("groupId");
    const name = document.getElementById("groupName");
    const status = document.getElementById("groupStatus");
    const paired = document.getElementById("groupPairedWith");
    const spawn = document.getElementById("groupSpawnCode");
    const invite = document.getElementById("groupInviteCode");
    const members = document.getElementById("groupMembers");
    const selfSpecies = document.getElementById("groupSelfSpecies");

    if (id) id.textContent = group.id || "NOT EXPOSED";
    if (name) name.textContent = group.name || "NO GROUP";
    if (status) status.textContent = group.status || "NOT EXPOSED BY RCON";
    if (paired) {
      paired.textContent = group.pairedWith
        ? (typeof group.pairedWith === "object"
            ? (group.pairedWith.name || group.pairedWith.playerName || "PAIRED")
            : String(group.pairedWith))
        : "NONE";
    }
    if (spawn) spawn.textContent = group.spawnCode || "NOT EXPOSED";
    if (invite) invite.textContent = group.inviteCode || "NOT EXPOSED";
    if (selfSpecies) selfSpecies.textContent = this.state.species || "--";

    if (!members) return;

    const list = Array.isArray(group.members) ? group.members : [];
    if (!list.length) {
      members.innerHTML = `
        <div class="group-member group-member-empty">
          <div class="member-icon">--</div>
          <div class="member-info">
            <b>NO GROUP MEMBERS RETURNED</b>
            <span>${group.status === "NOT EXPOSED BY RCON" ? "RCON 0x77 does not expose the in-game group roster on this server build." : "NO OTHER MEMBERS"}</span>
          </div>
        </div>`;
      return;
    }

    members.innerHTML = list.map((member, index) => {
      const name = member.name || member.id || `MEMBER ${index + 1}`;
      const species = member.species || "--";
      const health = member.health == null ? "--" : `${Math.round(Number(member.health) <= 1 ? Number(member.health) * 100 : Number(member.health))}%`;
      return `
        <div class="group-member">
          <div class="member-icon">${String(index + 1).padStart(2, "0")}</div>
          <div class="member-info">
            <b>${this.escapeHtml(name)}</b>
            <span>${this.escapeHtml(species)}</span>
          </div>
          <div class="member-health">
            <span>HEALTH</span>
            <b>${this.escapeHtml(health)}</b>
          </div>
          <div class="member-state">ONLINE</div>
        </div>`;
    }).join("");
  },

  /* =======================================================
     LOCAL PRIME TRACKER
     Tracks this dino's life from live RCON position/diet data.
     ======================================================= */

  resetPrimeTracker(species = this.state.species) {

    const key = `${String(this.state.playerId || "LOCAL").trim()}:${String(species || "UNKNOWN").trim().toUpperCase()}`;

    this.state.primeTracker = {
      lifeKey: key,
      perfectDiet: false,
      sanctuary: false,
      nested: false,
      massMigration: false,
      migrations: [],
      patrols: [],
      noInfertility: true,
      noMuscleSpasms: true,
      raisedChild: false,
      speciesBonus: [
        "HYPSILOPHODON",
        "TROODON",
        "BEIPIAOSAURUS",
        "DRYOSAURUS",
        "DEINOSUCHUS"
      ].includes(String(species || "").trim().toUpperCase()),
      zoneDataLoaded: false,
      zoneDataError: null,
      lastZone: null,
      lastZoneAt: 0
    };

    this.loadPrimeZoneData();
  },


  async loadPrimeZoneData() {

    if (this._primeZoneDataLoading || this._primeZones) return;

    this._primeZoneDataLoading = true;

    const cacheKey = "submersivePrimeGatewayZones_v1";

    try {

      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.migrations && parsed?.patrol_zones) {
          this._primeZones = parsed;
        }
      }

      if (!this._primeZones) {

        const response = await fetch(
          "https://raw.githubusercontent.com/aguirretim/isle-overlay/main/web/pois.json",
          { cache: "no-store" }
        );

        if (!response.ok) throw new Error(`ZONE DATA HTTP ${response.status}`);

        const data = await response.json();
        this._primeZones = {
          migrations: Array.isArray(data.migrations) ? data.migrations : [],
          patrol_zones: Array.isArray(data.patrol_zones) ? data.patrol_zones : []
        };

        localStorage.setItem(cacheKey, JSON.stringify(this._primeZones));
      }

      this.state.primeTracker.zoneDataLoaded = true;
      this.state.primeTracker.zoneDataError = null;

    } catch (error) {

      this.state.primeTracker.zoneDataError = String(error?.message || error);

    } finally {

      this._primeZoneDataLoading = false;

    }
  },


  primePointInZone(x, y, zone) {

    if (!zone || !Number.isFinite(x) || !Number.isFinite(y)) return false;

    if (zone.kind === "circle" && zone.radii) {

      const rx = Math.max(1, Number(zone.radii.rx) * 1000);
      const ry = Math.max(1, Number(zone.radii.ry) * 1000);
      const rotation = (Number(zone.radii.rot) || 0) * Math.PI / 180;
      const dx = x - Number(zone.x);
      const dy = y - Number(zone.y);
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const px = dx * cos + dy * sin;
      const py = -dx * sin + dy * cos;
      return ((px * px) / (rx * rx)) + ((py * py) / (ry * ry)) <= 1;
    }

    const points = Array.isArray(zone.polyline) ? zone.polyline : [];
    if (points.length < 2) return false;

    const first = points[0];
    const last = points[points.length - 1];
    const closed = Math.hypot(Number(first[0]) - Number(last[0]), Number(first[1]) - Number(last[1])) < 1;

    if (closed) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = Number(points[i][0]), yi = Number(points[i][1]);
        const xj = Number(points[j][0]), yj = Number(points[j][1]);
        const hit = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
        if (hit) inside = !inside;
      }
      if (inside) return true;
    }

    // Open zone paths are treated as a narrow entry corridor.
    const tolerance = 3000;
    for (let i = 1; i < points.length; i++) {
      const ax = Number(points[i - 1][0]);
      const ay = Number(points[i - 1][1]);
      const bx = Number(points[i][0]);
      const by = Number(points[i][1]);
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
      const px = ax + t * dx;
      const py = ay + t * dy;
      if (Math.hypot(x - px, y - py) <= tolerance) return true;
    }

    return false;
  },


  updatePrimeTracker(player = null) {

    const species = String(this.state.species || "").trim().toUpperCase();
    if (!species) return;

    const tracker = this.state.primeTracker || {};
    const lifeKey = `${String(this.state.playerId || "LOCAL").trim()}:${species}`;

    if (tracker.lifeKey !== lifeKey) this.resetPrimeTracker(species);

    const t = this.state.primeTracker;

    // Detect a fresh life when growth falls sharply after having already grown.
    const growth = Number(this.state.growth);
    if (Number.isFinite(growth) && Number.isFinite(this._primeLastGrowth)) {
      if (this._primeLastGrowth > 20 && growth < 5) {
        this.resetPrimeTracker(species);
      }
    }
    if (Number.isFinite(growth)) this._primeLastGrowth = growth;

    const mutationNames = [
      ...this.state.mutations,
      ...this.state.parentMutations,
      ...this.state.elderA,
      ...this.state.elderB
    ].map(value => String(typeof value === "object"
      ? (value?.name || value?.Name || value?.mutation || value?.Mutation || "")
      : value).trim().toLowerCase());

    t.noInfertility = !mutationNames.some(name => name === "infertility" || name === "temporarily infertile");
    t.noMuscleSpasms = !mutationNames.some(name => name === "muscle spasms" || name === "musclespasms");
    t.speciesBonus = ["HYPSILOPHODON", "TROODON", "BEIPIAOSAURUS", "DRYOSAURUS", "DEINOSUCHUS"].includes(species);

    const d = this.state.dietValues || {};
    const dietPercent = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return n >= 0 && n <= 1 ? n * 100 : n;
    };

    const protein = dietPercent(d.protein);
    const carbohydrates = dietPercent(d.carbohydrates);
    const lipids = dietPercent(d.lipids);

    // Prime Perfect Diet is earned as soon as all three live diet meters
    // have reached at least 1% at the same time. Once achieved, keep it
    // latched for this dino's current life, just like the other tracker data.
    const explicitPerfectDiet = /perfect\s*diet|diet\s*perfect/i.test(String(this.state.diet || ""));

    if (
      explicitPerfectDiet ||
      (protein != null && protein >= 1 &&
       carbohydrates != null && carbohydrates >= 1 &&
       lipids != null && lipids >= 1)
    ) {
      t.perfectDiet = true;
    }

    if (this._primeZones && this.state._coords) {

      const x = Number(this.state._coords.x);
      const y = Number(this.state._coords.y);
      const migrations = this._primeZones.migrations || [];
      const patrols = this._primeZones.patrol_zones || [];

      const activeMigration = migrations.find(zone => this.primePointInZone(x, y, zone));
      const activePatrol = patrols.find(zone => this.primePointInZone(x, y, zone));

      const zone = activeMigration
        ? { type: activeMigration.name?.includes("MMZ") ? "MMZ" : "MZ", name: activeMigration.name }
        : activePatrol
          ? { type: "PZ", name: activePatrol.name }
          : null;

      if (zone && (t.lastZone !== `${zone.type}:${zone.name}` || Date.now() - t.lastZoneAt > 15000)) {

        t.lastZone = `${zone.type}:${zone.name}`;
        t.lastZoneAt = Date.now();

        if (zone.type === "MMZ") {
          t.massMigration = true;
        } else if (zone.type === "MZ") {
          if (!t.migrations.includes(zone.name)) t.migrations.push(zone.name);
        } else if (zone.type === "PZ") {
          if (!t.patrols.includes(zone.name)) t.patrols.push(zone.name);
        }

      }

    }

    this.state.primeConditionSource = "LOCAL POSITION + DIET + MUTATIONS";
  },


  getPrimeConditionDisplay() {

    const t = this.state.primeTracker || {};

    return [
      Boolean(t.sanctuary),
      Boolean(t.nested),
      Boolean(t.perfectDiet),
      Boolean(t.massMigration),
      Array.isArray(t.migrations) && t.migrations.length >= 2,
      Array.isArray(t.patrols) && t.patrols.length >= 4,
      Boolean(t.noInfertility),
      Boolean(t.noMuscleSpasms),
      Boolean(t.raisedChild),
      Boolean(t.speciesBonus)
    ];
  },


  updatePrimeEligibilityUI() {

    const list = document.getElementById("primeRequirements");
    const stateEl = document.getElementById("primeEligibilityState");
    const countEl = document.getElementById("primeConditionCount");
    const textEl = document.getElementById("primeEligibilityText");
    if (!list || !stateEl || !countEl || !textEl) return;

    const species = String(this.state.species || "").trim().toUpperCase();
    const smallSpecies = new Set(["HYPSILOPHODON", "TROODON", "BEIPIAOSAURUS", "DRYOSAURUS", "DEINOSUCHUS"]);
    const required = smallSpecies.has(species) ? 4 : 5;
    const t = this.state.primeTracker || {};

    const items = [
      ["SANCTUARY AS JUVENILE", t.sanctuary],
      ["NESTED IN", t.nested],
      ["PERFECT DIET", t.perfectDiet],
      ["MASS MIGRATION", t.massMigration],
      [`MIGRATION ZONES ${Math.min(t.migrations?.length || 0, 2)}/2`, (t.migrations?.length || 0) >= 2],
      [`PATROL ZONES ${Math.min(t.patrols?.length || 0, 4)}/4`, (t.patrols?.length || 0) >= 4],
      ["NO INFERTILITY", t.noInfertility],
      ["NO MUSCLE SPASMS", t.noMuscleSpasms],
      ["RAISED CHILD TO SUBADULT", t.raisedChild],
      ["SPECIES PRIME BONUS", t.speciesBonus]
    ];

    const passed = items.filter(([, value]) => value).length;
    countEl.textContent = `${passed} / ${required}`;

    stateEl.textContent = passed >= required ? "PRIME READY" : "TRACKING";
    stateEl.style.color = passed >= required ? "var(--green)" : "var(--cyan-bright)";

    const zoneStatus = t.zoneDataLoaded ? "ZONE DATA LIVE" : "ZONE DATA WAITING";
    textEl.textContent = `${passed}/${required} TRACKED · ${t.migrations?.length || 0}/2 MZ · ${t.patrols?.length || 0}/4 PZ · ${t.perfectDiet ? "PERFECT DIET ✓" : "PERFECT DIET —"} · ${zoneStatus}`;

    list.innerHTML = items.map(([name, value]) => `
      <div class="prime-requirement ${value ? "prime-ok" : "prime-no"}">
        <span class="prime-check">${value ? "✓" : "✕"}</span>
        <span>${name}</span>
      </div>`).join("");
  },


  updatePrimeMiniUI() {

    const count = document.getElementById("miniPrimeCount");
    const list = document.getElementById("miniPrimeRequirements");
    const state = document.getElementById("miniPrimeState");
    if (!count || !list || !state) return;

    const species = String(this.state.species || "").trim().toUpperCase();
    const smallSpecies = new Set(["HYPSILOPHODON", "TROODON", "BEIPIAOSAURUS", "DRYOSAURUS", "DEINOSUCHUS"]);
    const required = smallSpecies.has(species) ? 4 : 5;
    const t = this.state.primeTracker || {};
    const passed = this.getPrimeConditionDisplay().filter(Boolean).length;

    count.textContent = `${passed}/${required}`;
    state.textContent = passed >= required ? "PRIME READY" : "PRIME TRACKER";
    state.className = "mini-prime-state" + (passed >= required ? " is-ready" : "");

    const rows = [
      [`DIET`, t.perfectDiet],
      [`MZ ${Math.min(t.migrations?.length || 0, 2)}/2`, (t.migrations?.length || 0) >= 2],
      [`MMZ`, t.massMigration],
      [`PZ ${Math.min(t.patrols?.length || 0, 4)}/4`, (t.patrols?.length || 0) >= 4],
      [`NO INF`, t.noInfertility],
      [`NO SPASMS`, t.noMuscleSpasms],
      [`SPECIES`, t.speciesBonus]
    ];

    list.innerHTML = rows.map(([name, value]) => `
      <div class="mini-prime-item ${value ? "is-ok" : "is-no"}">
        <i>${value ? "✓" : "✕"}</i><span>${name}</span>
      </div>`).join("");
  },

  /* =======================================================
     MUTATIONS
     ======================================================= */

  updateMutationsUI() {

    const activeList =
      document.getElementById(
        "mutationList"
      );


    const parentList =
      document.getElementById(
        "parentMutationList"
      );


    const elderList =
      document.getElementById(
        "elderMutationList"
      );


    const prime =
      document.getElementById(
        "primeElder"
      );


    const findMutation =
      (name) => {

        const target =
          String(
            name || ""
          )
            .trim()
            .toLowerCase();


        return this.availableMutations.find(
          mutation =>
            String(
              mutation.name
            )
              .trim()
              .toLowerCase() ===
            target
        ) || null;

      };


    const renderMutation =
      (
        mutation,
        category,
        index
      ) => {

        const name =
          typeof mutation === "object"

            ? (
                mutation.name ||
                mutation.label ||
                mutation.mutation ||
                "UNKNOWN MUTATION"
              )

            : String(
                mutation
              );


        const catalog =
          findMutation(
            name
          );


        const extra =
          catalog
            ? "VERIFIED MUTATION"
            : "LIVE DATA";


        return `
          <div class="mutation-live-row mutation-live-card">

            <div class="mutation-card-top">

              <span class="mutation-category">
                ${this.escapeHtml(category)}
              </span>

              <span class="mutation-index">
                M-${String(index + 1).padStart(2, "0")}
              </span>

            </div>

            <div class="mutation-card-name">
              ${this.escapeHtml(String(name))}
            </div>

            <div class="mutation-card-status">

              <span class="mutation-live-dot"></span>

              <span>
                ${this.escapeHtml(extra)}
              </span>

            </div>

          </div>
        `;

      };


    const renderEmpty =
      (message) => {

        return `
          <div class="mutation-empty-state">

            <span class="mutation-empty-icon">
              ◇
            </span>

            <b>
              ${this.escapeHtml(message)}
            </b>

            <span>
              Waiting for verified mutation data.
            </span>

          </div>
        `;

      };


    if (activeList) {

      const mutations =
        Array.isArray(
          this.state.mutations
        )
          ? this.state.mutations
          : [];


      activeList.innerHTML =
        mutations.length

          ? mutations
              .map(
                (
                  mutation,
                  index
                ) =>
                  renderMutation(
                    mutation,
                    "ACTIVE",
                    index
                  )
              )
              .join("")

          : renderEmpty(
              "NO ACTIVE MUTATIONS"
            );

    }


    if (parentList) {

      const mutations =
        Array.isArray(
          this.state.parentMutations
        )
          ? this.state.parentMutations
          : [];


      parentList.innerHTML =
        mutations.length

          ? mutations
              .map(
                (
                  mutation,
                  index
                ) =>
                  renderMutation(
                    mutation,
                    "PARENT",
                    index
                  )
              )
              .join("")

          : renderEmpty(
              "NO PARENT MUTATIONS"
            );

    }


    if (elderList) {

      const mutations = [

        ...(
          Array.isArray(
            this.state.elderA
          )
            ? this.state.elderA
            : []
        ),

        ...(
          Array.isArray(
            this.state.elderB
          )
            ? this.state.elderB
            : []
        )

      ];


      elderList.innerHTML =
        mutations.length

          ? mutations
              .map(
                (
                  mutation,
                  index
                ) =>
                  renderMutation(
                    mutation,
                    "ELDER",
                    index
                  )
              )
              .join("")

          : renderEmpty(
              "NO ELDER MUTATIONS"
            );

    }


    if (prime) {

      prime.textContent =
        this.state.primeElder
          ? "PRIME ELDER"
          : "STANDARD LIFECYCLE";

    }

  },


  /* =======================================================
     HTML ESCAPE
     ======================================================= */

  escapeHtml(value) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      c =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#039;"
        })[c]
    );

  },


  /* =======================================================
     INVENTORY + GARAGE
     ======================================================= */

  setupInventoryGarage() {

    this.state.garage =
      [];


    document
      .getElementById(
        "refreshInventory"
      )
      ?.addEventListener(
        "click",
        () =>
          this.refreshExternalData()
      );


    document
      .getElementById(
        "mapZoomIn"
      )
      ?.addEventListener(
        "click",
        () =>
          this.setMapZoom?.(1.15)
      );


    document
      .getElementById(
        "mapZoomOut"
      )
      ?.addEventListener(
        "click",
        () =>
          this.setMapZoom?.(
            1 / 1.15
          )
      );


    document
      .getElementById(
        "mapReset"
      )
      ?.addEventListener(
        "click",
        () =>
          this.resetMapZoom?.()
      );


    this.state.garageBackendConnected =
      false;


    this.state.garageBackendMessage =
      "GARAGE BACKEND NOT CONNECTED";


    this.updateInventoryUI();

    this.updateGarageUI();

  },


  refreshExternalData() {

    if (
      window.SubmersiveIsleDataBridge
        ?.requestRefresh
    ) {

      window.SubmersiveIsleDataBridge
        .requestRefresh();

    }


    this.addEvent(
      "DATA REFRESH REQUEST SENT"
    );

  },


  normalizeInventory(items) {

    if (
      !Array.isArray(items)
    ) {

      return [];

    }


    return items

      .map(
        (
          item,
          index
        ) => {

          if (
            typeof item ===
            "string"
          ) {

            return {

              id:
                `item-${index}`,

              name:
                item,

              quantity:
                1,

              category:
                "ITEM"

            };

          }


          return {

            id:
              item.id ||
              `item-${index}`,

            name:
              item.name ||
              item.label ||
              "UNKNOWN ITEM",

            quantity:
              Number(
                item.quantity ??
                item.count ??
                1
              ),

            category:
              item.category ||
              "ITEM"

          };

        }
      )

      .filter(
        item =>
          item.name
      );

  },


  updateInventoryUI() {

    const list =
      document.getElementById(
        "inventoryList"
      );


    const count =
      document.getElementById(
        "inventoryCount"
      );


    if (!list) {
      return;
    }


    const items =
      this.normalizeInventory(
        this.state.inventory
      );


    if (count) {

      count.textContent =
        `${items.length} ITEM${
          items.length === 1
            ? ""
            : "S"
        }`;

    }


    if (!items.length) {

      list.innerHTML =
        '<div class="empty-state"><div class="empty-icon">▱</div><b>INVENTORY EMPTY</b><span>No verified item data has been received yet.</span></div>';

    } else {

      list.innerHTML =
        items
          .map(
            item =>
              `<div class="inventory-row"><div class="inventory-icon">${this.escapeHtml(String(item.category).slice(0, 2))}</div><div class="inventory-info"><b>${this.escapeHtml(String(item.name))}</b><span>${this.escapeHtml(String(item.category))}</span></div><strong>x${Number.isFinite(item.quantity) ? item.quantity : 1}</strong></div>`
          )
          .join("");

    }


    const status =
      document.getElementById(
        "inventoryDataStatus"
      );


    if (status) {

      const span =
        status.querySelector(
          "span"
        );


      if (span) {

        span.textContent =
          items.length
            ? "LIVE DATA RECEIVED"
            : "WAITING FOR DATA";

      }

    }


    const source =
      document.getElementById(
        "inventorySourceDetail"
      );


    if (source) {

      source.textContent =
        items.length
          ? "EXTERNAL DATA RECEIVED"
          : "PLACEHOLDER READY";

    }

  },


  /* =======================================================
     GARAGE
     ======================================================= */

  updateGarageUI() {

    const status =
      document.getElementById(
        "garageDataStatus"
      );


    if (status) {

      const span =
        status.querySelector(
          "span"
        );


      if (span) {

        span.textContent =
          this.state.garageBackendConnected
            ? "LIVE DATA"
            : "GARAGE BACKEND NOT CONNECTED";

      }

    }


    const list =
      document.getElementById(
        "garageList"
      );


    if (
      list &&
      !this.state.garage.length
    ) {

      list.innerHTML =
        '<div class="empty-state"><div class="empty-icon">◇</div><b>GARAGE NOT CONNECTED</b><span>Garage storage is currently offline.</span></div>';

    }

  },


  storeCurrentDino() {

    this.addEvent(
      "GARAGE: BACKEND NOT CONNECTED"
    );

  },


  refreshGarageFromBackend() {

    this.state.garage =
      [];


    this.state.garageBackendConnected =
      false;


    this.state.garageBackendMessage =
      "GARAGE BACKEND NOT CONNECTED";


    this.updateGarageUI();

  },


  selectGarage(id) {

    this.state.selectedGarageId =
      id;


    this.updateGarageUI();

  },


  removeGarage(id) {

    this.addEvent(
      "GARAGE: BACKEND NOT CONNECTED"
    );

  },


  /* =======================================================
     UTILITY
     ======================================================= */

  capitalize(value) {

    const text =
      String(
        value ?? ""
      );


    if (!text) {
      return "";
    }


    return (
      text.charAt(0).toUpperCase() +
      text.slice(1)
    );

  }

};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    SubmersiveIsle.init();

  }
);


/* =========================================================
   GLOBAL GAME BRIDGE
   ========================================================= */

window.SubmersiveIsle =
  SubmersiveIsle;


/* =========================================================
   FUTURE DISCORD / GAME DATA BRIDGE
   ========================================================= */

window.SubmersiveIsleDataBridge = {

  apply(payload) {

    if (
      window.SubmersiveIsle &&
      typeof window.SubmersiveIsle.setGameData ===
        "function"
    ) {

      window.SubmersiveIsle.setGameData(
        payload || {}
      );

    }

  },


  requestRefresh() {

    window.dispatchEvent(
      new CustomEvent(
        "submersive-data-refresh"
      )
    );

  }

};
