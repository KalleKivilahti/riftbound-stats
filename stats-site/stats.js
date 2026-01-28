(function () {
  const $ = (id) => document.getElementById(id);
  const jsonInput = $("json-input");
  const fileInput = $("file-input");
  const errorEl = $("error");
  const overview = $("overview");
  const cardTable = $("card-table");
  const cardBody = $("card-body");
  const totalGamesEl = $("total-games");
  const totalWinsEl = $("total-wins");
  const overallWrEl = $("overall-wr");

  function setError(msg) {
    errorEl.textContent = msg || "";
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

  function pctClass(pct) {
    if (pct >= 55) return "pct-good";
    if (pct >= 45) return "pct-mid";
    return "pct-bad";
  }

  function buildStats(games) {
    const wins = games.filter(g => g.result === "win").length;
    const total = games.length;

    const byCard = new Map();
    for (const game of games) {
      const isWin = game.result === "win";
      const cards = game.cardsPlayed || [];
      for (const entry of cards) {
        const name = (entry.name || "").trim();
        if (!name) continue;
        const count = Math.max(0, Number(entry.count) || 0);
        if (!byCard.has(name)) {
          byCard.set(name, { gamesPlayed: 0, winsWhenPlayed: 0 });
        }
        const rec = byCard.get(name);
        rec.gamesPlayed += 1;
        if (isWin) rec.winsWhenPlayed += 1;
      }
    }

    const rows = Array.from(byCard.entries())
      .map(([name, rec]) => ({
        name,
        gamesPlayed: rec.gamesPlayed,
        winsWhenPlayed: rec.winsWhenPlayed,
        winrate: rec.gamesPlayed ? (100 * rec.winsWhenPlayed / rec.gamesPlayed) : 0
      }))
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed);

    return { total, wins, rows };
  }

  function render(stats) {
    setError("");
    totalGamesEl.textContent = stats.total;
    totalWinsEl.textContent = stats.wins;
    overallWrEl.textContent = stats.total ? (100 * stats.wins / stats.total).toFixed(1) + "%" : "0%";
    overallWrEl.className = "value " + pctClass(stats.total ? (100 * stats.wins / stats.total) : 0);

    cardBody.innerHTML = "";
    for (const row of stats.rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="cardname">${escapeHtml(row.name)}</td>
        <td class="num">${row.gamesPlayed}</td>
        <td class="num">${row.winsWhenPlayed}</td>
        <td class="num ${pctClass(row.winrate)}">${row.winrate.toFixed(1)}%</td>
      `;
      cardBody.appendChild(tr);
    }

    overview.style.display = "flex";
    cardTable.style.display = "table";
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function run(raw) {
    const data = parsePayload(raw);
    if (!data) return;
    const stats = buildStats(data.games);
    if (stats.rows.length === 0) {
      setError("No card play data in this export. Record some wins/losses with cards played first.");
      overview.style.display = "none";
      cardTable.style.display = "none";
      return;
    }
    render(stats);
  }

  jsonInput.addEventListener("input", () => run(jsonInput.value.trim()));
  jsonInput.addEventListener("paste", () => setTimeout(() => run(jsonInput.value.trim()), 0));

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
})();
