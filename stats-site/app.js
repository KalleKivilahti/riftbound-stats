(function () {
  "use strict";

  const STORAGE_KEY = "riftbound_stats_data";

  const $ = (id) => document.getElementById(id);
  const jsonInput = $("json-input");
  const fileInput = $("file-input");
  const errorEl = $("error");
  const dashboard = $("dashboard");
  const emptyState = $("empty-state");
  const cardBody = $("card-body");
  const cardSearch = $("card-search");
  const dayBarsEl = $("day-bars");
  const winrateOverTime = $("winrate-over-time");

  const OPPONENT_HEROES = [
    "Irelia", "Fiora", "Ezreal", "Lucian", "Rumble", "Ornn",
    "Annie", "Master Yi", "Lux", "Garen", "Ahri", "Darius",
    "Jinx", "Kai'Sa", "Lee Sin", "Miss Fortune", "Sett", "Teemo",
    "Viktor", "Volibear", "Yasuo"
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
  let oppCardFilterQuery = "";

  function setError(msg) {
    if (errorEl) errorEl.textContent = msg || "";
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
      setError("Expected object with 'games' array (export from Riftbound Tracker).");
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
    if (includeList.length) {
      list = list.filter((g) => includeList.includes(normPlayer(g.playerName)));
    }
    if (excludeList.length) {
      list = list.filter((g) => !excludeList.includes(normPlayer(g.playerName)));
    }
    if (filterOpponentHero) {
      list = list.filter((g) => (g.opponentHero || "") === filterOpponentHero);
    }
    if (filterBattlefield) {
      list = list.filter((g) => (g.battlefield || "") === filterBattlefield);
    }
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
        if (!byCard.has(name)) {
          byCard.set(name, { gamesPlayed: 0, winsWhenPlayed: 0 });
        }
        const rec = byCard.get(name);
        rec.gamesPlayed += 1;
        if (isWin) rec.winsWhenPlayed += 1;
      }
    }

    const rows = Array.from(byCard.entries()).map(([name, rec]) => ({
      name,
      gamesPlayed: rec.gamesPlayed,
      winsWhenPlayed: rec.winsWhenPlayed,
      winrate: rec.gamesPlayed ? (100 * rec.winsWhenPlayed) / rec.gamesPlayed : 0,
    }));

    return { total, wins, rows };
  }

  /** Bucket: 1x, 2x, 3x+ so we see how YOUR winrate changes when they play a card 1 vs 2 vs 3+ times. */
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
        if (!byKey.has(key)) {
          byKey.set(key, { cardName: name, timesPlayed: bucket, gamesPlayed: 0, winsWhenPlayed: 0 });
        }
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
        winrate: rec.gamesPlayed ? (100 * rec.winsWhenPlayed) / rec.gamesPlayed : 0,
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
      if (!byDay.has(dateStr)) {
        byDay.set(dateStr, { wins: 0, total: 0 });
      }
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
        "<td class=\"col-name\">" +
        escapeHtml(row.name) +
        "</td><td class=\"col-num\">" +
        row.gamesPlayed +
        "</td><td class=\"col-num\">" +
        row.winsWhenPlayed +
        "</td><td class=\"col-num " +
        wrClass(row.winrate) +
        "\">" +
        row.winrate.toFixed(1) +
        "%</td>";
      cardBody.appendChild(tr);
    }
  }

  function updateSortUI() {
    document.querySelectorAll(".card-table th.sortable").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === sortKey) th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
    });
  }

  function fillFilterSelects(games) {
    const heroSelect = $("filter-opponent-hero");
    const bfSelect = $("filter-battlefield");
    if (heroSelect) {
      const heroes = new Set();
      games.forEach((g) => { if (g.opponentHero) heroes.add(g.opponentHero); });
      heroSelect.innerHTML = "<option value=\"\">Any</option>";
      OPPONENT_HEROES.forEach((h) => {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = h;
        heroSelect.appendChild(opt);
      });
    }
    if (bfSelect) {
      const battlefields = new Set();
      games.forEach((g) => { if (g.battlefield) battlefields.add(g.battlefield); });
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

  function run(raw) {
    const data = parsePayload(raw);
    if (!data) return;
    currentData = data;
    fillFilterSelects(data.games || []);
    const stats = buildStats(data.games);
    if (!data.games || data.games.length === 0) {
      setError("No games in this export. Record some wins/losses first.");
      if (dashboard) dashboard.classList.add("hidden");
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }
    currentStats = stats;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
    render();
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) run(raw);
    } catch (e) {}
  }

  function clearStored() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    currentData = null;
    currentStats = null;
    if (jsonInput) jsonInput.value = "";
    setError("");
    if (dashboard) dashboard.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
  }

  if ($("btn-apply")) {
    $("btn-apply").addEventListener("click", () => run(jsonInput && jsonInput.value.trim()));
  }
  if ($("btn-clear-data")) {
    $("btn-clear-data").addEventListener("click", () => clearStored());
  }
  if (jsonInput) {
    jsonInput.addEventListener("input", () => run(jsonInput.value.trim()));
    jsonInput.addEventListener("paste", () => setTimeout(() => run(jsonInput.value.trim()), 0));
  }
  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        if (jsonInput) jsonInput.value = r.result;
        run(r.result);
      };
      r.readAsText(f);
      fileInput.value = "";
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

  if (cardSearch) {
    cardSearch.addEventListener("input", (e) => {
      filterQuery = (e.target && e.target.value) || "";
      renderTable();
    });
  }

  const filterIncludeEl = $("filter-include-players");
  const filterExcludeEl = $("filter-exclude-players");
  const filterHeroEl = $("filter-opponent-hero");
  const filterBfEl = $("filter-battlefield");
  function applyFiltersAndRender() {
    if (filterIncludeEl) filterPlayerInclude = (filterIncludeEl.value || "").trim();
    if (filterExcludeEl) filterPlayerExclude = (filterExcludeEl.value || "").trim();
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
  if (filterBfEl) filterBfEl.addEventListener("change", applyFiltersAndRender);

  const oppCardSearch = $("opp-card-search");
  if (oppCardSearch) {
    oppCardSearch.addEventListener("input", (e) => {
      oppCardFilterQuery = (e.target && e.target.value) || "";
      if (currentData) renderOpponentCardTable();
    });
  }

  const dropZone = $("drop-zone");
  if (dropZone) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
    dropZone.addEventListener("dragover", () => dropZone.classList.add("drag-over"));
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
      dropZone.classList.remove("drag-over");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || !f.name.toLowerCase().endsWith(".json")) {
        setError("Please drop a .json file.");
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        if (jsonInput) jsonInput.value = r.result;
        run(r.result);
      };
      r.readAsText(f);
    });
  }

  loadStored();
})();
