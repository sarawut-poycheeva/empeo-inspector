"use strict";
(() => {
  // src/shared/types.ts
  var OFF = { rowCount: null, urlContains: null };
  var RULES_KEY = "chaosRules";
  function seenKey(origin2) {
    return `seen:${origin2}`;
  }
  function pickKey(origin2) {
    return `pick:${origin2}`;
  }
  var MSG = {
    openPopup: "empeo-inspector:open-popup"
  };
  var PORT = "empeo-inspector";

  // src/content/bridge.ts
  var FLUSH_MS = 400;
  var origin = location.origin;
  var seen = /* @__PURE__ */ new Map();
  var flushTimer;
  void pushRules();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[RULES_KEY]) sendRules(changes[RULES_KEY].newValue ?? OFF);
    if (changes[pickKey(origin)]?.newValue) window.postMessage({ port: PORT, action: "pick" }, "*");
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.port !== PORT) return;
    if (data.seen) {
      seen.set(data.seen.name, data.seen);
      scheduleFlush();
    }
    if (typeof data.picked === "string") {
      void savePicked(data.picked);
    }
  });
  async function pushRules() {
    try {
      const stored = await chrome.storage.local.get(RULES_KEY);
      sendRules(stored[RULES_KEY] ?? OFF);
    } catch {
      sendRules(OFF);
    }
  }
  function sendRules(rules) {
    window.postMessage({ port: PORT, rules }, "*");
  }
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = void 0;
      void chrome.storage.local.set({ [seenKey(origin)]: [...seen.values()] }).catch(() => void 0);
    }, FLUSH_MS);
  }
  async function savePicked(name) {
    const stored = await chrome.storage.local.get(RULES_KEY);
    const current = stored[RULES_KEY] ?? OFF;
    await chrome.storage.local.set({ [RULES_KEY]: { ...current, urlContains: name } });
    chrome.runtime.sendMessage({ type: MSG.openPopup }, () => void chrome.runtime.lastError);
  }
})();
