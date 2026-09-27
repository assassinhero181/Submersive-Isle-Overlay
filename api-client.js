"use strict";

const fs = require("fs");
const path = require("path");
const { getCreatureData, biteForceForGrowth } = require("./creature-data");

const CONFIG_PATH = path.join(__dirname, "api-config.json");
let authToken = null;
let authenticatedSteamId = null;
let livePlayerInFlight = null;
let lastLiveRequestAt = 0;
const LIVE_REQUEST_MIN_INTERVAL_MS = 5000;
let serverCache = null;
let serverCacheAt = 0;
const SERVER_CACHE_MS = 30000;

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return { baseUrl: String(cfg.baseUrl || "").replace(/\/+$/, "") };
  } catch (_) {
    return { baseUrl: "" };
  }
}

function setAuth(token, steamId) {
  authToken = token ? String(token) : null;
  authenticatedSteamId = steamId ? String(steamId) : null;
}

function clearAuth() {
  authToken = null;
  authenticatedSteamId = null;
}

function getAuthState() {
  return { authenticated: Boolean(authToken && authenticatedSteamId), steamId: authenticatedSteamId };
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function checkBackendHealth() {
  const cfg = loadConfig();
  if (!cfg.baseUrl) return { connected: false, message: "BACKEND NOT CONFIGURED" };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(`${cfg.baseUrl}/health`, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return { connected: false, message: `BACKEND HTTP ${response.status}` };
    const body = await response.json().catch(() => ({}));
    return { connected: body?.ok === true, message: body?.ok === true ? "BACKEND CONNECTED" : "BACKEND UNAVAILABLE" };
  } catch (_) {
    return { connected: false, message: "BACKEND DISCONNECTED" };
  }
}


function normalizeSpeciesName(value) {
  if (value == null) return null;
  let name = String(value).trim().toUpperCase();
  name = name.replace(/^BP[_\s-]*/i, "");
  name = name.replace(/[_\s-]*C$/i, "");
  name = name.replace(/^CHARACTER[_\s-]*/i, "");
  return name || null;
}


function numericValue(v) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function textField(raw, names) {
  if (raw == null) return null;
  if (typeof raw === "object") {
    for (const name of names) {
      for (const [k, v] of Object.entries(raw)) {
        if (String(k).toLowerCase() === name.toLowerCase() && v != null) return v;
      }
    }
    for (const v of Object.values(raw)) {
      if (v && typeof v === "object") {
        const found = textField(v, names);
        if (found != null) return found;
      }
    }
  }
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  for (const name of names) {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`${safe}\\s*[:=]\\s*([^,\\n\\r}]+)`, "i").exec(text);
    if (m) return m[1].replace(/^['\"]|['\"]$/g, "").trim();
  }
  return null;
}

function parseServerData(raw, playersRaw) {
  const environment = {
    temperature: numericValue(textField(raw, ["Temperature", "CurrentTemperature", "AmbientTemperature", "WorldTemperature", "WeatherTemperature"])),
    weather: textField(raw, ["Weather", "CurrentWeather", "WeatherState", "WeatherType", "WeatherName", "WorldWeather"]),
    time: textField(raw, ["Time", "GameTime", "WorldTime", "ServerTime", "CurrentTime", "TimeOfDay", "DayTime"])
  };

  let currentPlayers = numericValue(textField(raw, ["ServerCurrentPlayers", "CurrentPlayerCount", "CurrentPlayers"]));
  if (currentPlayers == null && Array.isArray(playersRaw)) currentPlayers = playersRaw.length;

  return {
    name: textField(raw, ["ServerName", "Name"]),
    map: textField(raw, ["ServerMap", "MapName", "Map"]),
    currentPlayers,
    maxPlayers: numericValue(textField(raw, ["ServerMaxPlayers", "MaxPlayerCount", "MaxPlayers"])),
    tick: numericValue(textField(raw, ["TickRate", "ServerTickRate", "Tick"])),
    environment
  };
}

async function getServerData(cfg) {
  if (serverCache && Date.now() - serverCacheAt < SERVER_CACHE_MS) return serverCache;
  try {
    const response = await fetch(`${cfg.baseUrl}/api/server`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store"
    });
    if (!response.ok) return serverCache;
    const body = await response.json();
    serverCache = parseServerData(body?.server, body?.players);
    serverCacheAt = Date.now();
    return serverCache;
  } catch (_) {
    return serverCache;
  }
}

async function getLivePlayerData(requestedPlayerId = null) {
  if (livePlayerInFlight) return livePlayerInFlight;
  livePlayerInFlight = getLivePlayerDataInternal(requestedPlayerId);
  try { return await livePlayerInFlight; }
  finally { livePlayerInFlight = null; }
}

async function getLivePlayerDataInternal(requestedPlayerId = null) {
  const cfg = loadConfig();
  const steamId = String(requestedPlayerId || authenticatedSteamId || "").trim();

  if (!cfg.baseUrl) return { configured:false, connected:false, message:"API NOT CONFIGURED", player:null };
  if (!authToken || !authenticatedSteamId) return { configured:true, connected:false, message:"STEAM LOGIN REQUIRED", player:null };
  if (!/^\d{17}$/.test(steamId) || steamId !== authenticatedSteamId) return { configured:true, connected:false, message:"STEAM ID MISMATCH", player:null };

  const waitFor = LIVE_REQUEST_MIN_INTERVAL_MS - (Date.now() - lastLiveRequestAt);
  if (waitFor > 0) await sleep(waitFor);
  lastLiveRequestAt = Date.now();
  const started = Date.now();

  try {
    const response = await fetch(`${cfg.baseUrl}/api/player/${encodeURIComponent(steamId)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store"
    });

    if (response.status === 401) {
      clearAuth();
      return { configured:true, connected:false, message:"STEAM SESSION EXPIRED · RECONNECT", player:null };
    }
    if (!response.ok) throw new Error(`API HTTP ${response.status}`);

    const body = await response.json();
    const d = body && body.data ? body.data : null;
    if (!d || d.online === false) return { configured:true, connected:true, latency:Date.now()-started, message:"PLAYER NOT FOUND", player:null };

    const species = normalizeSpeciesName(d.species);
    const creature = getCreatureData(species);
    const player = {
      playerId: String(d.playerId || d.steamId || steamId),
      name: d.name || null,
      gender: d.gender || null,
      class: species,
      growth: d.growth,
      health: d.health,
      stamina: d.stamina,
      hunger: d.hunger,
      thirst: d.thirst,
      location: d.location || null,
      mutations: Array.isArray(d.mutations?.current) ? d.mutations.current.filter(Boolean) : [],
      parentMutations: Array.isArray(d.mutations?.parent) ? d.mutations.parent.filter(Boolean) : [],
      elderA: Array.isArray(d.mutations?.elderA) ? d.mutations.elderA.filter(Boolean) : [],
      elderB: Array.isArray(d.mutations?.elderB) ? d.mutations.elderB.filter(Boolean) : [],
      primeElder: Boolean(d.primeElder)
    };

    if (creature) {
      player.preferredFood = creature.preferredFood ?? null;
      player.diet = creature.diet ?? null;
      player.biteForce = biteForceForGrowth(species, d.growth == null ? null : Number(d.growth) * 100);
    }

    const server = await getServerData(cfg);
    return { configured:true, connected:true, latency:Date.now()-started, message:"LIVE · SECURE API", player, server };
  } catch (error) {
    return { configured:true, connected:false, message:error?.message || "API UNAVAILABLE", player:null };
  }
}

module.exports = {
  checkBackendHealth, getLivePlayerData, loadConfig, setAuth, clearAuth, getAuthState };
