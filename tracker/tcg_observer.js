(function () {
  console.log("[Riftbound] tcg_observer.js LOADED v4 – " + new Date().toISOString());

  const STORAGE_KEY_MYNAME = "rb_myName";
  let myName = "";

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

  function tryExtractPlayed(element) {
    if (!element?.textContent) return null;

    let text = element.textContent.trim();
    if (!text.includes("played")) return null;

    console.log("[Riftbound] Potential played message:", text.substring(0, 120) + (text.length > 120 ? "..." : ""));

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

    console.log(`[Riftbound] Detected → Player: ${player} | Action: played | Card: ${card}`);

    return { playerName: player, cardName: card };
  }

  function handlePossibleLine(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const info = tryExtractPlayed(node);
    if (!info) return;

    const side = normName(info.playerName) === normName(myName) ? "you" : "opp";

    console.log(`[Riftbound] EVENT → ${side.toUpperCase()} played "${info.cardName}"`);

    chrome.runtime.sendMessage({
      type: "rb_log_event",
      side: side,
      delta: -1,
      cardName: info.cardName
    });
  }

  function startObserver(container) {
    console.log("[Riftbound] Observer starting on:", container?.className || container?.id || "unknown");

    const observer = new MutationObserver((mutations) => {
      console.log("[Riftbound] Mutation fired – " + mutations.length + " changes");

      mutations.forEach(mut => {
        if (mut.type === "childList" && mut.addedNodes.length > 0) {
          console.log("[Riftbound] childList – added nodes:", mut.addedNodes.length);
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

    console.log("[Riftbound] Initial scan...");
    container.querySelectorAll("div, p, span, li, article").forEach(handlePossibleLine);
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

  (async () => {
    console.log("[Riftbound] Init v4");
    await loadMyName();
    tryFindAndObserve();

    setInterval(() => {
      chrome.runtime.sendMessage({ type: "rb_log_status", ok: true });
    }, 5000);
  })();

  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type === "rb_ping") {
      console.log("[Riftbound] Ping received");
      loadMyName();
      chrome.runtime.sendMessage({ type: "rb_log_status", ok: true });
    }
  });
})();