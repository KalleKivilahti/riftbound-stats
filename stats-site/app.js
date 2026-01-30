(function () {
  "use strict";

  const STORAGE_KEY = "riftbound_stats_data";
  const DEFAULT_SUPABASE_URL = "https://hmdboowggoinfxgttrum.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZGJvb3dnZ29pbmZ4Z3R0cnVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODQ2MjYsImV4cCI6MjA4NTI2MDYyNn0.o7U9TggOZIbt8-duT85pXAMjxHnM5WpgMgIXKVUUOIw";

  const $ = (id) => document.getElementById(id);
  const errorEl = $("error");
  const dashboard = $("dashboard");
  const emptyState = $("empty-state");
  const cardBody = $("card-body");
  const cardSearch = $("card-search");
  const dayBarsEl = $("day-bars");
  const winrateOverTime = $("winrate-over-time");

const LEGENDS = [
  "Azir","Irelia", "Fiora", "Ezreal", "Lucian", "Rumble", "Ornn",
  "Annie", "Master Yi", "Lux", "Garen", "Ahri", "Darius",
  "Jinx", "Kai'Sa", "Lee Sin", "Miss Fortune", "Sett", "Teemo",
  "Viktor", "Volibear", "Yasuo", "Leona", "Draven", "Jax", "Rek'Sai",
  "Sivir", "Renata Glasc"
];

  let currentData = null;
  let currentStats = null;
  let sortKey = "gamesPlayed";
  let sortDir = "desc";
  let filterQuery = "";
  let filterPlayerInclude = "";
  let filterPlayerExclude = "";
  let filterOpponentHero = "";
  let filterBattlefield = "";
let filterPlayerLegend = "";
  let oppCardFilterQuery = "";

  function setError(msg) {
    if (errorEl) errorEl.textContent = msg || "";
  }

  function setEmptyStateMessage(msg) {
    if (!emptyState) return;
    const p = emptyState.querySelector("p");
    if (p) p.textContent = msg || "";
  }

  function getSupabaseConfig() {
    return {
      url: (DEFAULT_SUPABASE_URL || "").trim(),
      key: (DEFAULT_SUPABASE_ANON_KEY || "").trim()
    };
  }

  async function fetchFromSupabase() {
    const { url, key } = getSupabaseConfig();
    if (!url || !key) return null;
    const base = url.replace(/\/$/, "");
    const headers = { apikey: key, Authorization: "Bearer " + key };
    const gamesRes = await fetch(base + "/rest/v1/games?select=*&order=played_at.asc", { headers });
    if (!gamesRes.ok) throw new Error("Games: " + gamesRes.status);
    const apiGames = await gamesRes.json();
    const cardsRes = await fetch(base + "/rest/v1/game_cards?select=*", { headers });
    if (!cardsRes.ok) throw new Error("Game cards: " + cardsRes.status);
    const apiCards = await cardsRes.json();
    const gamesById = {};
    for (const g of apiGames || []) {
      gamesById[g.id] = {
        playerName: g.player_name || "",
        result: g.result || "",
        deckName: g.deck_name || null,
        battlefield: g.battlefield || null,
        playerLegend: g.legendary || null,
        opponentHero: g.opponent_legend || null,
        turnCount: g.turn_count != null ? g.turn_count : null,
        date: g.played_at ? new Date(g.played_at).toISOString() : "",
        cardsPlayed: [],
        opponentCardsPlayed: []
      };
    }
    for (const c of apiCards || []) {
      const game = gamesById[c.game_id];
      if (!game) continue;
      const entry = { name: c.card_name || "", count: Math.max(1, Number(c.count) || 1) };
      if (c.side === "you") game.cardsPlayed.push(entry);
      else game.opponentCardsPlayed.push(entry);
    }
    const games = Object.values(gamesById).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return { games };
  }

  function parsePayload(raw) {
    let data;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      setError("Invalid JSON: " + (e.message || "parse error"));
      return null;
    }
    if (!data || !Array.isArray(data.games)) {
      setError("Expected object with 'games' array.");
      return null;
    }
    return data;
  }

  function wrClass(pct) {
    if (pct >= 55) return "wr-good";
    if (pct >= 45) return "wr-mid";
    return "wr-bad";
  }

  function normPlayer(s) {
    return String(s || "").toLowerCase().trim();
  }

  function getFilteredGames(games) {
    if (!Array.isArray(games)) return [];
    let list = games.slice();
    const includeList = filterPlayerInclude.split(",").map((s) => normPlayer(s)).filter(Boolean);
    const excludeList = filterPlayerExclude.split(",").map((s) => normPlayer(s)).filter(Boolean);
    if (includeList.length) list = list.filter((g) => includeList.includes(normPlayer(g.playerName)));
    if (excludeList.length) list = list.filter((g) => !excludeList.includes(normPlayer(g.playerName)));
    if (filterPlayerLegend) list = list.filter((g) => (g.playerLegend || "") === filterPlayerLegend);
    if (filterOpponentHero) list = list.filter((g) => (g.opponentHero || "") === filterOpponentHero);
    if (filterBattlefield) list = list.filter((g) => (g.battlefield || "") === filterBattlefield);
    return list;
  }

  function buildStats(games) {
    const filtered = getFilteredGames(games);
    const wins = filtered.filter((g) => g.result === "win").length;
    const total = filtered.length;
    const byCard = new Map();
    for (const game of filtered) {
      const isWin = game.result === "win";
      const cards = game.cardsPlayed || [];
      for (const entry of cards) {
        const name = (entry.name || "").trim();
        if (!name) continue;
        if (!byCard.has(name)) byCard.set(name, { gamesPlayed: 0, winsWhenPlayed: 0 });
        const rec = byCard.get(name);
        rec.gamesPlayed += 1;
        if (isWin) rec.winsWhenPlayed += 1;
      }
    }
    const rows = Array.from(byCard.entries()).map(([name, rec]) => ({
      name,
      gamesPlayed: rec.gamesPlayed,
      winsWhenPlayed: rec.winsWhenPlayed,
      winrate: rec.gamesPlayed ? (100 * rec.winsWhenPlayed) / rec.gamesPlayed : 0
    }));
    return { total, wins, rows };
  }

  function timesPlayedBucket(count) {
    const n = Math.max(0, Number(count) || 0);
    if (n <= 1) return "1x";
    if (n === 2) return "2x";
    return "3x+";
  }

  function buildOpponentCardStats(games) {
    const filtered = getFilteredGames(games);
    const byKey = new Map();
    for (const game of filtered) {
      const isWin = game.result === "win";
      const cards = game.opponentCardsPlayed || [];
      for (const entry of cards) {
        const name = (entry.name || "").trim();
        if (!name) continue;
        const bucket = timesPlayedBucket(entry.count);
        const key = name + "\n" + bucket;
        if (!byKey.has(key)) byKey.set(key, { cardName: name, timesPlayed: bucket, gamesPlayed: 0, winsWhenPlayed: 0 });
        const rec = byKey.get(key);
        rec.gamesPlayed += 1;
        if (isWin) rec.winsWhenPlayed += 1;
      }
    }
    return Array.from(byKey.values())
      .map((rec) => ({
        name: rec.cardName,
        timesPlayed: rec.timesPlayed,
        gamesPlayed: rec.gamesPlayed,
        winsWhenPlayed: rec.winsWhenPlayed,
        winrate: rec.gamesPlayed ? (100 * rec.winsWhenPlayed) / rec.gamesPlayed : 0
      }))
      .sort((a, b) => {
        const nameCmp = (a.name || "").localeCompare(b.name || "");
        if (nameCmp !== 0) return nameCmp;
        const order = { "1x": 0, "2x": 1, "3x+": 2 };
        return (order[a.timesPlayed] ?? 0) - (order[b.timesPlayed] ?? 0);
      });
  }

  function buildTurnStats(games) {
    const filtered = getFilteredGames(games).filter((g) => g.turnCount != null && g.turnCount >= 1);
    if (!filtered.length) return null;
    const wins = filtered.filter((g) => g.result === "win");
    const losses = filtered.filter((g) => g.result === "loss");
    const avgTurnsWin = wins.length ? wins.reduce((s, g) => s + g.turnCount, 0) / wins.length : null;
    const avgTurnsLoss = losses.length ? losses.reduce((s, g) => s + g.turnCount, 0) / losses.length : null;
    const avgTurnsAll = filtered.reduce((s, g) => s + g.turnCount, 0) / filtered.length;
    return { avgTurnsWin, avgTurnsLoss, avgTurnsAll, gamesWithTurns: filtered.length };
  }

  function buildDayStats(games) {
    const filtered = getFilteredGames(games);
    const byDay = new Map();
    for (const game of filtered) {
      const dateStr = game.date ? game.date.slice(0, 10) : "";
      if (!dateStr) continue;
      if (!byDay.has(dateStr)) byDay.set(dateStr, { wins: 0, total: 0 });
      const d = byDay.get(dateStr);
      d.total += 1;
      if (game.result === "win") d.wins += 1;
    }
    return Array.from(byDay.entries())
      .map(([date, d]) => ({ date, ...d, wr: d.total ? (100 * d.wins) / d.total : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function renderOverview(stats) {
    const totalEl = $("total-games");
    const winsEl = $("total-wins");
    const wrEl = $("overall-wr");
    if (totalEl) totalEl.textContent = stats.total;
    if (winsEl) winsEl.textContent = stats.wins;
    const wrPct = stats.total ? (100 * stats.wins) / stats.total : 0;
    if (wrEl) {
      wrEl.textContent = wrPct.toFixed(1) + "%";
      wrEl.className = "stat-value " + wrClass(wrPct);
    }
  }

  function renderDayBars(dayStats) {
    if (!dayBarsEl || !dayStats.length) return;
    dayBarsEl.innerHTML = "";
    const maxTotal = Math.max(...dayStats.map((d) => d.total), 1);
    for (const d of dayStats) {
      const bar = document.createElement("div");
      bar.className = "day-bar";
      bar.style.height = (d.total / maxTotal) * 100 + "%";
      bar.style.backgroundColor = d.wr >= 55 ? "var(--green)" : d.wr >= 45 ? "var(--amber)" : "var(--red)";
      const tooltip = document.createElement("span");
      tooltip.className = "day-tooltip";
      tooltip.textContent = d.date + " · " + d.wins + "W / " + d.total + " · " + d.wr.toFixed(0) + "%";
      bar.appendChild(tooltip);
      dayBarsEl.appendChild(bar);
    }
  }

  function getSortedFilteredRows() {
    if (!currentStats || !currentStats.rows) return [];
    let rows = currentStats.rows.slice();
    if (filterQuery.trim()) {
      const q = filterQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (sortKey === "name") {
        va = (va || "").toLowerCase();
        vb = (vb || "").toLowerCase();
        return sortDir === "asc" ? (va > vb ? 1 : -1) : (vb > va ? 1 : -1);
      }
      return sortDir === "asc" ? (va - vb) : (vb - va);
    });
    return rows;
  }

  function renderTable() {
    const rows = getSortedFilteredRows();
    if (!cardBody) return;
    cardBody.innerHTML = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td class=\"col-name\">" + escapeHtml(row.name) +
        "</td><td class=\"col-num\">" + row.gamesPlayed +
        "</td><td class=\"col-num\">" + row.winsWhenPlayed +
        "</td><td class=\"col-num " + wrClass(row.winrate) + "\">" + row.winrate.toFixed(1) + "%</td>";
      cardBody.appendChild(tr);
    }
  }

  function updateSortUI() {
    document.querySelectorAll(".card-table th.sortable").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === sortKey) th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
    });
  }

  function populateLegendSelect(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "<option value=\"\">Any</option>";
    LEGENDS.forEach((h) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      selectEl.appendChild(opt);
    });
  }

  function fillFilterSelects(games) {
    const heroSelect = $("filter-opponent-hero");
    const playerLegendSelect = $("filter-player-legend");
    const bfSelect = $("filter-battlefield");
    populateLegendSelect(heroSelect);
    populateLegendSelect(playerLegendSelect);
    if (bfSelect) {
      const battlefields = new Set();
      (games || []).forEach((g) => { if (g.battlefield) battlefields.add(g.battlefield); });
      bfSelect.innerHTML = "<option value=\"\">Any</option>";
      Array.from(battlefields).sort().forEach((bf) => {
        const opt = document.createElement("option");
        opt.value = bf;
        opt.textContent = bf;
        bfSelect.appendChild(opt);
      });
    }
  }

  function renderOpponentCardTable() {
    if (!currentData || !currentData.games) return;
    const oppRows = buildOpponentCardStats(currentData.games);
    const tbody = $("opp-card-body");
    if (!tbody) return;
    let rows = oppRows;
    if (oppCardFilterQuery.trim()) {
      const q = oppCardFilterQuery.trim().toLowerCase();
      rows = rows.filter((r) => (r.name || "").toLowerCase().includes(q));
    }
    tbody.innerHTML = "";
    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td class=\"col-name\">" + escapeHtml(row.name) + "</td>" +
        "<td class=\"col-num\">" + escapeHtml(row.timesPlayed || "") + "</td>" +
        "<td class=\"col-num\">" + row.gamesPlayed + "</td>" +
        "<td class=\"col-num\">" + row.winsWhenPlayed + "</td>" +
        "<td class=\"col-num " + wrClass(row.winrate) + "\">" + row.winrate.toFixed(1) + "%</td>";
      tbody.appendChild(tr);
    }
  }

  function renderTurnStats() {
    if (!currentData || !currentData.games) return;
    const turnStats = buildTurnStats(currentData.games);
    const wrap = $("turn-stats");
    const content = $("turn-stats-content");
    if (!wrap || !content) return;
    if (!turnStats || !turnStats.gamesWithTurns) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    const parts = [];
    parts.push("Games with turn data: " + turnStats.gamesWithTurns);
    if (turnStats.avgTurnsWin != null) parts.push("Avg turns when you won: " + turnStats.avgTurnsWin.toFixed(1));
    if (turnStats.avgTurnsLoss != null) parts.push("Avg turns when you lost: " + turnStats.avgTurnsLoss.toFixed(1));
    parts.push("Avg turns (all): " + turnStats.avgTurnsAll.toFixed(1));
    content.textContent = parts.join(" · ");
  }

  function render() {
    if (!currentStats) return;
    setError("");
    if (dashboard) dashboard.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");

    renderOverview(currentStats);

    const dayStats = buildDayStats(currentData.games);
    if (dayStats.length > 0) {
      if (winrateOverTime) {
        winrateOverTime.classList.remove("hidden");
        renderDayBars(dayStats);
      }
    } else {
      if (winrateOverTime) winrateOverTime.classList.add("hidden");
    }

    renderTurnStats();
    renderTable();
    renderOpponentCardTable();
    updateSortUI();
  }

  function runWithPayload(data) {
    if (!data || !Array.isArray(data.games)) return;
    currentData = data;
    fillFilterSelects(data.games || []);
    currentStats = buildStats(data.games);
    if (data.games.length === 0) {
      setError("No games in this data.");
      if (dashboard) dashboard.classList.add("hidden");
      if (emptyState) {
        emptyState.classList.remove("hidden");
        setEmptyStateMessage("No games yet. Record wins/losses in the Tracker to see stats here.");
      }
      return;
    }
    setError("");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
    if (dashboard) dashboard.classList.remove("hidden");
    if (emptyState) emptyState.classList.add("hidden");
    render();
  }

  function run(raw) {
    const data = parsePayload(raw);
    if (!data) return;
    runWithPayload(data);
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) run(raw);
    } catch (e) {}
  }

  async function loadData() {
    setError("");
    setEmptyStateMessage("Loading from Supabase…");
    if (dashboard) dashboard.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");

    try {
      const payload = await fetchFromSupabase();
      if (payload !== null && payload.games && payload.games.length >= 0) {
        runWithPayload(payload);
        return;
      }
    } catch (e) {
      setError("Supabase: " + (e.message || "failed. Trying stored data."));
    }

    setEmptyStateMessage("No data from Supabase. Record games in the Tracker or import JSON on the Import page.");
    loadStored();
    if (!currentData || !currentData.games || currentData.games.length === 0) {
      if (dashboard) dashboard.classList.add("hidden");
      if (emptyState) emptyState.classList.remove("hidden");
    }
  }

  function clearStored() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    currentData = null;
    currentStats = null;
    setError("");
    if (dashboard) dashboard.classList.add("hidden");
    if (emptyState) {
      emptyState.classList.remove("hidden");
      setEmptyStateMessage("Data cleared. Refresh to load from Supabase again, or import JSON.");
    }
  }

  if ($("btn-refresh")) {
    $("btn-refresh").addEventListener("click", () => loadData());
  }

  if (cardSearch) {
    cardSearch.addEventListener("input", (e) => {
      filterQuery = (e.target && e.target.value) || "";
      renderTable();
    });
  }

  const filterIncludeEl = $("filter-include-players");
  const filterExcludeEl = $("filter-exclude-players");
  const filterHeroEl = $("filter-opponent-hero");
  const filterPlayerLegendEl = $("filter-player-legend");
  const filterBfEl = $("filter-battlefield");
  function applyFiltersAndRender() {
    if (filterIncludeEl) filterPlayerInclude = (filterIncludeEl.value || "").trim();
    if (filterExcludeEl) filterPlayerExclude = (filterExcludeEl.value || "").trim();
    if (filterPlayerLegendEl) filterPlayerLegend = (filterPlayerLegendEl.value || "").trim();
    if (filterHeroEl) filterOpponentHero = (filterHeroEl.value || "").trim();
    if (filterBfEl) filterBattlefield = (filterBfEl.value || "").trim();
    if (currentData && currentStats) {
      currentStats = buildStats(currentData.games);
      render();
    }
  }
  if (filterIncludeEl) filterIncludeEl.addEventListener("input", applyFiltersAndRender);
  if (filterExcludeEl) filterExcludeEl.addEventListener("input", applyFiltersAndRender);
  if (filterHeroEl) filterHeroEl.addEventListener("change", applyFiltersAndRender);
  if (filterPlayerLegendEl) filterPlayerLegendEl.addEventListener("change", applyFiltersAndRender);
  if (filterBfEl) filterBfEl.addEventListener("change", applyFiltersAndRender);

  const oppCardSearch = $("opp-card-search");
  if (oppCardSearch) {
    oppCardSearch.addEventListener("input", (e) => {
      oppCardFilterQuery = (e.target && e.target.value) || "";
      if (currentData) renderOpponentCardTable();
    });
  }

  document.querySelectorAll(".card-table th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = key === "name" ? "asc" : "desc";
      }
      renderTable();
      updateSortUI();
    });
  });

  loadData();
})();
