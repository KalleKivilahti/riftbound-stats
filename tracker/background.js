chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("tracker.html"),
    type: "normal",
    width: 1100,
    height: 900
  });
});

let trackerTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "rb_tracker_ready" && sender.tab?.id != null) {
    trackerTabId = sender.tab.id;
    console.log("[Background] Tracker ready, tabId =", trackerTabId);
    return;
  }

  if ((msg.type === "rb_log_event" || msg.type === "rb_log_batch") && trackerTabId != null) {
    chrome.tabs.sendMessage(trackerTabId, msg).catch(() => {
      console.warn("[Background] Failed to send to tracker tab");
    });
    return;
  }

  if (msg.type === "rb_ping_tabs") {
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        const url = t.url || "";
        if (url.includes("tcg-arena.fr")) {
          chrome.tabs.sendMessage(t.id, { type: "rb_ping" }).catch(() => {});
        }
      }
    });
    return;
  }
});
