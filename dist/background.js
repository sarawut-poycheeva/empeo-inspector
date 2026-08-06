"use strict";
(() => {
  // src/shared/types.ts
  var OFF = { rowCount: null, urlContains: null };
  var STORAGE_KEY = "chaosRules";
  var MSG = {
    getRules: "empeo-inspector:get-rules",
    setRules: "empeo-inspector:set-rules",
    startPick: "empeo-inspector:start-pick",
    openPopup: "empeo-inspector:open-popup"
  };

  // src/background.ts
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MSG.getRules) {
      chrome.storage.session.get(STORAGE_KEY, (stored) => {
        sendResponse({ rules: stored[STORAGE_KEY] ?? OFF });
      });
      return true;
    }
    if (message?.type === MSG.openPopup) {
      chrome.action.openPopup().catch(() => void 0);
      return;
    }
  });
})();
