"use strict";
(() => {
  // src/shared/redirect.ts
  var REDIRECT_STORAGE_KEYS = { globalEnabled: true, entries: [] };
  var RESOURCE_TYPES = ["script", "stylesheet", "sub_frame", "xmlhttprequest"];
  function buildDnrRule(entry) {
    return {
      id: entry.id,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { transform: { scheme: "http", host: "localhost", port: String(entry.port) } }
      },
      condition: { urlFilter: entry.path, resourceTypes: RESOURCE_TYPES }
    };
  }
  function rulesFor(state) {
    if (!state.globalEnabled) return [];
    return state.entries.filter((entry) => entry.enabled && entry.path).map(buildDnrRule);
  }
  function activeCount(state) {
    return rulesFor(state).length;
  }

  // src/background.ts
  async function getState() {
    const stored = await chrome.storage.local.get(REDIRECT_STORAGE_KEYS);
    return { globalEnabled: stored.globalEnabled !== false, entries: stored.entries ?? [] };
  }
  async function paintBadge(state) {
    const count = activeCount(state);
    await chrome.action.setBadgeText({ text: count ? String(count) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#e04a1e" });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: "#ffffff" });
    }
  }
  function dnrAvailable() {
    if (chrome.declarativeNetRequest) return true;
    console.warn(
      "[Dev Inspectors] declarativeNetRequest is not available. Chrome kept an older permission set \u2014 remove the extension and Load unpacked again; Reload does not grant new permissions."
    );
    return false;
  }
  async function syncRules() {
    const state = await getState();
    await paintBadge(state);
    if (!dnrAvailable()) return;
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map((rule) => rule.id),
        addRules: rulesFor(state)
      });
    } catch (error) {
      console.error("[Dev Inspectors] could not update redirect rules:", error);
    }
  }
  chrome.runtime.onInstalled.addListener(() => void syncRules());
  chrome.runtime.onStartup.addListener(() => void syncRules());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if ("entries" in changes || "globalEnabled" in changes) void syncRules();
  });
})();
