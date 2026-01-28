const $ = (id) => document.getElementById(id);

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

async function saveGames(games) {
  await chrome.storage.local.set({ [STORAGE_KEY_GAMES]: games });
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

/** Snapshot of cards played this game from "your deck" (total - left for each). */
function getCardsPlayedThisGame() {
  if (!deckYou.length) return [];
  return deckYou
    .filter(c => c.total > c.left)
    .map(c => ({ name: c.name, count: c.total - c.left }));
}

async function recordGame(result) {
  const cardsPlayed = getCardsPlayedThisGame();
  const games = await loadGames();
  games.push({
    date: new Date().toISOString(),
    result,
    cardsPlayed,
    deckName: getPresetById($("preset-you").value)?.name ?? null
  });
  await saveGames(games);
  updateRecordedCount();
  renderAll();
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

// ---------- Render ----------
function renderYou() {
  const deckLeft = totalLeft(deckYou);
  $("stats-you").textContent = deckYou.length ? `Cards left: ${deckLeft}` : "";

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
    tr.appendChild(tdPct);
    tr.appendChild(tdMinus);
    tr.appendChild(tdPlus);

    list.appendChild(tr);
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

  $("input-you").value = "";
  $("input-opp").value = "";
  $("search-you").value = "";
  $("search-opp").value = "";
  $("hand-value").textContent = "0";
  $("preset-you").value = "";
  $("preset-opp").value = "";
  $("new-preset-name-you").value = "";
  $("new-preset-name-opp").value = "";

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

  if (msg.type !== "rb_log_event") return;

  const { side, delta, cardName } = msg;
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

  updateRecordedCount();
  renderAll();
})();