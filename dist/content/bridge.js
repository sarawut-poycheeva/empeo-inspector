"use strict";
(() => {
  // src/shared/types.ts
  var OFF = { rowCount: null };
  var MSG = {
    getRules: "empeo-inspector:get-rules",
    setRules: "empeo-inspector:set-rules"
  };
  var PORT = "empeo-inspector";

  // src/content/bridge.ts
  var seen = /* @__PURE__ */ new Map();
  var rules = OFF;
  chrome.runtime.sendMessage({ type: MSG.getRules }, (response) => {
    if (chrome.runtime.lastError) return;
    apply(response?.rules ?? OFF);
  });
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MSG.setRules && message.rules) {
      apply(message.rules);
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === MSG.getRules) {
      sendResponse({ rules, seen: [...seen.values()] });
      return;
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.port !== PORT || !data.seen) return;
    const { url, rows } = data.seen;
    seen.set(url, { url, rows });
  });
  function apply(next) {
    rules = next;
    window.postMessage({ port: PORT, rules: next }, "*");
    paint();
  }
  function paint() {
    const on = rules.rowCount !== null;
    const run = () => {
      document.getElementById("empeo-inspector-banner")?.remove();
      if (!on) return;
      const banner = document.createElement("div");
      banner.id = "empeo-inspector-banner";
      banner.textContent = `CHAOS \xB7 ROWS = ${rules.rowCount?.toLocaleString("en-US")}`;
      banner.style.cssText = [
        "position:fixed",
        "inset:0 0 auto 0",
        "z-index:2147483647",
        "background:#c2610a",
        "color:#fff",
        "font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
        "letter-spacing:.08em",
        "padding:6px 12px",
        "pointer-events:none",
        "box-shadow:0 0 0 3px #c2610a inset,0 0 0 100vmax transparent"
      ].join(";");
      const frame = document.createElement("div");
      frame.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483646",
        "border:3px solid #c2610a",
        "pointer-events:none"
      ].join(";");
      banner.appendChild(frame);
      document.body.appendChild(banner);
    };
    if (document.body) run();
    else document.addEventListener("DOMContentLoaded", run, { once: true });
  }
})();
