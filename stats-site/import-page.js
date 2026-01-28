(function () {
  "use strict";
  const STORAGE_KEY = "riftbound_stats_data";
  const $ = (id) => document.getElementById(id);
  const jsonInput = $("json-input");
  const fileInput = $("file-input");
  const errorEl = $("error");
  const viewStatsLink = $("view-stats-link");

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

  function run(raw) {
    const data = parsePayload(raw);
    if (!data) return;
    if (!data.games || data.games.length === 0) {
      setError("No games in this export. Record some wins/losses first.");
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
    setError("");
    if (viewStatsLink) viewStatsLink.style.display = "inline-block";
  }

  function clearStored() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    if (jsonInput) jsonInput.value = "";
    setError("");
    if (viewStatsLink) viewStatsLink.style.display = "none";
  }

  if ($("btn-apply")) {
    $("btn-apply").addEventListener("click", () => run(jsonInput && jsonInput.value.trim()));
  }
  if ($("btn-clear-data")) {
    $("btn-clear-data").addEventListener("click", clearStored);
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

  try {
    if (localStorage.getItem(STORAGE_KEY) && viewStatsLink) viewStatsLink.style.display = "inline-block";
  } catch (e) {}
})();
