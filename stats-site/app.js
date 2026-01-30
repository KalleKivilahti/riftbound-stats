(function () {
  "use strict";

  const STORAGE_KEY = "riftbound_stats_data";
  const DEFAULT_SUPABASE_URL = "https://hmdboowggoinfxgttrum.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY = "YOUR_KEY_HERE";

  const $ = (id) => document.getElementById(id);


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
  let minGamesFilter = 1;

  let isLoading = false;

  const dashboard = $("dashboard");
  const emptyState = $("empty-state");
  const errorEl = $("error");

  const cardBody = $("card-body");
  const cardSearch = $("card-search");
  const oppCardSearch = $("opp-card-search");

  const dayBarsEl = $("day-bars");
  const winrateOverTime = $("winrate-over-time");

  const debounce = (fn, ms = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  function setLoading(v) {
    isLoading = v;
    document.body.classList.toggle("is-loading", v);
  }

  function setError(msg) {
    if (errorEl) errorEl.textContent = msg || "";
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function wrClass(pct) {
    if (pct >= 55) return "wr-good";
    if (pct >= 45) return "wr-mid";
    return "wr-bad";
  }

  function heatStyle(pct) {
    if (pct >= 55) return "rgba(74,222,128,.12)";
    if (pct >= 45) return "rgba(251,191,36,.10)";
    return "rgba(248,113,113,.12)";
  }

  async function fetchFromSupabase() {
    const base = DEFAULT_SUPABASE_URL.replace(/\/$/, "");
    const headers = {
      apikey: DEFAULT_SUPABASE_ANON_KEY,
      Authorization: "Bearer " + DEFAULT_SUPABASE_ANON_KEY
    };

    const games = await fetch(base + "/rest/v1/games?select=*&order=played_at.asc", { headers })
      .then(r => r.json());

    const cards = await fetch(base + "/rest/v1/game_cards?select=*", { headers })
      .then(r => r.json());

    const map = {};
    for (const g of games) {
      map[g.id] = {
        result: g.result,
        playerName: g.player_name,
        opponentHero: g.opponent_legend,
        battlefield: g.battlefield,
        turnCount: g.turn_count,
        date: g.played_at,
        cardsPlayed: [],
        opponentCardsPlayed: []
      };
    }

    for (const c of cards) {
      if (!map[c.game_id]) continue;
      const entry = { name: c.card_name, count: Math.max(1, c.count || 1) };
      c.side === "you"
        ? map[c.game_id].cardsPlayed.push(entry)
        : map[c.game_id].opponentCardsPlayed.push(entry);
    }

    return { games: Object.values(map) };
  }

  function getFilteredGames() {
    if (!currentData) return [];

    return currentData.games.filter(g => {
      if (filterOpponentHero && g.opponentHero !== filterOpponentHero) return false;
      if (filterBattlefield && g.battlefield !== filterBattlefield) return false;
      return true;
    });
  }

  function buildStats() {
    const games = getFilteredGames();
    const wins = games.filter(g => g.result === "win").length;

    const byCard = new Map();

    for (const g of games) {
      for (const c of g.cardsPlayed || []) {
        if (!byCard.has(c.name)) {
          byCard.set(c.name, { games: 0, wins: 0 });
        }
        const r = byCard.get(c.name);
        r.games++;
        if (g.result === "win") r.wins++;
      }
    }

    const rows = Array.from(byCard.entries())
      .map(([name, r]) => ({
        name,
        gamesPlayed: r.games,
        winsWhenPlayed: r.wins,
        winrate: r.games ? (100 * r.wins) / r.games : 0
      }))
      .filter(r => r.gamesPlayed >= minGamesFilter);

    return { total: games.length, wins, rows };
  }


  function renderOverview() {
    const total = $("total-games");
    const wins = $("total-wins");
    const wr = $("overall-wr");

    total.textContent = currentStats.total;
    wins.textContent = currentStats.wins;

    const pct = currentStats.total
      ? (100 * currentStats.wins) / currentStats.total
      : 0;

    wr.textContent = pct.toFixed(1) + "%";
    wr.className = "stat-value " + wrClass(pct);

    wr.animate(
      [{ transform: "scale(.96)", opacity: .6 }, { transform: "none", opacity: 1 }],
      { duration: 200, easing: "ease-out" }
    );
  }

  function renderTable() {
    const rows = currentStats.rows
      .filter(r => r.name.toLowerCase().includes(filterQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortKey === "name") {
          return sortDir === "asc"
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        }
        return sortDir === "asc"
          ? a[sortKey] - b[sortKey]
          : b[sortKey] - a[sortKey];
      });

    cardBody.innerHTML = "";

    if (!rows.length) {
      cardBody.innerHTML =
        `<tr><td colspan="4" style="text-align:center;opacity:.6;padding:1.5rem">
          No cards match filters
        </td></tr>`;
      return;
    }

    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.style.background = heatStyle(r.winrate);

      tr.innerHTML = `
        <td>${escapeHtml(r.name)}</td>
        <td class="col-num">${r.gamesPlayed}</td>
        <td class="col-num">${r.winsWhenPlayed}</td>
        <td class="col-num ${wrClass(r.winrate)}">${r.winrate.toFixed(1)}%</td>
      `;
      cardBody.appendChild(tr);
    }
  }

  function renderDayBars() {
    const games = getFilteredGames();
    if (!games.length) return;

    const byDay = {};
    for (const g of games) {
      const d = g.date?.slice(0, 10);
      if (!d) continue;
      byDay[d] ??= { w: 0, t: 0 };
      byDay[d].t++;
      if (g.result === "win") byDay[d].w++;
    }

    const days = Object.entries(byDay);
    const max = Math.max(...days.map(d => d[1].t));

    dayBarsEl.innerHTML = "";

    for (const [d, s] of days) {
      const wr = (100 * s.w) / s.t;
      const bar = document.createElement("div");
      bar.className = "day-bar";
      bar.style.height = `${(s.t / max) * 100}%`;
      bar.style.background = wr >= 55 ? "var(--green)" : wr >= 45 ? "var(--amber)" : "var(--red)";
      bar.innerHTML = `<span class="day-tooltip">${d}<br>${s.w}/${s.t} · ${wr.toFixed(0)}%</span>`;
      dayBarsEl.appendChild(bar);
    }
  }

  function renderAll() {
    renderOverview();
    renderTable();
    renderDayBars();
  }

  const debouncedRender = debounce(renderAll, 120);

  cardSearch.addEventListener("input", e => {
    filterQuery = e.target.value;
    debouncedRender();
  });

  document.querySelectorAll(".card-table th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const k = th.dataset.sort;
      if (sortKey === k) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = k;
        sortDir = k === "name" ? "asc" : "desc";
      }
      renderTable();
    });
  });

  async function init() {
    setLoading(true);
    try {
      currentData = await fetchFromSupabase();
      currentStats = buildStats();
      dashboard.classList.remove("hidden");
      emptyState.classList.add("hidden");
      renderAll();
    } catch (e) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  init();
})();
