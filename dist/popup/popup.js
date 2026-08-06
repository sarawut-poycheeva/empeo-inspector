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
  var RULES_KEY = "chaosRules";
  var INSPECT_KEY = "inspect";

  // src/popup/popup.ts
  var env = document.getElementById("env");
  var blocked = document.getElementById("blocked");
  var panel = document.getElementById("panel");
  var toggle = document.getElementById("toggle");
  var activeBlock = document.getElementById("active");
  var current = document.getElementById("current");
  var reset = document.getElementById("reset");
  var tabId;
  var inspecting = false;
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
    panel.hidden = false;
    const stored = await chrome.storage.local.get([RULES_KEY, INSPECT_KEY]);
    rules = stored[RULES_KEY] ?? OFF;
    inspecting = stored[INSPECT_KEY] === true;
    paint();
  }
  function labelFor(url) {
    const host = new URL(url).hostname;
    if (host === "portal.uat.empeo.com") return "uat";
    if (host === "portal.dev.empeo.com") return "dev";
    return "local";
  }
  function paint() {
    toggle.textContent = inspecting ? "\u0E1B\u0E34\u0E14\u0E42\u0E2B\u0E21\u0E14\u0E2A\u0E48\u0E2D\u0E07" : "\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E2B\u0E21\u0E14\u0E2A\u0E48\u0E2D\u0E07";
    toggle.classList.toggle("is-on", inspecting);
    const on = rules.rowCount !== null && rules.urlContains !== null;
    activeBlock.hidden = !on;
    if (on) {
      const amount = rules.rowCount === 0 ? "\u0E27\u0E48\u0E32\u0E07" : `${rules.rowCount?.toLocaleString("en-US")} \u0E41\u0E16\u0E27`;
      current.textContent = `${rules.urlContains} \u2192 ${amount}`;
    }
  }
  toggle.addEventListener("click", () => {
    inspecting = !inspecting;
    paint();
    void chrome.storage.local.set({ [INSPECT_KEY]: inspecting }).then(() => window.close());
  });
  reset.addEventListener("click", () => {
    rules = OFF;
    paint();
    void chrome.storage.local.set({ [RULES_KEY]: OFF }).then(() => {
      if (tabId) chrome.tabs.reload(tabId);
      window.close();
    });
  });
})();
