const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  shell,
  desktopCapturer
} = require("electron");

const path = require("path");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const { execFile } = require("child_process");

const {
  getLivePlayerData,
  loadConfig,
  setAuth,
  getAuthState,
  checkBackendHealth
} = require("./api-client");



// ============================================================
// RCON - LIVE PLAYER DATA
// ============================================================

ipcMain.handle(
  "rcon-live-player",
  async function (_e, steamId) {
    return getLivePlayerData(
      steamId || null
    );
  }
);


ipcMain.handle("backend-health", async function () {
  return checkBackendHealth();
});


// ============================================================
// GAME HUD STATUS SCAN
// ============================================================
// Evrima's public 0x77 response does not consistently expose the
// player's active injury/status list. We therefore also inspect the
// game's own rendered HUD without injecting into The Isle. This is a
// lightweight visual check performed at the same 5-second cadence as
// live telemetry.
let visualStatusScanInFlight = null;

function analyzeGameHudBitmap(bitmap, width, height) {
  if (!bitmap || !width || !height) {
    return { found: false, bleeding: false, fractured: false };
  }

  const pixels = bitmap;
  const isRed = (r, g, b) =>
    r >= 145 && r > g * 1.65 && r > b * 1.45 && g < 115;
  const isCyan = (r, g, b) =>
    g >= 125 && b >= 125 && g > r * 1.25 && b > r * 1.25;

  let redHud = 0;
  let redStatus = 0;
  let cyanStatus = 0;

  // Blood icon / status cluster is in the lower-right HUD area.
  const hudX0 = Math.floor(width * 0.74);
  const hudX1 = Math.floor(width * 0.955);
  const hudY0 = Math.floor(height * 0.68);
  const hudY1 = Math.floor(height * 0.97);

  for (let y = hudY0; y < hudY1; y += 2) {
    for (let x = hudX0; x < hudX1; x += 2) {
      const i = (y * width + x) * 4;
      // NativeImage bitmap is BGRA.
      const b = pixels[i];
      const g = pixels[i + 1];
      const r = pixels[i + 2];
      if (isRed(r, g, b)) redHud += 1;
    }
  }

  // Status Report uses cyan text and red injury text on the left side.
  // Require both so normal red scenery/screen-edge blood is not treated
  // as a fracture/laceration status.
  const statusX0 = Math.floor(width * 0.035);
  const statusX1 = Math.floor(width * 0.58);
  const statusY0 = Math.floor(height * 0.12);
  const statusY1 = Math.floor(height * 0.90);

  for (let y = statusY0; y < statusY1; y += 2) {
    for (let x = statusX0; x < statusX1; x += 2) {
      const i = (y * width + x) * 4;
      const b = pixels[i];
      const g = pixels[i + 1];
      const r = pixels[i + 2];
      if (isRed(r, g, b)) redStatus += 1;
      if (isCyan(r, g, b)) cyanStatus += 1;
    }
  }

  const bleeding = redHud >= 18;
  const statusReportVisible = cyanStatus >= 80;
  const fractured = statusReportVisible && redStatus >= 35;

  return {
    found: true,
    bleeding,
    fractured,
    redHud,
    redStatus,
    cyanStatus
  };
}

async function scanGameHudStatus() {
  if (visualStatusScanInFlight) return visualStatusScanInFlight;

  visualStatusScanInFlight = (async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window"],
        thumbnailSize: { width: 640, height: 360 },
        fetchWindowIcons: false
      });

      const source = sources.find(item =>
        /the\s*isle/i.test(String(item.name || ""))
      );

      if (!source || !source.thumbnail) {
        return { found: false, bleeding: false, fractured: false };
      }

      const image = source.thumbnail;
      const size = image.getSize();
      const bitmap = image.toBitmap();
      return analyzeGameHudBitmap(bitmap, size.width, size.height);
    } catch (error) {
      console.warn("[STATUS SCAN] Visual scan failed:", error?.message || error);
      return { found: false, bleeding: false, fractured: false };
    } finally {
      visualStatusScanInFlight = null;
    }
  })();

  return visualStatusScanInFlight;
}

ipcMain.handle(
  "visual-status-scan",
  async function () {
    return scanGameHudStatus();
  }
);


// ============================================================
// WINDOWS
// ============================================================

// Prevent multiple copies from competing for the Discord callback port.
// Register the browser callback protocol used by Steam authentication.
if (process.defaultApp) {
  if (process.argv.length >= 2) app.setAsDefaultProtocolClient("submersive-isle", process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient("submersive-isle");
}

let pendingSteamAuth = null;

function handleSteamProtocolUrl(rawUrl) {
  if (!rawUrl || !String(rawUrl).startsWith("submersive-isle://auth")) return false;
  try {
    const callback = new URL(String(rawUrl));
    const success = callback.searchParams.get("success") === "true";
    const steamId = callback.searchParams.get("steamId") || "";
    const token = callback.searchParams.get("token") || "";
    if (!success || !/^\d{17}$/.test(steamId) || !token) throw new Error("Steam authentication failed");
    setAuth(token, steamId);
    if (pendingSteamAuth) {
      const resolve = pendingSteamAuth.resolve;
      clearTimeout(pendingSteamAuth.timer);
      pendingSteamAuth = null;
      resolve({ success: true, steamId });
    }
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      if (launcherWindow.isMinimized()) launcherWindow.restore();
      launcherWindow.show();
      launcherWindow.focus();
    }
    return true;
  } catch (error) {
    if (pendingSteamAuth) {
      const reject = pendingSteamAuth.reject;
      clearTimeout(pendingSteamAuth.timer);
      pendingSteamAuth = null;
      reject(error);
    }
    return false;
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", function (_event, commandLine) {
    const protocolUrl = Array.isArray(commandLine) ? commandLine.find(arg => String(arg).startsWith("submersive-isle://")) : null;
    if (protocolUrl) handleSteamProtocolUrl(protocolUrl);
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      if (launcherWindow.isMinimized()) launcherWindow.restore();
      launcherWindow.show();
      launcherWindow.focus();
      return;
    }
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.focus();
    }
  });
}

let overlayWindow = null;
let launcherWindow = null;
let appExitRequested = false;

// ============================================================
// ELECTRON SECURITY GUARDS
// ============================================================

function isTrustedLocalPage(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "file:" && parsed.pathname.endsWith(".html");
  } catch (_error) {
    return false;
  }
}

function isAllowedRemoteUrl(url) {
  try {
    const parsed = new URL(String(url || ""));
    return parsed.protocol === "https:" && (
      parsed.hostname === "arkanis.gg" ||
      parsed.hostname.endsWith(".arkanis.gg") ||
      parsed.hostname === "discord.com" ||
      parsed.hostname.endsWith(".discord.com")
    );
  } catch (_error) {
    return false;
  }
}

app.on("web-contents-created", function (_event, contents) {
  contents.on("will-navigate", function (event, url) {
    if (!isTrustedLocalPage(url) && !isAllowedRemoteUrl(url)) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(function ({ url }) {
    if (isAllowedRemoteUrl(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  contents.on("will-attach-webview", function (event, webPreferences, params) {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    delete webPreferences.preload;

    if (!isAllowedRemoteUrl(params.src)) {
      event.preventDefault();
    }
  });
});


// ============================================================
// APP UPDATES
// ============================================================

let appUpdater = null;
let updateDownloadStarted = false;

function sendUpdateStatus(status, message, extra = {}) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send("update-status", { status, message, ...extra });
  }
}

function getUpdateConfig() {
  try {
    const file = path.join(__dirname, "update-config.json");
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!config || !/^https:\/\//i.test(String(config.url || ""))) return null;
    if (String(config.url).includes("YOUR-UPDATE-SERVER.example.com")) return null;
    return config;
  } catch (_error) {
    return null;
  }
}

function createAppUpdater() {
  if (appUpdater) return appUpdater;

  if (process.env.PORTABLE_EXECUTABLE_FILE) {
    return null;
  }

  const config = getUpdateConfig();
  if (!config) return null;

  try {
    const { NsisUpdater } = require("electron-updater");
    appUpdater = new NsisUpdater({
      provider: "generic",
      url: String(config.url).replace(/\\?$/, "") + "/"
    });

    appUpdater.autoDownload = false;
    appUpdater.autoInstallOnAppQuit = false;

    appUpdater.on("checking-for-update", () =>
      sendUpdateStatus("checking", "CHECKING FOR UPDATES...")
    );
    appUpdater.on("update-available", info => {
      updateDownloadStarted = true;
      sendUpdateStatus("downloading", `UPDATE ${info?.version || "AVAILABLE"} · DOWNLOADING...`);
      appUpdater.downloadUpdate().catch(error => {
        updateDownloadStarted = false;
        sendUpdateStatus("error", `UPDATE DOWNLOAD FAILED · ${error?.message || "UNKNOWN ERROR"}`);
      });
    });
    appUpdater.on("update-not-available", () =>
      sendUpdateStatus("ready", "YOU ARE UP TO DATE", { canInstall: false })
    );
    appUpdater.on("download-progress", progress =>
      sendUpdateStatus("downloading", `DOWNLOADING UPDATE · ${Math.round(Number(progress?.percent || 0))}%`)
    );
    appUpdater.on("update-downloaded", info => {
      updateDownloadStarted = false;
      sendUpdateStatus("downloaded", `UPDATE ${info?.version || "READY"} · CLICK INSTALL`, { canInstall: true });
    });
    appUpdater.on("error", error => {
      updateDownloadStarted = false;
      sendUpdateStatus("error", `UPDATE ERROR · ${error?.message || "UNKNOWN ERROR"}`);
    });

    return appUpdater;
  } catch (error) {
    console.error("Update system unavailable:", error);
    return null;
  }
}

async function checkForAppUpdate() {
  const updater = createAppUpdater();
  if (!updater) {
    sendUpdateStatus(
      "error",
      process.env.PORTABLE_EXECUTABLE_FILE
        ? "PORTABLE BUILD · INSTALL THE SETUP VERSION FOR AUTO-UPDATES"
        : "UPDATE SERVER NOT CONFIGURED"
    );
    return;
  }

  if (updateDownloadStarted) return;

  try {
    await updater.checkForUpdates();
  } catch (error) {
    sendUpdateStatus("error", `UPDATE CHECK FAILED · ${error?.message || "UNKNOWN ERROR"}`);
  }
}

function installAppUpdate() {
  if (!appUpdater) return;
  try {
    appUpdater.quitAndInstall(false, true);
  } catch (error) {
    sendUpdateStatus("error", `UPDATE INSTALL FAILED · ${error?.message || "UNKNOWN ERROR"}`);
  }
}

ipcMain.on("check-for-updates", function () {
  checkForAppUpdate();
});

ipcMain.on("install-update", function () {
  installAppUpdate();
});


// ============================================================
// DISCORD
// ============================================================

let discordOAuth = null;
let discordServer = null;
let discordCallbackAvailable = false;
let discordCallbackError = "";


// ============================================================
// GAME LIFECYCLE
// ============================================================

let gameWatcherTimer = null;
let gameWasRunning = false;
let gameExitHandled = false;

const THE_ISLE_PROCESS_NAMES = [
  "TheIsleClient-Win64-Shipping.exe",
  "TheIsle-Win64-Shipping.exe",
  "TheIsle.exe"
];


// ============================================================
// DISCORD OAUTH CONFIG
// ============================================================

const DISCORD_CLIENT_ID =
  "1548476655461474364";

const DISCORD_CLIENT_SECRET =
  process.env.SUBMERSIVE_DISCORD_CLIENT_SECRET ||
  "";

const DISCORD_REDIRECT_URI =
  "http://127.0.0.1:47821/discord/callback";

const DISCORD_CALLBACK_PORT = 47821;

const DISCORD_LINK_FILE =
  path.join(
    app.getPath("userData"),
    "discord-link.json"
  );


// ============================================================
// CHECK IF THE ISLE IS RUNNING
// ============================================================

function isTheIsleRunning() {
  return new Promise(
    function (resolve) {
      execFile(
        "tasklist",
        ["/FO", "CSV", "/NH"],
        {
          windowsHide: true
        },
        function (_error, stdout) {
          if (!stdout) {
            resolve(false);
            return;
          }

          const text =
            String(stdout).toLowerCase();

          for (
            const processName of THE_ISLE_PROCESS_NAMES
          ) {
            if (
              text.includes(
                processName.toLowerCase()
              )
            ) {
              resolve(true);
              return;
            }
          }

          resolve(false);
        }
      );
    }
  );
}


// ============================================================
// RETURN TO LAUNCHER AFTER GAME CLOSES
// ============================================================

function returnToLauncherAfterGameExit() {
  if (gameExitHandled) {
    return;
  }

  gameExitHandled = true;

  if (
    overlayWindow &&
    !overlayWindow.isDestroyed()
  ) {
    overlayWindow.webContents.send(
      "close-overlay",
      { stopTelemetry: true }
    );

    overlayWindow.setIgnoreMouseEvents(
      true,
      {
        forward: true
      }
    );

    overlayWindow.hide();
  }

  if (
    launcherWindow &&
    !launcherWindow.isDestroyed()
  ) {
    launcherWindow.show();
    launcherWindow.focus();
  }

  gameWasRunning = false;
}


// ============================================================
// GAME LIFECYCLE POLL
// ============================================================

async function pollGameLifecycle() {
  const running =
    await isTheIsleRunning();

  if (running) {
    if (!gameWasRunning) {
      gameWasRunning = true;
      gameExitHandled = false;
    }

    return;
  }

  if (gameWasRunning) {
    returnToLauncherAfterGameExit();
  }
}


// ============================================================
// START GAME LIFECYCLE WATCHER
// ============================================================

function startGameLifecycleWatcher() {
  if (gameWatcherTimer) {
    return;
  }

  pollGameLifecycle();

  gameWatcherTimer =
    setInterval(
      pollGameLifecycle,
      2500
    );
}


// ============================================================
// STOP GAME LIFECYCLE WATCHER
// ============================================================

function stopGameLifecycleWatcher() {
  if (!gameWatcherTimer) {
    return;
  }

  clearInterval(
    gameWatcherTimer
  );

  gameWatcherTimer = null;
}


// ============================================================
// DISCORD LINK STORAGE
// ============================================================

function saveDiscordLink(data) {
  try {
    fs.mkdirSync(
      path.dirname(DISCORD_LINK_FILE),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      DISCORD_LINK_FILE,
      JSON.stringify(
        data,
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.error(
      "Failed to save Discord link:",
      error
    );
  }
}


function loadDiscordLink() {
  try {
    if (
      !fs.existsSync(
        DISCORD_LINK_FILE
      )
    ) {
      return null;
    }

    const raw =
      fs.readFileSync(
        DISCORD_LINK_FILE,
        "utf8"
      );

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      "Failed to load Discord link:",
      error
    );

    return null;
  }
}


// ============================================================
// DISCORD TOKEN REFRESH
// ============================================================

async function refreshDiscordToken(
  refreshToken
) {
  if (
    !refreshToken ||
    !DISCORD_CLIENT_ID ||
    !DISCORD_CLIENT_SECRET
  ) {
    return null;
  }

  try {
    const body =
      new URLSearchParams({
        client_id:
          DISCORD_CLIENT_ID,

        client_secret:
          DISCORD_CLIENT_SECRET,

        grant_type:
          "refresh_token",

        refresh_token:
          refreshToken
      }).toString();

    const response =
      await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body
        }
      );

    if (!response.ok) {
      return null;
    }

    const token =
      await response.json();

    return token;
  } catch (error) {
    console.error(
      "Discord token refresh failed:",
      error
    );

    return null;
  }
}


// ============================================================
// RESTORE DISCORD LINK
// ============================================================

async function restoreDiscordLink() {
  const saved =
    loadDiscordLink();

  if (!saved) {
    return;
  }

  let accessToken =
    saved.accessToken;

  let refreshToken =
    saved.refreshToken;

  if (
    refreshToken &&
    saved.expiresAt &&
    Date.now() >=
      saved.expiresAt - 60000
  ) {
    const refreshed =
      await refreshDiscordToken(
        refreshToken
      );

    if (refreshed) {
      accessToken =
        refreshed.access_token;

      refreshToken =
        refreshed.refresh_token ||
        refreshToken;

      saved.accessToken =
        accessToken;

      saved.refreshToken =
        refreshToken;

      saved.expiresAt =
        Date.now() +
        Number(
          refreshed.expires_in ||
          604800
        ) *
          1000;

      saveDiscordLink(
        saved
      );
    }
  }

  if (
    !accessToken
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        "https://discord.com/api/users/@me",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`
          }
        }
      );

    if (!response.ok) {
      return;
    }

    const user =
      await response.json();

    const identity = {
      discordId:
        user.id,

      discordUsername:
        user.username,

      discordGlobalName:
        user.global_name ||
        user.username,

      steamId:
        saved.steamId ||
        null,

      accessToken,
      refreshToken,
      expiresAt:
        saved.expiresAt ||
        null
    };

    discordOAuth =
      identity;

    if (
      launcherWindow &&
      !launcherWindow.isDestroyed()
    ) {
      launcherWindow.webContents.send(
        "discord-linked",
        identity
      );
    }
  } catch (error) {
    console.error(
      "Failed to restore Discord link:",
      error
    );
  }
}


// ============================================================
// CREATE DISCORD OAUTH
// ============================================================

function createDiscordOAuth() {
  const verifier =
    crypto.randomBytes(32)
      .toString("base64url");

  const challenge =
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");

  const state =
    crypto.randomBytes(24)
      .toString("hex");

  discordOAuth = {
    verifier,
    state
  };

  const params =
    new URLSearchParams({
      client_id:
        DISCORD_CLIENT_ID,

      redirect_uri:
        DISCORD_REDIRECT_URI,

      response_type:
        "code",

      scope:
        "identify",

      state,

      code_challenge:
        challenge,

      code_challenge_method:
        "S256"
    });

  return (
    "https://discord.com/oauth2/authorize?" +
    params.toString()
  );
}


// ============================================================
// DISCORD CALLBACK SERVER
// ============================================================

function startDiscordCallbackServer() {
  if (discordServer) {
    return;
  }

  discordServer =
    http.createServer(
      async function (
        request,
        response
      ) {
        try {
          const requestUrl =
            new URL(
              request.url,
              DISCORD_REDIRECT_URI
            );

          if (
            requestUrl.pathname !==
            "/discord/callback"
          ) {
            response.writeHead(
              404,
              {
                "Content-Type":
                  "text/plain"
              }
            );

            response.end(
              "Not found"
            );

            return;
          }

          const code =
            requestUrl.searchParams.get(
              "code"
            );

          const state =
            requestUrl.searchParams.get(
              "state"
            );

          if (
            !code ||
            !state ||
            !discordOAuth ||
            state !==
              discordOAuth.state
          ) {
            response.writeHead(
              400,
              {
                "Content-Type":
                  "text/plain"
              }
            );

            response.end(
              "Invalid Discord OAuth request."
            );

            return;
          }

          const body =
            new URLSearchParams({
              client_id:
                DISCORD_CLIENT_ID,

              client_secret:
                DISCORD_CLIENT_SECRET,

              grant_type:
                "authorization_code",

              code,

              redirect_uri:
                DISCORD_REDIRECT_URI,

              code_verifier:
                discordOAuth.verifier
            }).toString();

          const tokenResponse =
            await fetch(
              "https://discord.com/api/oauth2/token",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded"
                },

                body
              }
            );

          if (
            !tokenResponse.ok
          ) {
            throw new Error(
              "Discord token exchange failed."
            );
          }

          const token =
            await tokenResponse.json();

          const userResponse =
            await fetch(
              "https://discord.com/api/users/@me",
              {
                headers: {
                  Authorization:
                    `Bearer ${token.access_token}`
                }
              }
            );

          if (
            !userResponse.ok
          ) {
            throw new Error(
              "Discord user lookup failed."
            );
          }

          const user =
            await userResponse.json();

          const oldLink =
            loadDiscordLink();

          const identity = {
            discordId:
              user.id,

            discordUsername:
              user.username,

            discordGlobalName:
              user.global_name ||
              user.username,

            steamId:
              oldLink &&
              oldLink.steamId
                ? oldLink.steamId
                : null,

            accessToken:
              token.access_token,

            refreshToken:
              token.refresh_token ||
              null,

            expiresAt:
              Date.now() +
              Number(
                token.expires_in ||
                604800
              ) *
                1000
          };

          discordOAuth =
            identity;

          saveDiscordLink(
            identity
          );

          response.writeHead(
            200,
            {
              "Content-Type":
                "text/html; charset=utf-8"
            }
          );

          response.end(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Discord Linked</title>
<style>
body {
  background: #090d14;
  color: #ffffff;
  font-family: Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  margin: 0;
}
.box {
  text-align: center;
  padding: 40px;
}
h1 {
  color: #009dff;
}
</style>
</head>
<body>
<div class="box">
<h1>Discord Linked</h1>
<p>You can close this window and return to Submersive Isle.</p>
</div>
</body>
</html>
          `);

          if (
            launcherWindow &&
            !launcherWindow.isDestroyed()
          ) {
            launcherWindow.webContents.send(
              "discord-linked",
              identity
            );
          }
        } catch (error) {
          console.error(
            "Discord callback error:",
            error
          );

          response.writeHead(
            500,
            {
              "Content-Type":
                "text/plain"
            }
          );

          response.end(
            "Discord linking failed."
          );
        }
      }
    );

  discordServer.once("error", function (error) {
    discordCallbackAvailable = false;
    discordCallbackError = String(error?.code || error?.message || "UNKNOWN ERROR");

    console.error("Discord callback server error:", error);

    if (error?.code === "EADDRINUSE") {
      discordCallbackError = "PORT 47821 IS ALREADY IN USE";
    }

    try { discordServer.close(); } catch (_closeError) {}
    discordServer = null;

    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.webContents.send("discord-link-error", { message: discordCallbackError });
    }
  });

  discordServer.listen(
    DISCORD_CALLBACK_PORT,
    "127.0.0.1",
    function () {
      discordCallbackAvailable = true;
      discordCallbackError = "";

      console.log(
        `Discord callback listening on ${DISCORD_REDIRECT_URI}`
      );

      restoreDiscordLink();
    }
  );
}


// ============================================================
// DISCORD LINK IPC
// ============================================================

ipcMain.on(
  "open-discord-link",
  function () {
    if (!discordCallbackAvailable) {
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("discord-link-error", {
          message: discordCallbackError || "DISCORD CALLBACK SERVER IS NOT READY"
        });
      }
      return;
    }

    try {
      const url = createDiscordOAuth();
      shell.openExternal(url);
    } catch (error) {
      console.error("Failed to start Discord OAuth:", error);
      if (launcherWindow && !launcherWindow.isDestroyed()) {
        launcherWindow.webContents.send("discord-link-error", {
          message: String(error?.message || "DISCORD LINK FAILED")
        });
      }
    }
  }
);


// ============================================================
// SECURE API CONFIG / STEAM AUTH
// ============================================================

ipcMain.handle("rcon-config", function () {
  const c = loadConfig();
  return { host: c.baseUrl, port: null, playerName: null, playerId: getAuthState().steamId, configured: Boolean(c.baseUrl) };
});

ipcMain.handle("steam-auth-login", async function () {
  const cfg = loadConfig();
  if (!cfg.baseUrl) throw new Error("API NOT CONFIGURED");
  if (pendingSteamAuth) throw new Error("Steam login already in progress");

  await shell.openExternal(cfg.baseUrl + "/auth/steam");

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pendingSteamAuth) return;
      pendingSteamAuth = null;
      reject(new Error("Steam login timed out"));
    }, 5 * 60 * 1000);
    pendingSteamAuth = { resolve, reject, timer };
  });
});

app.on("open-url", function (event, url) {
  event.preventDefault();
  handleSteamProtocolUrl(url);
});

// ============================================================
// RETURN TO LAUNCHER
// ============================================================

ipcMain.on(
  "return-to-launcher",
  function () {
    if (
      overlayWindow &&
      !overlayWindow.isDestroyed()
    ) {
      overlayWindow.webContents.send(
        "close-overlay",
        { stopTelemetry: false }
      );
      overlayWindow.setIgnoreMouseEvents(
        true,
        { forward: true }
      );
      overlayWindow.hide();
    }

    const launcher = createLauncher();
    if (launcher && !launcher.isDestroyed()) {
      launcher.show();
      launcher.focus();
      launcher.moveTop();
    }
  }
);

// ============================================================
// EXIT LAUNCHER
// ============================================================

ipcMain.on(
  "exit-launcher",
  function () {
    appExitRequested = true;
    stopGameLifecycleWatcher();

    if (
      overlayWindow &&
      !overlayWindow.isDestroyed()
    ) {
      overlayWindow.close();
      overlayWindow = null;
    }

    app.quit();
  }
);


// ============================================================
// DISPLAY USED BY OVERLAY
// ============================================================

function displayForOverlay() {
  if (
    overlayWindow &&
    !overlayWindow.isDestroyed()
  ) {
    const bounds =
      overlayWindow.getBounds();

    return screen.getDisplayMatching(
      bounds
    );
  }

  return screen.getPrimaryDisplay();
}


// ============================================================
// POSITION OVERLAY
// ============================================================

function positionOverlay() {
  if (
    !overlayWindow ||
    overlayWindow.isDestroyed()
  ) {
    return;
  }

  const d =
    displayForOverlay();

  /*
   * Keep the native The Isle Status Report visible above the
   * Submersive overlay.  The overlay window itself is only placed
   * in the lower panel area shown in the reference layout.
   *
   * This intentionally changes ONLY the overlay window bounds.
   * The existing renderer, RCON, launcher, telemetry, and EXE
   * architecture remain untouched.
   */
  const topInset = 190;
  const sideInset = 31;
  const bottomInset = 82;

  const width =
    Math.max(
      640,
      d.bounds.width - (sideInset * 2)
    );

  const height =
    Math.max(
      420,
      d.bounds.height - topInset - bottomInset
    );

  overlayWindow.setBounds(
    {
      x: d.bounds.x + sideInset,
      y: d.bounds.y + topInset,
      width,
      height
    },
    false
  );
}


// ============================================================
// CREATE OVERLAY
// ============================================================

function createOverlay() {
  if (
    overlayWindow &&
    !overlayWindow.isDestroyed()
  ) {
    return overlayWindow;
  }

  const d =
    screen.getPrimaryDisplay();

  overlayWindow =
    new BrowserWindow({
      x:
        d.bounds.x,

      y:
        d.bounds.y,

      width:
        d.bounds.width,

      height:
        d.bounds.height,

      transparent:
        true,

      frame:
        false,

      resizable:
        false,

      movable:
        false,

      minimizable:
        false,

      maximizable:
        false,

      closable:
        true,

      fullscreen:
        false,

      alwaysOnTop:
        false,

      skipTaskbar:
        true,

      show:
        false,

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.js"
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false,

        sandbox:
          true,

        webviewTag:
          true
      }
    });

  overlayWindow.setAlwaysOnTop(
    false,
  );

  overlayWindow.setIgnoreMouseEvents(
    true,
    {
      forward: true
    }
  );

  overlayWindow.loadFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

  overlayWindow.on(
    "close",
    function (event) {
      if (!appExitRequested) {
        event.preventDefault();
        overlayWindow.hide();
      }
    }
  );

  overlayWindow.on(
    "closed",
    function () {
      overlayWindow = null;
    }
  );

  return overlayWindow;
}


// ============================================================
// CREATE LAUNCHER
// ============================================================

function createLauncher() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    return launcherWindow;
  }

  launcherWindow = new BrowserWindow({
    width: 720,
    height: 600,
    minWidth: 720,
    minHeight: 600,
    maxWidth: 720,
    maxHeight: 600,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Submersive Isle Launcher",
    show: false,
    center: true,
    backgroundColor: "#050b11",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  });

  launcherWindow.loadFile(path.join(__dirname, "launcher.html"));

  launcherWindow.once("ready-to-show", function () {
    if (launcherWindow && !launcherWindow.isDestroyed()) {
      launcherWindow.show();
      launcherWindow.focus();
    }
  });

  launcherWindow.on("closed", function () {
    launcherWindow = null;
  });

  return launcherWindow;
}


// ============================================================
// TAB FOCUS GUARD
// ============================================================

function isAllowedTabForeground() {
  return new Promise((resolve) => {

    /*
     * Tab is a global shortcut so it can open the overlay while the
     * game is running.  Before toggling, check the actual Windows
     * foreground process.  This prevents pressing Tab while another
     * application is focused on a second monitor from toggling the
     * overlay there.
     */
    const command = [
      "$type = @'",
      "using System;",
      "using System.Runtime.InteropServices;",
      "public static class ForegroundWindowInfo {",
      "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
      "  [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);",
      "}",
      "'@",
      "Add-Type $type -ErrorAction SilentlyContinue;",
      "$pidValue = 0;",
      "[ForegroundWindowInfo]::GetWindowThreadProcessId([ForegroundWindowInfo]::GetForegroundWindow(), [ref]$pidValue) | Out-Null;",
      "if ($pidValue -gt 0) { (Get-Process -Id $pidValue -ErrorAction SilentlyContinue).ProcessName }"
    ].join("\n");

    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        command
      ],
      {
        windowsHide: true,
        timeout: 1500
      },
      function (_error, stdout) {

        const processName =
          String(stdout || "")
            .trim()
            .toLowerCase();

        const allowed = new Set([
          "theisleclient-win64-shipping",
          "theisle-win64-shipping",
          "theisle",
          "submersive-isle-overlay",
          "electron"
        ]);

        resolve(
          allowed.has(processName)
        );

      }
    );

  });
}

let overlayFocusWatcher = null;
let overlayFocusCheckInFlight = false;

function startOverlayFocusWatcher() {
  if (overlayFocusWatcher) {
    return;
  }

  overlayFocusWatcher = setInterval(
    async function () {
      if (
        overlayFocusCheckInFlight ||
        !overlayWindow ||
        overlayWindow.isDestroyed() ||
        !overlayWindow.isVisible()
      ) {
        return;
      }

      overlayFocusCheckInFlight = true;

      try {
        const gameOrOverlayActive =
          await isAllowedTabForeground();

        if (gameOrOverlayActive) {
          overlayWindow.setAlwaysOnTop(
            true,
            "screen-saver"
          );
        } else {
          overlayWindow.setAlwaysOnTop(
            false
          );
        }
      } finally {
        overlayFocusCheckInFlight = false;
      }
    },
    1000
  );
}

// ============================================================
// OVERLAY TOGGLE
// ============================================================


function toggleOverlay() {
  if (
    !overlayWindow ||
    overlayWindow.isDestroyed()
  ) {
    return;
  }

  overlayWindow.webContents.send(
    "toggle-overlay"
  );

  overlayWindow.showInactive();

  overlayWindow.setAlwaysOnTop(
    false,
  );
}


// ============================================================
// CLOSE OVERLAY
// ============================================================

function closeOverlay() {
  if (
    !overlayWindow ||
    overlayWindow.isDestroyed()
  ) {
    return;
  }

  /*
   * ESC / the overlay close control closes ONLY the full menu.
   * The minimal HUD must remain visible and live.
   * Only the game-exit path is allowed to hide the overlay window.
   */
  overlayWindow.webContents.send(
    "close-overlay",
    { stopTelemetry: false }
  );

  overlayWindow.setIgnoreMouseEvents(
    true,
    {
      forward: true
    }
  );

  overlayWindow.showInactive();
  overlayWindow.setAlwaysOnTop(
    false,
  );
}


// ============================================================
// OPEN OVERLAY IPC
// ============================================================

ipcMain.on(
  "open-overlay",
  function () {
    if (
      !overlayWindow ||
      overlayWindow.isDestroyed()
    ) {
      createOverlay();
    }

    if (
      !overlayWindow ||
      overlayWindow.isDestroyed()
    ) {
      return;
    }

    positionOverlay();

    overlayWindow.setIgnoreMouseEvents(
      false
    );

    overlayWindow.show();

    overlayWindow.setAlwaysOnTop(
      false,
    );

    overlayWindow.webContents.send(
      "open-overlay"
    );
  }
);


// ============================================================
// OVERLAY INTERACTIVE MODE
// ============================================================

ipcMain.on(
  "overlay-interactive",
  function (
    _event,
    value
  ) {
    if (
      !overlayWindow ||
      overlayWindow.isDestroyed()
    ) {
      return;
    }

    overlayWindow.setIgnoreMouseEvents(
      !Boolean(value),
      {
        forward: true
      }
    );
  }
);


// ============================================================
// LAUNCH OVERLAY
// ============================================================

ipcMain.on(
  "launch-overlay",
  function (
    _event,
    identity
  ) {
    /*
     * Steam identity must come from the authenticated
     * API session — NEVER from renderer/localStorage.
     */
    const authState = getAuthState();

    const authenticatedSteamId =
      String(authState?.steamId || "").trim();

    const discordId =
      String(identity?.discordId || "").trim();

    if (
      !authState?.authenticated ||
      !/^\d{17}$/.test(authenticatedSteamId)
    ) {
      console.error(
        "launch-overlay requires an authenticated Steam session."
      );

      return;
    }

    if (!discordId) {
      console.error(
        "launch-overlay requires a linked Discord account."
      );

      return;
    }

    /*
     * Build a clean identity here.
     *
     * Ignore identity.steamId supplied by the renderer.
     */
    const verifiedIdentity = {
      steamId: authenticatedSteamId,
      discordId: discordId
    };

    if (
      !overlayWindow ||
      overlayWindow.isDestroyed()
    ) {
      createOverlay();
    }

    if (
      !overlayWindow ||
      overlayWindow.isDestroyed()
    ) {
      return;
    }

    positionOverlay();

    if (
      launcherWindow &&
      !launcherWindow.isDestroyed()
    ) {
      launcherWindow.hide();
    }

    function sendIdentityAndShow() {
      if (
        !overlayWindow ||
        overlayWindow.isDestroyed()
      ) {
        return;
      }

      /*
       * Only send the SteamID verified by the
       * backend Steam authentication session.
       */
      overlayWindow.webContents.send(
        "identity-linked",
        verifiedIdentity
      );

      overlayWindow.webContents.send(
        "open-overlay"
      );

      overlayWindow.show();

      overlayWindow.setAlwaysOnTop(
        false,
      );

      startGameLifecycleWatcher();
      startOverlayFocusWatcher();
    }

    if (
      overlayWindow.webContents.isLoading()
    ) {
      overlayWindow.webContents.once(
        "did-finish-load",
        function () {
          sendIdentityAndShow();
        }
      );
    } else {
      sendIdentityAndShow();
    }
  }
);

// ============================================================
// APP READY
// ============================================================

app.whenReady().then(
  function () {
    startDiscordCallbackServer();

    createOverlay();

    createLauncher();

    globalShortcut.register(
      "Tab",
      async function () {
        if (
          await isAllowedTabForeground()
        ) {
          toggleOverlay();
        }
      }
    );

    globalShortcut.register(
      "Escape",
      function () {
        /* ESC only hides the overlay menu. It never exits Electron. */
        closeOverlay();
      }
    );
  }
);


// ============================================================
// APP ACTIVATE
// ============================================================

app.on(
  "activate",
  function () {
    if (
      BrowserWindow.getAllWindows()
        .length === 0
    ) {
      createLauncher();
    }
  }
);


// ============================================================
// APP WILL QUIT
// ============================================================

app.on(
  "will-quit",
  function () {
    stopGameLifecycleWatcher();

    if (overlayFocusWatcher) {
      clearInterval(overlayFocusWatcher);
      overlayFocusWatcher = null;
    }

    globalShortcut.unregisterAll();

    if (discordServer) {
      try {
        discordServer.close();
      } catch (error) {
        console.error(
          "Failed to close Discord callback server:",
          error
        );
      }

      discordServer = null;
    }
  }
);

// ============================================================
// WINDOW CLOSE SAFETY
// ============================================================

app.on(
  "window-all-closed",
  function () {
    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }
  }
);
