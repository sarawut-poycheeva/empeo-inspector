"use strict";
(() => {
  // src/shared/types.ts
  var OFF = { rowCount: null, urlContains: null };
  var STORAGE_KEY = "chaosRules";
  var MSG = {
    getRules: "empeo-inspector:get-rules",
    setRules: "empeo-inspector:set-rules"
  };

  // src/background.ts
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== MSG.getRules) return;
    chrome.storage.session.get(STORAGE_KEY, (stored) => {
      sendResponse({ rules: stored[STORAGE_KEY] ?? OFF });
    });
    return true;
  });
})();
