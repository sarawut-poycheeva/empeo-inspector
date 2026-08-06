"use strict";
(() => {
  // src/shared/types.ts
  var OFF = { rowCount: null, urlContains: null };
  var RULES_KEY = "chaosRules";
  var INSPECT_KEY = "inspect";
  var PORT = "empeo-inspector";

  // src/content/bridge.ts
  void send();
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[RULES_KEY] || changes[INSPECT_KEY]) void send();
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.port !== PORT) return;
    if (data.apply) {
      void chrome.storage.local.set({ [RULES_KEY]: data.apply }).then(() => window.postMessage({ port: PORT, applied: true }, "*"));
    }
    if (typeof data.inspect === "boolean") {
      void chrome.storage.local.set({ [INSPECT_KEY]: data.inspect });
    }
  });
  async function send() {
    try {
      const stored = await chrome.storage.local.get([RULES_KEY, INSPECT_KEY]);
      window.postMessage(
        {
          port: PORT,
          rules: stored[RULES_KEY] ?? OFF,
          inspect: stored[INSPECT_KEY] === true
        },
        "*"
      );
    } catch {
      window.postMessage({ port: PORT, rules: OFF, inspect: false }, "*");
    }
  }
})();
