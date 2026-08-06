"use strict";
(() => {
  // src/shared/types.ts
  var MSG = {
    openPopup: "empeo-inspector:open-popup"
  };

  // src/background.ts
  async function clearEverything() {
    const stored = await chrome.storage.local.get(null);
    const ours = Object.keys(stored).filter(
      (key) => key === "chaosRules" || key.startsWith("seen:") || key.startsWith("pick:")
    );
    if (ours.length > 0) await chrome.storage.local.remove(ours);
  }
  chrome.runtime.onStartup.addListener(() => void clearEverything());
  chrome.runtime.onInstalled.addListener(() => void clearEverything());
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MSG.openPopup) chrome.action.openPopup().catch(() => void 0);
  });
})();
