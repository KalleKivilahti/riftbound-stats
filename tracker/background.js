chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: chrome.runtime.getURL("tracker.html"),
    type: "normal",
    width: 1100,
    height: 900
  });
});

// Tracker can ask us to ping tcg-arena tabs, so the observer resends status
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "rb_ping_tabs") {
    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        const url = t.url || "";
        if (url.includes("tcg-arena.fr")) {
          chrome.tabs.sendMessage(t.id, { type: "rb_ping" });
        }
      }
    });
  }
});