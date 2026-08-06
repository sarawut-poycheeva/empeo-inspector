"use strict";
(() => {
  // src/shared/types.ts
  var RULES_KEY = "chaosRules";
  var INSPECT_KEY = "inspect";

  // src/background.ts
  function clearEverything() {
    void chrome.storage.local.remove([RULES_KEY, INSPECT_KEY]);
  }
  chrome.runtime.onStartup.addListener(clearEverything);
  chrome.runtime.onInstalled.addListener(clearEverything);
})();
