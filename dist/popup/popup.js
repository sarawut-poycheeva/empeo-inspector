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
  var OFF = { rowCount: null, urlContains: null };
  var STORAGE_KEY = "chaosRules";
  var MSG = {
    getRules: "empeo-inspector:get-rules",
    setRules: "empeo-inspector:set-rules",
    startPick: "empeo-inspector:start-pick",
    openPopup: "empeo-inspector:open-popup"
  };

  // src/popup/popup.ts
  var env = document.getElementById("env");
  var blocked = document.getElementById("blocked");
  var stale = document.getElementById("stale");
  var staleReason = document.getElementById("staleReason");
  var staleReload = document.getElementById("staleReload");
  var panel = document.getElementById("panel");
  var pickButton = document.getElementById("pick");
  var scopeList = document.getElementById("scope");
  var scopeNote = document.getElementById("scopeNote");
  var rowsGroup = document.getElementById("rows");
  var tabId;
  var rules = OFF;
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
    let reply = await ask(tabId);
    if (!reply) {
      const error = await inject(tabId);
      reply = error ? null : await ask(tabId);
      if (!reply) {
        staleReason.textContent = error ?? "\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E27\u0E47\u0E1A\u0E44\u0E21\u0E48\u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A \u2014 \u0E42\u0E2B\u0E25\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07";
        stale.hidden = false;
        return;
      }
    }
    panel.hidden = false;
    const stored = await chrome.storage.session.get(STORAGE_KEY);
    rules = stored[STORAGE_KEY] ?? OFF;
    paintRows();
    paintScope(reply.seen ?? []);
  }
  function ask(id) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(id, { type: MSG.getRules }, (reply) => {
        resolve(chrome.runtime.lastError ? null : reply ?? null);
      });
    });
  }
  async function inject(id) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ["content/bridge.js"] });
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
  function labelFor(url) {
    const host = new URL(url).hostname;
    if (host === "portal.uat.empeo.com") return "uat";
    if (host === "portal.dev.empeo.com") return "dev";
    return "local";
  }
  function paintRows() {
    const current = rules.rowCount === null ? "off" : String(rules.rowCount);
    for (const button of rowsGroup.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.count === current));
    }
  }
  function paintScopeSelection() {
    for (const button of scopeList.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String((button.dataset.scope ?? "") === (rules.urlContains ?? "")));
    }
  }
  function paintScope(seen) {
    if (seen.length === 0) {
      scopeNote.textContent = "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19 request \u2014 \u0E42\u0E2B\u0E25\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48\u0E41\u0E25\u0E49\u0E27\u0E40\u0E1B\u0E34\u0E14\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07";
      paintScopeSelection();
      return;
    }
    const sorted = [...seen].sort((a, b) => (b.rows ?? -1) - (a.rows ?? -1));
    const items = sorted.slice(0, 20).map((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.scope = entry.name;
      const head = document.createElement("span");
      head.className = "head";
      const path = document.createElement("span");
      path.className = "path";
      path.textContent = entry.name;
      const count = document.createElement("span");
      count.className = entry.rows === null ? "rows none" : "rows";
      count.textContent = entry.rows === null ? "\u2014" : entry.rows.toLocaleString("en-US");
      head.append(path, count);
      button.append(head);
      const preview = entry.samples.slice(0, 3).join(" \xB7 ");
      if (preview) {
        const sample = document.createElement("span");
        sample.className = "sample";
        sample.textContent = preview;
        button.append(sample);
      }
      const item = document.createElement("li");
      item.append(button);
      return item;
    });
    const all = scopeList.querySelector("li");
    scopeList.replaceChildren(...all ? [all, ...items] : items);
    paintScopeSelection();
  }
  staleReload.addEventListener("click", () => {
    if (tabId) chrome.tabs.reload(tabId);
    window.close();
  });
  pickButton.addEventListener("click", () => {
    if (!tabId) return;
    chrome.tabs.sendMessage(tabId, { type: MSG.startPick }, () => {
      if (chrome.runtime.lastError) {
        staleReason.textContent = chrome.runtime.lastError.message ?? "";
        panel.hidden = true;
        stale.hidden = false;
        return;
      }
      window.close();
    });
  });
  scopeList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const value = button.dataset.scope ?? "";
    rules = { ...rules, urlContains: value === "" ? null : value };
    paintScopeSelection();
    void save();
  });
  rowsGroup.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button || !tabId) return;
    const value = button.dataset.count;
    rules = { ...rules, rowCount: value === "off" ? null : Number(value) };
    paintRows();
    void save().then(() => {
      chrome.tabs.reload(tabId);
      window.close();
    });
  });
  async function save() {
    await chrome.storage.session.set({ [STORAGE_KEY]: rules });
    if (!tabId) return;
    await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: MSG.setRules, rules }, () => {
        void chrome.runtime.lastError;
        resolve();
      });
    });
  }
})();
