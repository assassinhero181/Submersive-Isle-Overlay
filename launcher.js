const state = {
  discordId: localStorage.getItem("submersiveDiscordId") || "",
  discord: false,
  steam: false,
  steamId: localStorage.getItem("submersiveSteamId") || ""
};

const $ = id => document.getElementById(id);

function setUpdateStatus(message, type = "") {
  const el = $("updateStatus");
  if (!el) return;
  el.textContent = String(message || "").toUpperCase();
  el.className = "update-status" + (type ? ` ${type}` : "");
}
state.steam = false;

function update() {
  $("steamId").value = state.steamId;
  $("steamStatus").textContent = state.steam ? "VERIFIED" : "NOT VERIFIED";
  $("discordStatus").textContent = state.discord ? "LINKED" : "NOT LINKED";
  $("steamCard").classList.toggle("linked", state.steam);
  $("discordCard").classList.toggle("linked", state.discord);

  const ready = state.discord && state.steam;
  $("launchBtn").disabled = !ready;
  $("identityBox").classList.toggle("ready", ready);
  $("identityStatus").textContent = ready
    ? "DISCORD + STEAM CONNECTED · READY TO LAUNCH"
    : "DISCORD + STEAM REQUIRED";
}

$("steamBtn").onclick = async () => {
  const button = $("steamBtn");
  button.disabled = true;
  $("steamStatus").textContent = "CONNECTING...";
  try {
    const result = await window.electronAPI.connectSteam();
    if (!result?.success || !/^\d{17}$/.test(String(result.steamId || ""))) throw new Error("Steam verification failed");
    state.steamId = String(result.steamId);
    state.steam = true;
    localStorage.setItem("submersiveSteamId", state.steamId);
    update();
  } catch (error) {
    state.steam = false;
    $("steamStatus").textContent = String(error?.message || "STEAM LOGIN FAILED").toUpperCase();
    update();
  } finally { button.disabled = false; }
};

$("discordBtn").onclick = () => {
  if (window.electronAPI?.openDiscordLink) {
    window.electronAPI.openDiscordLink();
  }
};

if (window.electronAPI?.onDiscordLinkError) {
  window.electronAPI.onDiscordLinkError(data => {
    state.discord = false;
    $("discordStatus").textContent = data?.message || "DISCORD LINK UNAVAILABLE";
    $("discordCard").classList.remove("linked");
    update();
  });
}

if (window.electronAPI?.onDiscordLinked) {
  window.electronAPI.onDiscordLinked(data => {
    if (data?.discordId) {
      state.discordId = String(data.discordId);
      state.discord = true;
      localStorage.setItem("submersiveDiscordId", state.discordId);
    }
    update();
  });
}

$("launchBtn").onclick = () => {
  if (!state.discord || !state.steam) return;

  if (window.electronAPI?.launchOverlay) {
    window.electronAPI.launchOverlay({
      steamId: state.steamId,
      discordId: state.discordId
    });
  }
};

$("exitBtn").onclick = () => {
  window.electronAPI?.exitLauncher?.();
};

update();

async function checkBackend() {
  const status = $("backendStatus");
  const box = $("backendBox");
  const retry = $("backendRetryBtn");
  if (!status) return;
  status.textContent = "CHECKING...";
  retry.hidden = true;
  box?.classList.remove("ready");
  try {
    const result = await window.electronAPI?.checkBackendHealth?.();
    const connected = Boolean(result?.connected);
    status.textContent = connected ? "CONNECTED" : "DISCONNECTED";
    box?.classList.toggle("ready", connected);
    retry.hidden = connected;
  } catch (_) {
    status.textContent = "DISCONNECTED";
    retry.hidden = false;
  }
}

$("backendRetryBtn").onclick = () => checkBackend();
checkBackend();
setInterval(checkBackend, 30000);

$("updateBtn").onclick = () => {
  if ($("updateBtn").textContent === "INSTALL") {
    window.electronAPI?.installUpdate?.();
    return;
  }
  setUpdateStatus("CHECKING FOR UPDATES...");
  window.electronAPI?.checkForUpdates?.();
};

if (window.electronAPI?.onUpdateStatus) {
  window.electronAPI.onUpdateStatus(data => {
    const status = data?.status || "";
    const message = data?.message || "UPDATE CHECK FAILED";
    const type = status === "error" ? "error" : (status === "ready" || status === "downloaded" ? "ready" : "");
    setUpdateStatus(message, type);
    $("updateBtn").disabled = status === "checking" || status === "downloading";
    if (data?.canInstall) {
      $("updateBtn").textContent = "INSTALL";
      $("updateBtn").disabled = false;
    } else if (status !== "downloaded") {
      $("updateBtn").textContent = "UPDATE";
    }
  });
}
