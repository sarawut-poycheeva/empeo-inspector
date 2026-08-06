"use strict";
(() => {
  // src/shared/allowlist.ts
  var ALLOWED_HOSTS = ["localhost", "127.0.0.1", "portal.dev.empeo.com", "portal.uat.empeo.com"];
  function isAllowedOrigin(href) {
    try {
      return ALLOWED_HOSTS.includes(new URL(href).hostname);
    } catch {
      return false;
    }
  }

  // src/shared/types.ts
  var OFF = { rowCount: null };
  var STORAGE_KEY = "chaosRules";
  var MSG = {
    getRules: "empeo-inspector:get-rules",
    setRules: "empeo-inspector:set-rules"
  };

  // src/popup/popup.ts
  var env = document.getElementById("env");
  var blocked = document.getElementById("blocked");
  var panel = document.getElementById("panel");
  var rowsGroup = document.getElementById("rows");
  var seenList = document.getElementById("seen");
  var reload = document.getElementById("reload");
  var tabId;
  void init();
  async function init() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    const url = tab?.url ?? "";
    if (!tabId || !isAllowedOrigin(url)) {
      env.textContent = "n/a";
      blocked.hidden = false;
      return;
    }
    env.textContent = labelFor(url);
    panel.hidden = false;
    const stored = await chrome.storage.session.get(STORAGE_KEY);
    paintRules(stored[STORAGE_KEY] ?? OFF);
    chrome.tabs.sendMessage(tabId, { type: MSG.getRules }, (response) => {
      if (chrome.runtime.lastError) return;
      paintSeen(response?.seen ?? []);
    });
  }
  function labelFor(url) {
    const host = new URL(url).hostname;
    if (host === "portal.uat.empeo.com") return "uat";
    if (host === "portal.dev.empeo.com") return "dev";
    return "local";
  }
  function paintRules(rules) {
    const current = rules.rowCount === null ? "off" : String(rules.rowCount);
    for (const button of rowsGroup.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.count === current));
    }
  }
  function paintSeen(seen) {
    if (seen.length === 0) return;
    const sorted = [...seen].sort((a, b) => (b.rows ?? -1) - (a.rows ?? -1));
    seenList.replaceChildren(
      ...sorted.slice(0, 25).map((entry) => {
        const item = document.createElement("li");
        const path = document.createElement("span");
        path.className = "path";
        path.textContent = shorten(entry.url);
        path.title = entry.url;
        const rows = document.createElement("span");
        rows.className = entry.rows === null ? "rows none" : "rows";
        rows.textContent = entry.rows === null ? "\u2014" : entry.rows.toLocaleString("en-US");
        item.append(path, rows);
        return item;
      })
    );
  }
  function shorten(url) {
    try {
      const segments = new URL(url).pathname.split("/").filter(Boolean);
      return segments.slice(-2).join("/") || url;
    } catch {
      return url;
    }
  }
  rowsGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !tabId) return;
    const value = button.dataset.count;
    const rules = { rowCount: value === "off" ? null : Number(value) };
    void chrome.storage.session.set({ [STORAGE_KEY]: rules });
    chrome.tabs.sendMessage(tabId, { type: MSG.setRules, rules }, () => void chrome.runtime.lastError);
    paintRules(rules);
  });
  reload.addEventListener("click", () => {
    if (tabId) chrome.tabs.reload(tabId);
    window.close();
  });
})();
