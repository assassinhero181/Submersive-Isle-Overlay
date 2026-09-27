const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {

  onToggle: cb =>
    ipcRenderer.on("toggle-overlay", cb),

  onOpen: cb =>
    ipcRenderer.on("open-overlay", cb),

  onClose: cb =>
    ipcRenderer.on("close-overlay", (_e, options) => cb(options || {})),

  onIdentityLinked: cb =>
    ipcRenderer.on("identity-linked", (_e, data) => cb(data)),

  setInteractive: value =>
    ipcRenderer.send("overlay-interactive", Boolean(value)),


  getLivePlayerData: steamId =>
    ipcRenderer.invoke("rcon-live-player", steamId),

  connectSteam: () =>
    ipcRenderer.invoke("steam-auth-login"),

  checkBackendHealth: () =>
    ipcRenderer.invoke("backend-health"),

  getVisualStatusScan: () =>
    ipcRenderer.invoke("visual-status-scan"),

  getRconConfig: () =>
    ipcRenderer.invoke("rcon-config"),

  launchOverlay: identity =>
    ipcRenderer.send("launch-overlay", identity),

  openDiscordLink: () =>
    ipcRenderer.send("open-discord-link"),

  exitLauncher: () =>
    ipcRenderer.send("exit-launcher"),

  returnToLauncher: () =>
    ipcRenderer.send("return-to-launcher"),

  onDiscordLinked: cb =>
    ipcRenderer.on("discord-linked", (_e, data) => cb(data)),

  onDiscordLinkError: cb =>
    ipcRenderer.on("discord-link-error", (_e, data) => cb(data || {})),

  checkForUpdates: () =>
    ipcRenderer.send("check-for-updates"),

  installUpdate: () =>
    ipcRenderer.send("install-update"),

  onUpdateStatus: cb =>
    ipcRenderer.on("update-status", (_e, data) => cb(data || {})),


  garageStore: creature =>
    ipcRenderer.invoke("garage-store", creature),

  garageList: steamId =>
    ipcRenderer.invoke("garage-list", steamId),

  garageDelete: payload =>
    ipcRenderer.invoke("garage-delete", payload)

});