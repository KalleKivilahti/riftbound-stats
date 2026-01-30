(function () {
  const href = window.location.href;
  const isPlayPage =
    href.includes("tcg-arena.fr/play") ||
    href.includes("www.tcg-arena.fr/play");
  if (!isPlayPage) {
    console.log("[Riftbound] Not on play page (" + href + "), skipping observer");
    return;
  }
  console.log("[Riftbound] tcg_observer.js LOADED on play page – " + new Date().toISOString());

  const STORAGE_KEY_MYNAME = "rb_myName";
  let myName = "";
  let contextInvalidated = false;

  function safeSendMessage(msg) {
    if (contextInvalidated) return;
    try {
      chrome.runtime.sendMessage(msg);
    } catch (err) {
      if (err && (err.message === "Extension context invalidated." || String(err.message).includes("invalidated"))) {
        contextInvalidated = true;
        console.warn("[Riftbound] Extension context invalidated – reload the tcg-arena tab to resume tracking.");
      } else {
        throw err;
      }
    }
  }

  async function loadMyName() {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY_MYNAME]);
      myName = (data[STORAGE_KEY_MYNAME] ?? "").trim();
      console.log("[Riftbound] myName loaded:", myName || "(empty)");
    } catch (err) {
      console.error("[Riftbound] loadMyName error:", err);
    }
  }

  function normName(s) {
    return String(s || "").toLowerCase().trim();
  }

  function cleanPlayerNameForComparison(name) {
    if (!name) return "";
    const trimmed = name.trim();
    if (!trimmed) return "";

    const parenMatch = trimmed.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) {
      const inner = (parenMatch[1] || "").trim();
      const prefix = trimmed.slice(0, parenMatch.index).trim();
      if (inner && inner.toLowerCase() !== "you") {
        return inner;
      }
      if (prefix) {
        return prefix;
      }
    }

    return trimmed;
  }

  function isPlayerYou(playerName) {
    const cleaned = cleanPlayerNameForComparison(playerName);
    if (!cleaned) return false;
    const normalizedPlayer = normName(cleaned);
    if (!normalizedPlayer) return false;
    if (normalizedPlayer === "you") return true;
    const normalizedMyName = normName(myName);
    return Boolean(normalizedMyName && normalizedPlayer === normalizedMyName);
  }

  function tryExtractPlayed(element) {
    if (!element?.textContent) return null;
    let text = element.textContent.trim();
    if (!text.includes("played")) return null;

    let player = "";
    let rest = "";
    if (text.includes(" played ")) {
      const parts = text.split(" played ");
      player = parts[0].trim();
      rest = parts[1].trim();
    } else {
      const idx = text.indexOf("played");
      if (idx > 0) {
        player = text.substring(0, idx).trim();
        rest = text.substring(idx + "played".length).trim();
      }
    }
    if (!player || !rest) return null;

    let card = rest.replace(/ from hand|[\.\!]$/g, "").trim();
    const cardElem = element.querySelector('[class*="card"], .name, strong, b, span:not([class*="time"])');
    if (cardElem) card = cardElem.textContent.trim();
    if (!card) return null;

    return { playerName: player, cardName: card };
  }

  function tryExtractRevealed(element) {
    if (!element?.textContent) return null;
    const text = element.textContent.trim();
    if (!text.includes("revealed")) return null;

    let player = "";
    let battlefield = "";
    if (text.includes(" revealed ")) {
      const parts = text.split(" revealed ");
      player = parts[0].trim();
      battlefield = (parts[1] || "").trim();
    } else {
      const idx = text.indexOf("revealed");
      if (idx > 0) {
        player = text.substring(0, idx).trim();
        battlefield = text.substring(idx + "revealed".length).trim();
      }
    }
    if (!player || !battlefield) return null;

    return { playerName: player, battlefield: battlefield };
  }

  function tryExtractTurnCount(element) {
    if (!element?.textContent) return null;
    const text = element.textContent.trim();
    const m = text.match(/\b(?:turn\s*)?(\d+)\s*turns?\b/i) || text.match(/\bturn\s*(\d+)\b/i);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 999) return null;
    return { turnCount: n };
  }

  function handlePossibleLine(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const text = node.textContent && node.textContent.trim();
    if (!text) return;

    const played = tryExtractPlayed(node);
    if (played) {
      const side = isPlayerYou(played.playerName) ? "you" : "opp";
      safeSendMessage({ type: "rb_log_event", side, delta: -1, cardName: played.cardName, playerName: played.playerName });
      return;
    }

    const revealed = tryExtractRevealed(node);
    if (revealed) {
      safeSendMessage({ type: "rb_battlefield", battlefield: revealed.battlefield });
      return;
    }

    const turnInfo = tryExtractTurnCount(node);
    if (turnInfo) {
      safeSendMessage({ type: "rb_turn_count", turnCount: turnInfo.turnCount });
    }
  }

  let currentObserver = null;
  let currentContainer = null;

  function startObserver(container, options) {
    if (!container) return;
    const doInitialScan = options && options.initialScan !== false;
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }
    currentContainer = container;

    console.log("[Riftbound] Observer starting on:", container?.className || container?.id || "unknown", doInitialScan ? "(with initial scan)" : "(no initial scan)");

    const observer = new MutationObserver((mutations) => {
      if (contextInvalidated) return;
      mutations.forEach(mut => {
        if (mut.type === "childList" && mut.addedNodes.length > 0) {
          mut.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              handlePossibleLine(node);
              node.querySelectorAll("*").forEach(handlePossibleLine);
            }
          });
        } else if (mut.type === "characterData" && mut.target?.parentElement) {
          handlePossibleLine(mut.target.parentElement);
        }
      });
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true
    });
    currentObserver = observer;

    if (doInitialScan) {
      console.log("[Riftbound] Initial scan...");
      try {
        container.querySelectorAll("div, p, span, li, article").forEach(handlePossibleLine);
      } catch (e) {}
    }
  }

  // Check for the container if its disconnected
  function ensureObserving() {
    if (contextInvalidated) return;
    const inDoc = currentContainer && document.body.contains(currentContainer);
    if (!inDoc) {
      currentObserver = null;
      currentContainer = null;
      const container = findChatContainer();
      if (container) {
        console.log("[Riftbound] Chat container was replaced – re-attaching observer (no rescan).");
        startObserver(container, { initialScan: false });
      }
    }
  }

  function findChatContainer() {
    const selectors = [
      ".history", "[class*=history]", "[class*=chat]", "[class*=log]",
      ".game-log", ".message-list", ".chat-log",
      "div[class*=chat]", "div[class*=history]", "div[class*=log]",
      "#chat", "#log", ".right-panel", ".game-chat", ".sidebar"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log("[Riftbound] Chat container found →", sel);
        return el;
      }
    }
    return null;
  }

  function tryFindAndObserve() {
    const container = findChatContainer();
    if (container) {
      startObserver(container);
    } else {
      console.log("[Riftbound] Chat container not found – retry in 1s");
      setTimeout(tryFindAndObserve, 1000);
    }
  }

  let statusIntervalId = null;
  (async () => {
    console.log("[Riftbound] Init v4");
    await loadMyName();
    tryFindAndObserve();

    statusIntervalId = setInterval(() => {
      if (contextInvalidated) {
        if (statusIntervalId != null) clearInterval(statusIntervalId);
        return;
      }
      ensureObserving();
      safeSendMessage({ type: "rb_log_status", ok: true });
    }, 5000);

    setInterval(ensureObserving, 60000);
  })();

  chrome.runtime.onMessage.addListener(msg => {
    if (contextInvalidated) return;
    if (msg?.type === "rb_ping") {
      console.log("[Riftbound] Ping received");
      loadMyName();
      safeSendMessage({ type: "rb_log_status", ok: true });
    }
  });
})();