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
  var PORT = "empeo-inspector";

  // src/shared/match.ts
  function normalise(text) {
    return text.trim().replace(/\s+/g, " ").toLowerCase();
  }
  function scoreMatch(tokens, samples) {
    if (tokens.length === 0 || samples.length === 0) return 0;
    const set = new Set(samples);
    let hits = 0;
    for (const token of tokens) if (set.has(token)) hits++;
    return hits;
  }
  function bestMatch(tokens, candidates2) {
    let best = null;
    let bestScore = 0;
    for (const candidate of candidates2) {
      const score = scoreMatch(tokens, candidate.samples);
      if (score === 0) continue;
      if (score > bestScore || score === bestScore && (candidate.rows ?? 0) > (best?.rows ?? 0)) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  // src/content/pick.ts
  var ACCENT = "#c2610a";
  var MIN_TOKENS = 2;
  var MAX_TOKENS = 60;
  var TOAST_MS = 3600;
  var active = false;
  function startPick(candidates2, onPick) {
    if (active || !document.body) return;
    active = true;
    const outline = element("div", [
      "position:fixed",
      "z-index:2147483646",
      `border:2px solid ${ACCENT}`,
      `background:${ACCENT}1a`,
      "pointer-events:none",
      "display:none"
    ]);
    const hint = element("div", [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      `background:${ACCENT}`,
      "color:#fff",
      "font:600 12px/1.4 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
      "padding:9px 15px",
      "border-radius:6px",
      "pointer-events:none",
      "box-shadow:0 6px 20px rgba(0,0,0,.3)"
    ]);
    hint.textContent = "\u0E04\u0E25\u0E34\u0E01\u0E17\u0E35\u0E48\u0E15\u0E32\u0E23\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 \xB7 \u0E01\u0E14 ESC \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01";
    document.body.append(outline, hint);
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";
    let target = null;
    let queued = false;
    let pointer = { x: 0, y: 0 };
    const onMove = (event) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        target = subjectAt(pointer.x, pointer.y);
        if (!target) {
          outline.style.display = "none";
          return;
        }
        const box = target.getBoundingClientRect();
        Object.assign(outline.style, {
          display: "block",
          top: `${box.top}px`,
          left: `${box.left}px`,
          width: `${box.width}px`,
          height: `${box.height}px`
        });
      });
    };
    const swallow = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onClick = (event) => {
      swallow(event);
      const chosen = target ?? subjectAt(event.clientX, event.clientY);
      const tokens = chosen ? tokensIn(chosen) : [];
      const match = bestMatch(tokens, candidates2());
      finish();
      if (match) {
        toast(`\u0E40\u0E25\u0E37\u0E2D\u0E01 ${match.name} \u0E41\u0E25\u0E49\u0E27`);
        onPick(match);
      } else if (tokens.length === 0) {
        toast("\u0E15\u0E23\u0E07\u0E19\u0E35\u0E49\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E43\u0E2B\u0E49\u0E40\u0E17\u0E35\u0E22\u0E1A \u2014 \u0E25\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E01\u0E17\u0E35\u0E48\u0E41\u0E16\u0E27\u0E43\u0E19\u0E15\u0E32\u0E23\u0E32\u0E07");
      } else {
        toast("\u0E44\u0E21\u0E48\u0E1E\u0E1A API \u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E23\u0E07\u0E19\u0E35\u0E49 \u2014 \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E32\u0E08\u0E42\u0E2B\u0E25\u0E14\u0E21\u0E32\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D");
      }
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      swallow(event);
      finish();
    };
    const finish = () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mousedown", swallow, true);
      document.removeEventListener("pointerdown", swallow, true);
      document.removeEventListener("keydown", onKey, true);
      outline.remove();
      hint.remove();
      document.body.style.cursor = previousCursor;
      active = false;
    };
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousedown", swallow, true);
    document.addEventListener("pointerdown", swallow, true);
    document.addEventListener("keydown", onKey, true);
  }
  function subjectAt(x, y) {
    let node = document.elementFromPoint(x, y);
    let hops = 0;
    while (node && node !== document.body && hops < 12) {
      if (tokensIn(node).length >= MIN_TOKENS) return node;
      node = node.parentElement;
      hops++;
    }
    return null;
  }
  function tokensIn(root) {
    const out = [];
    const seen2 = /* @__PURE__ */ new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && out.length < MAX_TOKENS) {
      const text = normalise(node.nodeValue ?? "");
      if (text.length >= 2 && text.length <= 80 && !seen2.has(text)) {
        seen2.add(text);
        out.push(text);
      }
      node = walker.nextNode();
    }
    return out;
  }
  function element(tag, styles) {
    const node = document.createElement(tag);
    node.style.cssText = styles.join(";");
    return node;
  }
  function toast(message) {
    const node = element("div", [
      "position:fixed",
      "left:50%",
      "bottom:24px",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "background:#1c2027",
      "color:#fff",
      "font:600 12px/1.4 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
      "padding:10px 16px",
      "border-radius:6px",
      "pointer-events:none",
      "box-shadow:0 6px 20px rgba(0,0,0,.35)",
      "max-width:80vw",
      "text-align:center"
    ]);
    node.textContent = message;
    document.body.append(node);
    setTimeout(() => node.remove(), TOAST_MS);
  }

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
    if (message?.type === MSG.startPick) {
      sendResponse({ ok: true });
      startPick(candidates, (candidate) => {
        const next = { ...rules, urlContains: candidate.name };
        apply(next);
        void chrome.storage.session.set({ [STORAGE_KEY]: next });
        chrome.runtime.sendMessage({ type: MSG.openPopup }, () => void chrome.runtime.lastError);
      });
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data?.port !== PORT || !data.seen) return;
    const previous = seen.get(data.seen.name);
    if (previous && (previous.rows ?? -1) > (data.seen.rows ?? -1)) return;
    seen.set(data.seen.name, data.seen);
  });
  function candidates() {
    return [...seen.values()].map(({ name, samples, rows }) => ({ name, samples, rows }));
  }
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
      banner.textContent = `CHAOS \xB7 ROWS = ${rules.rowCount?.toLocaleString("en-US")} \xB7 ${rules.urlContains ?? "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E19\u0E49\u0E32"}`;
      banner.style.cssText = [
        "position:fixed",
        "inset:0 0 auto 0",
        "z-index:2147483645",
        "background:#c2610a",
        "color:#fff",
        "font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
        "letter-spacing:.08em",
        "padding:6px 12px",
        "pointer-events:none"
      ].join(";");
      const frame = document.createElement("div");
      frame.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:2147483644",
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
