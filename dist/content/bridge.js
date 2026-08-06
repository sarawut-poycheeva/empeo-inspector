"use strict";
(() => {
  // src/shared/types.ts
  var OFF = { rowCount: null, urlContains: null };
  var STORAGE_KEY = "chaosRules";
  var MSG = {
    openPopup: "empeo-inspector:open-popup"
  };
  var PORT = "empeo-inspector";

  // src/content/bridge.ts
  push();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session" || !changes[STORAGE_KEY]) return;
    send(changes[STORAGE_KEY].newValue ?? OFF);
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.port !== PORT || typeof data.picked !== "string") return;
    void chrome.storage.session.get(STORAGE_KEY).then((stored) => {
      const current = stored[STORAGE_KEY] ?? OFF;
      void chrome.storage.session.set({ [STORAGE_KEY]: { ...current, urlContains: data.picked } });
      chrome.runtime.sendMessage({ type: MSG.openPopup }, () => void chrome.runtime.lastError);
    });
  });
  function push() {
    chrome.storage.session.get(STORAGE_KEY).then((stored) => send(stored[STORAGE_KEY] ?? OFF)).catch(() => send(OFF));
  }
  function send(rules) {
    window.postMessage({ port: PORT, rules }, "*");
  }
})();
