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

  let currentData = null;
  let currentStats = null;
  let sortKey = "gamesPlayed";
  let sortDir = "desc";
  let filterQuery = "";

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

  function buildStats(games) {
    const wins = games.filter((g) => g.result === "win").length;
    const total = games.length;

    const byCard = new Map();
    for (const game of games) {
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

  function buildDayStats(games) {
    const byDay = new Map();
    for (const game of games) {
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

    renderTable();
    updateSortUI();
  }

  function run(raw) {
    const data = parsePayload(raw);
    if (!data) return;
    currentData = data;
    const stats = buildStats(data.games);
    if (stats.rows.length === 0) {
      setError("No card play data in this export. Record some wins/losses with cards played first.");
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
    $("btn-apply").addEventListener("click", () => run(jsonInput.value.trim()));
  }
  if ($("btn-clear-data")) {
    $("btn-clear-data").addEventListener("click", () => {
      clearStored();
    });
  }

  jsonInput.addEventListener("input", () => run(jsonInput.value.trim()));
  jsonInput.addEventListener("paste", () => setTimeout(() => run(jsonInput.value.trim()), 0));

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        jsonInput.value = r.result;
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

  var dropZone = $("drop-zone");
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
        jsonInput.value = r.result;
        run(r.result);
      };
      r.readAsText(f);
    });
  }

  loadStored();
})();
