"use strict";
(() => {
  // src/shared/types.ts
  var MSG = {
    openPopup: "empeo-inspector:open-popup"
  };

  // src/background.ts
  function openSessionStorageToContentScripts() {
    chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }).catch(() => void 0);
  }
  openSessionStorageToContentScripts();
  chrome.runtime.onInstalled.addListener(openSessionStorageToContentScripts);
  chrome.runtime.onStartup.addListener(openSessionStorageToContentScripts);
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MSG.openPopup) chrome.action.openPopup().catch(() => void 0);
  });
})();
