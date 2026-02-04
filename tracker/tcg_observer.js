(function () {
  if (!location.href.includes("tcg-arena.fr/play")) return;

  const STORAGE_KEY_MYNAME = "rb_myName";
  let myName = "";
  let contextInvalidated = false;

  function safeSend(msg) {
    if (contextInvalidated) return;
    try {
      chrome.runtime.sendMessage(msg);
    } catch (e) {
      if (String(e?.message).includes("invalidated")) {
        contextInvalidated = true;
        console.warn("[Riftbound] Extension context invalidated");
      } else {
        throw e;
      }
    }
  }

  async function loadMyName() {
    const data = await chrome.storage.local.get([STORAGE_KEY_MYNAME]);
    myName = (data[STORAGE_KEY_MYNAME] || "").trim().toLowerCase();
    console.log("[Riftbound] myName =", myName || "(empty)");
  }

  function sideFromSender(sender) {
    return sender.trim().toLowerCase() === myName ? "you" : "opp";
  }

  const CHAT_SELECTORS = [
    ".history",
    "[class*=history]",
    "[class*=chat]",
    ".chat-log",
    ".game-log",
    ".message-list",
    ".content"
  ];

  const bufferedPlays = [];
  const BUFFER_LIMIT = 800;

  function addBufferedPlay(entry) {
    bufferedPlays.push(entry);
    if (bufferedPlays.length > BUFFER_LIMIT) {
      bufferedPlays.splice(0, bufferedPlays.length - BUFFER_LIMIT);
    }
  }

  function findChatContainer() {
    for (const sel of CHAT_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function scanHistory() {
    const container = findChatContainer();
    if (!container) {
      console.warn("[Riftbound] Chat container not found");
      return { plays: [], battlefields: [] };
    }

    const plays = [];
    const battlefields = [];

    const entries = Array.from(container.querySelectorAll("div")).filter(div =>
      div.querySelector("h5.sender") && div.querySelector("p.text-start")
    );

    for (const entry of entries) {
      const senderEl = entry.querySelector("h5.sender");
      const textEl = entry.querySelector("p.text-start");
      if (!senderEl || !textEl) continue;

      const sender = senderEl.textContent.trim();
      const text = (textEl.textContent || "").trim();
      const textLower = text.toLowerCase();
      if (!sender || !textLower) continue;

      if (textLower.includes("revealed")) {
        battlefields.push({
          playerName: sender,
          battlefield: textEl.textContent.trim()
        });
        continue;
      }

      if (!textLower.includes("played")) continue;

      const cardNode = textEl.querySelector("b.history-card-name");
      if (!cardNode) continue;
      const cardName = cardNode.textContent.trim();
      if (!cardName) continue;

      plays.push({
        playerName: sender,
        cardName,
        side: sideFromSender(sender),
        text: textLower
      });
    }

    console.log(`[Riftbound] Found ${plays.length} played card events`);
    console.log(`[Riftbound] Found ${battlefields.length} battlefield events`);
    return { plays, battlefields };
  }

  function handleEntry(entry) {
    if (!entry || entry.nodeType !== Node.ELEMENT_NODE) return;
    if (entry.dataset && entry.dataset.rbBuffered) return;

    const senderEl = entry.querySelector("h5.sender");
    const textEl = entry.querySelector("p.text-start");
    if (!senderEl || !textEl) return;

    const sender = senderEl.textContent.trim();
    const text = (textEl.textContent || "").trim();
    const textLower = text.toLowerCase();
    if (!sender || !textLower.includes("played")) return;

    const cardNode = textEl.querySelector("b.history-card-name");
    if (!cardNode) return;
    const cardName = cardNode.textContent.trim();
    if (!cardName) return;

    addBufferedPlay({
      playerName: sender,
      cardName,
      side: sideFromSender(sender),
      text: textLower
    });

    if (entry.dataset) entry.dataset.rbBuffered = "1";
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== "childList" || !m.addedNodes.length) continue;
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.("div")) handleEntry(node);
        node.querySelectorAll?.("div").forEach(handleEntry);
      });
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (contextInvalidated) return;

    if (msg?.type === "rb_scan_history") {
      const { plays, battlefields } = scanHistory();
      const buffer = bufferedPlays.slice();
      console.log(`[Riftbound] rb_scan_history -> plays=${plays.length} buffer=${buffer.length}`);
      sendResponse({ plays, battlefields, buffer });
      return true;
    }

    if (msg?.type === "rb_ping") {
      safeSend({ type: "rb_log_status", ok: true });
    }
  });
  loadMyName();
})();