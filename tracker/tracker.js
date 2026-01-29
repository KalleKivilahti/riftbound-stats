const $ = (id) => document.getElementById(id);

const SUPABASE_DEFAULT_URL = "https://hmdboowggoinfxgttrum.supabase.co";
const SUPABASE_DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZGJvb3dnZ29pbmZ4Z3R0cnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODQ2MjYsImV4cCI6MjA4NTI2MDYyNn0.o7U9TggOZIbt8-duT85pXAMjxHnM5WpgMgIXKVUUOIw";

// ---------- Default presets (examples, not deletable) ----------
const DEFAULT_PRESETS = [
  {
    id: "default:draven-mirror-a",
    name: "Draven Mirror A (example)",
    list: `3 Stacked Deck
3 Treasure Hunter
2 Rebuke
1 Falling Star`,
    isCustom: false
  },
  {
    id: "default:draven-mirror-b",
    name: "Draven Mirror B (example)",
    list: `3 Stacked Deck
3 Overzealous Fan
2 Switcheroo
2 Fight or Flight`,
    isCustom: false
  }
];

// ---------- Storage ----------
const STORAGE_KEY_PRESETS = "customPresets";
const STORAGE_KEY_MYNAME = "rb_myName";
const STORAGE_KEY_GAMES = "rb_games";
const STORAGE_KEY_SUPABASE_URL = "rb_supabaseUrl";
const STORAGE_KEY_SUPABASE_KEY = "rb_supabaseKey";

async function loadCustomPresets() {
  const data = await chrome.storage.local.get([STORAGE_KEY_PRESETS]);
  const arr = Array.isArray(data[STORAGE_KEY_PRESETS]) ? data[STORAGE_KEY_PRESETS] : [];
  return arr
    .filter(p => p && typeof p.id === "string" && typeof p.name === "string" && typeof p.list === "string")
    .map(p => ({
      id: p.id.startsWith("custom:") ? p.id : `custom:${p.id}`,
      name: p.name,
      list: p.list,
      isCustom: true
    }));
}

async function saveCustomPresets(customPresets) {
  const toStore = customPresets.map(p => ({ id: p.id, name: p.name, list: p.list }));
  await chrome.storage.local.set({ [STORAGE_KEY_PRESETS]: toStore });
}

async function loadMyName() {
  const data = await chrome.storage.local.get([STORAGE_KEY_MYNAME]);
  return (data[STORAGE_KEY_MYNAME] ?? "").toString().trim();
}

async function saveMyName(name) {
  await chrome.storage.local.set({ [STORAGE_KEY_MYNAME]: name });
}

async function loadGames() {
  const data = await chrome.storage.local.get([STORAGE_KEY_GAMES]);
  const arr = Array.isArray(data[STORAGE_KEY_GAMES]) ? data[STORAGE_KEY_GAMES] : [];
  return arr.filter(g => g && (g.result === "win" || g.result === "loss") && Array.isArray(g.cardsPlayed));
}

// Manual heroes for now
const OPPONENT_HEROES = [
  "Irelia", "Fiora", "Ezreal", "Lucian", "Rumble", "Ornn",
  "Annie", "Master Yi", "Lux", "Garen", "Ahri", "Darius",
  "Jinx", "Kai'Sa", "Lee Sin", "Miss Fortune", "Sett", "Teemo",
  "Viktor", "Volibear", "Yasuo"
];

async function saveGames(games) {
  await chrome.storage.local.set({ [STORAGE_KEY_GAMES]: games });
}

async function loadSupabaseConfig() {
  const data = await chrome.storage.local.get([STORAGE_KEY_SUPABASE_URL, STORAGE_KEY_SUPABASE_KEY]);
  const url = (data[STORAGE_KEY_SUPABASE_URL] || "").trim();
  const key = (data[STORAGE_KEY_SUPABASE_KEY] || "").trim();
  return {
    url: url || (SUPABASE_DEFAULT_URL || "").trim(),
    key: key || (SUPABASE_DEFAULT_KEY || "").trim()
  };
}

async function saveSupabaseConfig(url, key) {
  await chrome.storage.local.set({
    [STORAGE_KEY_SUPABASE_URL]: (url || "").trim(),
    [STORAGE_KEY_SUPABASE_KEY]: (key || "").trim()
  });
}

// ---------- Preset State ----------
let customPresets = [];
let allPresets = [];

function rebuildAllPresets() {
  allPresets = [...DEFAULT_PRESETS, ...customPresets];
}

function fillPresetSelect(selectEl) {
  const first = selectEl.querySelector("option");
  selectEl.innerHTML = "";
  if (first) selectEl.appendChild(first);

  const defaults = allPresets.filter(p => !p.isCustom);
  const customs = allPresets.filter(p => p.isCustom);

  if (defaults.length) {
    const og = document.createElement("optgroup");
    og.label = "Defaults";
    for (const p of defaults) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }

  if (customs.length) {
    const og = document.createElement("optgroup");
    og.label = "My presets";
    for (const p of customs) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      og.appendChild(opt);
    }
    selectEl.appendChild(og);
  }
}

function getPresetById(id) {
  return allPresets.find(p => p.id === id) ?? null;
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function makeCustomId(name) {
  const base = slugify(name) || "preset";
  return `custom:${base}-${Date.now()}`;
}

// ---------- Math helpers ----------
function logGamma(z) {
  const p = [
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function probAtLeastKInHand(N, c, h, k) {
  if (k <= 0) return 1;
  if (h <= 0 || N <= 0 || c <= 0) return 0;
  if (h > N) h = N;
  if (k > h) return 0;
  if (c >= N) return 1;

  const logDen = logChoose(N, h);
  let sum = 0;

  const maxI = Math.min(k - 1, c, h);
  for (let i = 0; i <= maxI; i++) {
    const logNum = logChoose(c, i) + logChoose(N - c, h - i);
    sum += Math.exp(logNum - logDen);
  }

  const p = 1 - sum;
  return Math.max(0, Math.min(1, p));
}

function heatClass(pct) {
  if (pct >= 60) return "hot";
  if (pct >= 30) return "warm";
  if (pct >= 10) return "cool";
  return "none";
}

// ---------- Matching helpers ----------
function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s\.\,\:\;\-\(\)\[\]'"“”]/g, "")
    .trim();
}

function findCard(deck, incomingName) {
  const n = normName(incomingName);

  let c = deck.find(x => normName(x.name) === n);
  if (c) return c;

  c = deck.find(x => normName(x.name).includes(n) || n.includes(normName(x.name)));
  return c ?? null;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// ---------- Core ----------
function parseDeck(text) {
  const lines = String(text).split("\n").map(l => l.trim()).filter(Boolean);
  const map = new Map();

  for (const line of lines) {
    const m = line.match(/^(\d+)\s*(?:[x×])?\s+(.+)$/i);
    if (!m) continue;

    const count = Number(m[1]);
    const name = (m[2] || "").trim();
    if (!name) continue;

    const lower = name.toLowerCase();
    if (
      lower === "sideboard" || lower === "sideboard:" ||
      lower === "main" || lower === "main:" ||
      lower === "deck" || lower === "deck:"
    ) continue;

    map.set(name, (map.get(name) ?? 0) + count);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base", numeric: true }))
    .map(([name, total]) => ({ name, total, left: total }));
}

function totalLeft(deck) {
  return deck.reduce((s, c) => s + c.left, 0);
}

function nextDrawPct(cardLeft, deckLeft) {
  if (!deckLeft || deckLeft <= 0) return 0;
  return (cardLeft / deckLeft) * 100;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function getCardsPlayedThisGame() {
  if (yourCardsPlayedThisGame.length) return yourCardsPlayedThisGame.slice();
  if (!deckYou.length) return [];
  return deckYou
    .filter(c => c.total > c.left)
    .map(c => ({ name: c.name, count: c.total - c.left }));
}

function getOpponentCardsPlayedThisGame() {
  return opponentCardsPlayedThisGame.slice();
}

async function recordGame(result) {
  const cardsPlayed = getCardsPlayedThisGame();
  const opponentCardsPlayed = getOpponentCardsPlayedThisGame();
  const opponentHeroEl = $("opponent-hero");
  const gamePayload = {
    date: new Date().toISOString(),
    result,
    cardsPlayed,
    deckName: getPresetById($("preset-you").value)?.name ?? null,
    playerName: myName || null,
    opponentCardsPlayed,
    battlefield: currentBattlefield || null,
    opponentHero: opponentHeroEl && opponentHeroEl.value ? opponentHeroEl.value : null,
    turnCount: currentTurnCount ?? null
  };

  const games = await loadGames();
  games.push(gamePayload);
  await saveGames(games);

  yourCardsPlayedThisGame.length = 0;
  opponentCardsPlayedThisGame.length = 0;
  currentBattlefield = null;
  currentTurnCount = null;
  updateRecordedCount();
  updateGameMetaDisplay();
  renderAll();

  submitGameToSupabase(gamePayload).catch((err) => {
    console.warn("[Riftbound] Supabase submit failed:", err);
    const el = $("supabase-status");
    if (el) { el.textContent = "Sync failed"; el.classList.add("supabase-err"); }
  });
}

async function submitGameToSupabase(gamePayload) {
  const { url, key } = await loadSupabaseConfig();
  if (!url || !key) return;

  const playedAt = gamePayload.date ? new Date(gamePayload.date).toISOString() : new Date().toISOString();
  const gameRow = {
    player_name: gamePayload.playerName || "",
    result: gamePayload.result,
    deck_name: gamePayload.deckName || null,
    battlefield: gamePayload.battlefield || null,
    legendary: null,
    opponent_legend: gamePayload.opponentHero || null,
    turn_count: gamePayload.turnCount ?? null,
    played_at: playedAt
  };

  const res = await fetch(url.replace(/\/$/, "") + "/rest/v1/games", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": "Bearer " + key,
      "Prefer": "return=representation"
    },
    body: JSON.stringify(gameRow)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(res.status + " " + text);
  }
  const inserted = await res.json();
  const gameId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
  if (gameId == null) throw new Error("No game id returned");

  const cardRows = [];
  (gamePayload.cardsPlayed || []).forEach((c) => {
    cardRows.push({ game_id: gameId, side: "you", card_name: c.name || "", count: Math.max(1, Number(c.count) || 1) });
  });
  (gamePayload.opponentCardsPlayed || []).forEach((c) => {
    cardRows.push({ game_id: gameId, side: "opp", card_name: c.name || "", count: Math.max(1, Number(c.count) || 1) });
  });
  if (cardRows.length) {
    const cardRes = await fetch(url.replace(/\/$/, "") + "/rest/v1/game_cards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": "Bearer " + key
      },
      body: JSON.stringify(cardRows)
    });
    if (!cardRes.ok) {
      const text = await cardRes.text();
      throw new Error("game_cards " + cardRes.status + " " + text);
    }
  }

  const el = $("supabase-status");
  if (el) { el.textContent = "Synced"; el.classList.remove("supabase-err"); }
}

function updateGameMetaDisplay() {
  const el = $("game-meta");
  if (!el) return;
  const parts = [];
  if (currentBattlefield) parts.push("Battlefield: " + currentBattlefield);
  if (currentTurnCount != null) parts.push("Turns: " + currentTurnCount);
  if (yourCardsPlayedThisGame.length) parts.push("Your cards: " + yourCardsPlayedThisGame.length);
  if (opponentCardsPlayedThisGame.length) parts.push("Opp cards: " + opponentCardsPlayedThisGame.length);
  el.textContent = parts.length ? parts.join(" · ") : "";
}

function updateRecordedCount() {
  loadGames().then(games => {
    const el = $("recorded-count");
    if (el) el.textContent = games.length ? `Recorded: ${games.length} games` : "";
  });
}

function exportData() {
  loadGames().then(games => {
    const payload = { exportedAt: new Date().toISOString(), games };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `riftbound-stats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

// ---------- State ----------
let deckYou = [];
let deckOpp = [];
let filterYou = "";
let filterOpp = "";
let oppHand = 0;
let myName = "";
let currentBattlefield = null;
let currentTurnCount = null;
let yourCardsPlayedThisGame = [];
let opponentCardsPlayedThisGame = [];

// ---------- Render ----------
function renderYou() {
  const deckWrap = $("your-deck-wrap");
  const fromLogWrap = $("your-cards-from-log-wrap");
  const listFromLog = $("list-you-from-log");
  const statsEl = $("stats-you");

  if (deckYou.length > 0) {
    const deckLeft = totalLeft(deckYou);
    if (statsEl) statsEl.textContent = `Cards left: ${deckLeft}`;
    if (deckWrap) deckWrap.classList.remove("hidden");
    if (fromLogWrap) fromLogWrap.classList.add("hidden");

    const list = $("list-you");
    list.innerHTML = "";
    const f = filterYou.trim().toLowerCase();
    const shown = f ? deckYou.filter(c => c.name.toLowerCase().includes(f)) : deckYou;

    for (const c of shown) {
      const tr = document.createElement("tr");
      const tdName = document.createElement("td");
      tdName.className = "cardname";
      tdName.textContent = c.name;
      if (c.left <= 0) tdName.classList.add("crossed");
      const tdLeft = document.createElement("td");
      tdLeft.className = "num";
      tdLeft.textContent = `${c.left} / ${c.total}`;
      const tdPct = document.createElement("td");
      tdPct.className = "num";
      const pct = nextDrawPct(c.left, deckLeft);
      const pctSpan = document.createElement("span");
      pctSpan.className = `pct ${heatClass(pct)}`;
      pctSpan.textContent = pct.toFixed(0) + "%";
      tdPct.appendChild(pctSpan);
      const tdMinus = document.createElement("td");
      tdMinus.className = "num";
      const bMinus = document.createElement("button");
      bMinus.className = "btn";
      bMinus.textContent = "-";
      bMinus.addEventListener("click", () => { if (c.left <= 0) return; c.left -= 1; renderAll(); });
      tdMinus.appendChild(bMinus);
      const tdPlus = document.createElement("td");
      tdPlus.className = "num";
      const bPlus = document.createElement("button");
      bPlus.className = "btn";
      bPlus.textContent = "+";
      bPlus.addEventListener("click", () => { if (c.left >= c.total) return; c.left += 1; renderAll(); });
      tdPlus.appendChild(bPlus);
      tr.appendChild(tdName); tr.appendChild(tdLeft); tr.appendChild(tdPct); tr.appendChild(tdMinus); tr.appendChild(tdPlus);
      list.appendChild(tr);
    }
  } else {
    if (deckWrap) deckWrap.classList.add("hidden");
    if (yourCardsPlayedThisGame.length > 0) {
      if (statsEl) statsEl.textContent = "Your cards played (from log): " + yourCardsPlayedThisGame.length + " card types";
      if (fromLogWrap) {
        fromLogWrap.classList.remove("hidden");
        if (listFromLog) {
          listFromLog.innerHTML = "";
          const f = filterYou.trim().toLowerCase();
          const shown = f ? yourCardsPlayedThisGame.filter(c => c.name.toLowerCase().includes(f)) : yourCardsPlayedThisGame;
          for (const c of shown) {
            const tr = document.createElement("tr");
            tr.innerHTML = "<td class=\"cardname\">" + escapeHtml(c.name) + "</td><td class=\"num\">" + c.count + "</td>";
            listFromLog.appendChild(tr);
          }
        }
      }
    } else {
      if (statsEl) statsEl.textContent = "No deck loaded. Paste list or play cards on tcg-arena (log will fill this).";
      if (fromLogWrap) fromLogWrap.classList.add("hidden");
    }
  }
}

function renderOpp() {
  const deckLeft = totalLeft(deckOpp);
  $("stats-opp").textContent = deckOpp.length ? `Cards left: ${deckLeft} | Hand: ${oppHand}` : "";

  const list = $("list-opp");
  list.innerHTML = "";

  const f = filterOpp.trim().toLowerCase();
  const shown = f ? deckOpp.filter(c => c.name.toLowerCase().includes(f)) : deckOpp;

  for (const c of shown) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "cardname";
    tdName.textContent = c.name;
    if (c.left <= 0) tdName.classList.add("crossed");

    const tdLeft = document.createElement("td");
    tdLeft.className = "num";
    tdLeft.textContent = `${c.left} / ${c.total}`;

    const td1 = document.createElement("td");
    td1.className = "num";
    const p1 = probAtLeastKInHand(deckLeft, c.left, oppHand, 1) * 100;
    const s1 = document.createElement("span");
    s1.className = `pct ${heatClass(p1)}`;
    s1.textContent = p1.toFixed(0) + "%";
    td1.appendChild(s1);

    const td2 = document.createElement("td");
    td2.className = "num";
    const p2 = probAtLeastKInHand(deckLeft, c.left, oppHand, 2) * 100;
    const s2 = document.createElement("span");
    s2.className = `pct ${heatClass(p2)}`;
    s2.textContent = p2.toFixed(0) + "%";
    td2.appendChild(s2);

    const td3 = document.createElement("td");
    td3.className = "num";
    const p3 = probAtLeastKInHand(deckLeft, c.left, oppHand, 3) * 100;
    const s3 = document.createElement("span");
    s3.className = `pct ${heatClass(p3)}`;
    s3.textContent = p3.toFixed(0) + "%";
    td3.appendChild(s3);

    const tdMinus = document.createElement("td");
    tdMinus.className = "num";
    const bMinus = document.createElement("button");
    bMinus.className = "btn";
    bMinus.textContent = "-";
    bMinus.addEventListener("click", () => {
      if (c.left <= 0) return;
      c.left -= 1;
      renderAll();
    });
    tdMinus.appendChild(bMinus);

    const tdPlus = document.createElement("td");
    tdPlus.className = "num";
    const bPlus = document.createElement("button");
    bPlus.className = "btn";
    bPlus.textContent = "+";
    bPlus.addEventListener("click", () => {
      if (c.left >= c.total) return;
      c.left += 1;
      renderAll();
    });
    tdPlus.appendChild(bPlus);

    tr.appendChild(tdName);
    tr.appendChild(tdLeft);
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(tdMinus);
    tr.appendChild(tdPlus);

    list.appendChild(tr);
  }
}

function renderAll() {
  oppHand = clamp(oppHand, 0, totalLeft(deckOpp));
  renderYou();
  renderOpp();
  updateDeleteButtons();
}

// ---------- UI wiring ----------
function applyPresetTo(which) {
  const selectId = which === "you" ? "preset-you" : "preset-opp";
  const inputId = which === "you" ? "input-you" : "input-opp";

  const presetId = $(selectId).value;
  const preset = getPresetById(presetId);
  if (!preset) return;

  $(inputId).value = preset.list;

  if (which === "you") {
    deckYou = parseDeck(preset.list);
  } else {
    deckOpp = parseDeck(preset.list);
    oppHand = clamp(oppHand, 0, totalLeft(deckOpp));
  }
  renderAll();
}

async function createPresetFrom(which) {
  const nameId = which === "you" ? "new-preset-name-you" : "new-preset-name-opp";
  const inputId = which === "you" ? "input-you" : "input-opp";
  const selectId = which === "you" ? "preset-you" : "preset-opp";

  const name = ($(nameId).value || "").trim();
  const list = ($(inputId).value || "").trim();

  if (!name) { alert("Please enter a preset name."); return; }
  if (!list) { alert("Please paste a decklist first."); return; }

  const parsed = parseDeck(list);
  if (!parsed.length) { alert("Decklist format not recognised. Use lines like: 3x Card Name"); return; }

  const newPreset = { id: makeCustomId(name), name, list, isCustom: true };
  customPresets = [newPreset, ...customPresets];

  rebuildAllPresets();
  fillPresetSelect($("preset-you"));
  fillPresetSelect($("preset-opp"));
  await saveCustomPresets(customPresets);

  $(selectId).value = newPreset.id;
  $(nameId).value = "";

  applyPresetTo(which);
}

async function deleteSelectedPreset(which) {
  const selectId = which === "you" ? "preset-you" : "preset-opp";
  const id = $(selectId).value;
  const preset = getPresetById(id);
  if (!preset || !preset.isCustom) return;

  customPresets = customPresets.filter(p => p.id !== id);
  rebuildAllPresets();
  fillPresetSelect($("preset-you"));
  fillPresetSelect($("preset-opp"));
  await saveCustomPresets(customPresets);

  $(selectId).value = "";
  updateDeleteButtons();
}

function updateDeleteButtons() {
  const py = getPresetById($("preset-you").value);
  const po = getPresetById($("preset-opp").value);
  $("delete-preset-you").disabled = !(py && py.isCustom);
  $("delete-preset-opp").disabled = !(po && po.isCustom);
}

function fillOpponentHeroSelect(selectEl) {
  if (!selectEl) return;
  const first = selectEl.querySelector("option");
  selectEl.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Opponent hero (optional)";
  selectEl.appendChild(empty);
  for (const h of OPPONENT_HEROES) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    selectEl.appendChild(opt);
  }
}

// Event Listener
$("use-preset-you").addEventListener("click", () => applyPresetTo("you"));
$("use-preset-opp").addEventListener("click", () => applyPresetTo("opp"));

$("new-preset-you").addEventListener("click", () => createPresetFrom("you"));
$("new-preset-opp").addEventListener("click", () => createPresetFrom("opp"));

$("delete-preset-you").addEventListener("click", () => deleteSelectedPreset("you"));
$("delete-preset-opp").addEventListener("click", () => deleteSelectedPreset("opp"));

$("preset-you").addEventListener("change", updateDeleteButtons);
$("preset-opp").addEventListener("change", updateDeleteButtons);

$("start-you").addEventListener("click", () => {
  deckYou = parseDeck($("input-you").value);
  if (!deckYou.length) { alert("Could not read your decklist. Use lines like: 3x Card Name"); return; }
  renderAll();
});

$("start-opp").addEventListener("click", () => {
  deckOpp = parseDeck($("input-opp").value);
  if (!deckOpp.length) { alert("Could not read opponent decklist. Use lines like: 2x Card Name"); return; }
  oppHand = clamp(oppHand, 0, totalLeft(deckOpp));
  renderAll();
});

$("search-you").addEventListener("input", (e) => { filterYou = e.target.value ?? ""; renderYou(); });
$("search-opp").addEventListener("input", (e) => { filterOpp = e.target.value ?? ""; renderOpp(); });

$("hand-minus").addEventListener("click", () => { oppHand = clamp(oppHand - 1, 0, totalLeft(deckOpp)); renderOpp(); });
$("hand-plus").addEventListener("click", () => { oppHand = clamp(oppHand + 1, 0, totalLeft(deckOpp)); renderOpp(); });

$("record-win").addEventListener("click", () => recordGame("win"));
$("record-loss").addEventListener("click", () => recordGame("loss"));
$("export-data").addEventListener("click", exportData);

const openStatsEl = $("open-stats");
if (openStatsEl) {
  openStatsEl.href = chrome.runtime.getURL("stats.html");
}

$("reset").addEventListener("click", () => {
  deckYou = [];
  deckOpp = [];
  filterYou = "";
  filterOpp = "";
  oppHand = 0;
  currentBattlefield = null;
  currentTurnCount = null;
  yourCardsPlayedThisGame = [];
  opponentCardsPlayedThisGame = [];

  $("input-you").value = "";
  $("input-opp").value = "";
  $("search-you").value = "";
  $("search-opp").value = "";
  $("hand-value").textContent = "0";
  $("preset-you").value = "";
  $("preset-opp").value = "";
  $("new-preset-name-you").value = "";
  $("new-preset-name-opp").value = "";
  const oppHero = $("opponent-hero");
  if (oppHero) oppHero.value = "";

  updateGameMetaDisplay();
  renderAll();
});

// Save my name as you type (debounced)
let myNameTimer = null;
$("my-name").addEventListener("input", () => {
  const v = $("my-name").value.toString();
  myName = v.trim();

  if (myNameTimer) clearTimeout(myNameTimer);
  myNameTimer = setTimeout(async () => {
    await saveMyName(myName);
    chrome.runtime.sendMessage({ type: "rb_ping_tabs" });
  }, 350);
});

// Receive observer events
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "rb_log_status") {
    $("auto-status").textContent = msg.ok ? "Auto log: on" : "Auto log: off";
    return;
  }

  if (msg.type === "rb_battlefield") {
    currentBattlefield = msg.battlefield || null;
    updateGameMetaDisplay();
    return;
  }

  if (msg.type === "rb_turn_count") {
    const n = typeof msg.turnCount === "number" ? msg.turnCount : null;
    if (n != null && n >= 1 && n <= 999) currentTurnCount = n;
    updateGameMetaDisplay();
    return;
  }

  if (msg.type === "rb_log_event") {
    const { side, delta, cardName } = msg;
    if (delta === -1 && cardName) {
      if (side === "you") {
        const existing = yourCardsPlayedThisGame.find(c => normName(c.name) === normName(cardName));
        if (existing) existing.count += 1;
        else yourCardsPlayedThisGame.push({ name: cardName, count: 1 });
        updateGameMetaDisplay();
      } else if (side === "opp") {
        const existing = opponentCardsPlayedThisGame.find(c => normName(c.name) === normName(cardName));
        if (existing) existing.count += 1;
        else opponentCardsPlayedThisGame.push({ name: cardName, count: 1 });
        updateGameMetaDisplay();
      }
    }

    if (delta !== -1) return;

    const targets = side === "you" ? ["you"] : side === "opp" ? ["opp"] : ["opp", "you"];

    for (const t of targets) {
      const deck = t === "you" ? deckYou : deckOpp;
      if (!deck || !deck.length) continue;

      const card = findCard(deck, cardName);
      if (!card) continue;

      const next = card.left + delta;
      if (next < 0 || next > card.total) return;

      card.left = next;
      renderAll();
      return;
    }
    if (side === "you" || side === "opp") renderAll();
    return;
  }
});

// ---------- Init ----------
(async () => {
  customPresets = await loadCustomPresets();
  rebuildAllPresets();
  fillPresetSelect($("preset-you"));
  fillPresetSelect($("preset-opp"));
  updateDeleteButtons();

  myName = await loadMyName();
  $("my-name").value = myName;

  chrome.runtime.sendMessage({ type: "rb_ping_tabs" });

  fillOpponentHeroSelect($("opponent-hero"));
  updateRecordedCount();
  updateGameMetaDisplay();

  const supabaseUrlEl = $("supabase-url");
  const supabaseKeyEl = $("supabase-key");
  loadSupabaseConfig().then(({ url, key }) => {
    if (supabaseUrlEl) supabaseUrlEl.value = url;
    if (supabaseKeyEl) supabaseKeyEl.value = key;
  });
  $("supabase-save").addEventListener("click", async () => {
    const url = (supabaseUrlEl && supabaseUrlEl.value || "").trim();
    const key = (supabaseKeyEl && supabaseKeyEl.value || "").trim();
    await saveSupabaseConfig(url, key);
    const st = $("supabase-status");
    if (st) { st.textContent = url && key ? "Saved" : ""; st.classList.remove("supabase-err"); }
  });

  renderAll();
})();