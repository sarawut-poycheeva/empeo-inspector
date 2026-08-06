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

  // src/shared/match.ts
  var MIN_LENGTH = 2;
  var MAX_LENGTH = 80;
  function normalise(text) {
    return text.trim().replace(/\s+/g, " ").toLowerCase();
  }
  function collectSamples(value, limit = 150) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const visit = (node, depth) => {
      if (out.length >= limit || depth > 8) return;
      if (typeof node === "string") {
        const text = normalise(node);
        if (text.length < MIN_LENGTH || text.length > MAX_LENGTH || seen.has(text)) return;
        seen.add(text);
        out.push(text);
        return;
      }
      if (Array.isArray(node)) {
        for (const child of node) visit(child, depth + 1);
        return;
      }
      if (node !== null && typeof node === "object") {
        for (const child of Object.values(node)) visit(child, depth + 1);
      }
    };
    visit(value, 0);
    return out;
  }
  function scoreMatch(tokens, samples) {
    if (tokens.length === 0 || samples.length === 0) return 0;
    const set = new Set(samples);
    let hits = 0;
    for (const token of tokens) if (set.has(token)) hits++;
    return hits;
  }
  function bestMatch(tokens, candidates) {
    let best = null;
    let bestScore = 0;
    for (const candidate of candidates) {
      const score = scoreMatch(tokens, candidate.samples);
      if (score === 0) continue;
      if (score > bestScore || score === bestScore && (candidate.rows ?? 0) > (best?.rows ?? 0)) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  // src/shared/scope.ts
  function matchesScope(url, urlContains) {
    if (!urlContains) return true;
    return url.toLowerCase().includes(urlContains.toLowerCase());
  }
  function shortenUrl(url) {
    try {
      const segments = new URL(url).pathname.split("/").filter(Boolean);
      return segments.slice(-2).join("/") || url;
    } catch {
      return url;
    }
  }

  // src/shared/transform.ts
  var IDENTITY_KEY = /(^|[a-z])(id|no|guid|key|code)$/i;
  var TOTAL_KEY = /^(total|totalcount|totalrecords|totalitems|totalrows|count|recordcount|itemcount|rowcount)$/i;
  var ID_OFFSET = 1e6;
  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isRowArray(value) {
    return Array.isArray(value) && value.length > 0 && isPlainObject(value[0]);
  }
  function findPrimaryArray(root) {
    let best = null;
    const consider = (hit) => {
      if (!best || hit.length > best.length || hit.length === best.length && hit.depth < best.depth) {
        best = hit;
      }
    };
    const visit = (node, depth) => {
      if (Array.isArray(node)) {
        node.forEach((child, index) => {
          if (isRowArray(child)) consider({ container: node, key: index, length: child.length, depth });
          visit(child, depth + 1);
        });
        return;
      }
      if (!isPlainObject(node)) return;
      for (const [key, child] of Object.entries(node)) {
        if (isRowArray(child)) consider({ container: node, key, length: child.length, depth });
        visit(child, depth + 1);
      }
    };
    visit(root, 0);
    return best;
  }
  function remapIdentity(row, copyIndex) {
    const copy = { ...row };
    for (const [key, value] of Object.entries(copy)) {
      if (!IDENTITY_KEY.test(key)) continue;
      if (typeof value === "number") copy[key] = value + copyIndex * ID_OFFSET;
      else if (typeof value === "string") copy[key] = `${value}#${copyIndex}`;
    }
    return copy;
  }
  function resize(rows, count) {
    if (count <= rows.length) return rows.slice(0, count);
    const out = [];
    for (let i = 0; i < count; i++) {
      const copyIndex = Math.floor(i / rows.length);
      const row = rows[i % rows.length];
      out.push(copyIndex === 0 ? row : remapIdentity(row, copyIndex));
    }
    return out;
  }
  function syncTotals(root, originalLength, count) {
    const visit = (node) => {
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (!isPlainObject(node)) return;
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === "number" && TOTAL_KEY.test(key)) {
          if (count === 0) node[key] = 0;
          else if (value === originalLength) node[key] = count;
        }
        visit(value);
      }
    };
    visit(root);
  }
  function applyRowCount(root, count) {
    const wrapper = { root: structuredClone(root) };
    const hit = findPrimaryArray(wrapper.root);
    if (!hit) return wrapper.root;
    const container = hit.container;
    const rows = container[hit.key];
    const originalLength = rows.length;
    container[hit.key] = resize(rows, count);
    syncTotals(wrapper.root, originalLength, count);
    return wrapper.root;
  }
  function transformJsonText(text, count) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return text;
    }
    return JSON.stringify(applyRowCount(parsed, count));
  }

  // src/shared/types.ts
  var OFF = { rowCount: null, urlContains: null };
  var PORT = "empeo-inspector";

  // src/inject/pick.ts
  var ACCENT = "#c2610a";
  var MIN_TOKENS = 2;
  var MAX_TOKENS = 60;
  var TOAST_MS = 3600;
  var active = false;
  function startPick(candidates, onPick) {
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
      const match = bestMatch(tokens, candidates());
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
    const seen = /* @__PURE__ */ new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && out.length < MAX_TOKENS) {
      const text = normalise(node.nodeValue ?? "");
      if (text.length >= 2 && text.length <= 80 && !seen.has(text)) {
        seen.add(text);
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

  // src/inject/chaos.ts
  var SKIP_EXTENSION = /\.(js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)(\?|$)/i;
  var RULES_TIMEOUT_MS = 1e3;
  var ACCENT2 = "#c2610a";
  if (isAllowedOrigin(location.href)) {
    install();
  }
  function install() {
    const seen = /* @__PURE__ */ new Map();
    let rules = OFF;
    let ready = false;
    let release;
    const rulesReady = new Promise((resolve) => {
      release = () => {
        ready = true;
        resolve();
      };
    });
    setTimeout(() => release(), RULES_TIMEOUT_MS);
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (data?.port !== PORT) return;
      if (data.rules) {
        setRules(data.rules);
        release();
      }
      if (data.action === "pick") {
        startPick(
          () => [...seen.values()].map(({ name, samples, rows }) => ({ name, samples, rows })),
          (candidate) => {
            setRules({ ...rules, urlContains: candidate.name });
            window.postMessage({ port: PORT, picked: candidate.name }, "*");
          }
        );
      }
    });
    patchFetch();
    patchXhr();
    function setRules(next) {
      rules = next;
      paint();
    }
    function activeFor(url) {
      return rules.rowCount !== null && matchesScope(url, rules.urlContains);
    }
    function record(url, text) {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      const entry = {
        url,
        name: shortenUrl(url),
        rows: findPrimaryArray(parsed)?.length ?? null,
        samples: collectSamples(parsed)
      };
      const previous = seen.get(entry.name);
      if (previous && (previous.rows ?? -1) > (entry.rows ?? -1)) return;
      seen.set(entry.name, entry);
      window.postMessage({ port: PORT, seen: entry }, "*");
    }
    function patchFetch() {
      const original = window.fetch;
      window.fetch = async function(...args) {
        const response = await original.apply(this, args);
        const url = response.url || String(args[0]);
        if (SKIP_EXTENSION.test(url)) return response;
        if (!ready) await rulesReady;
        if (!isJsonResponse(response.headers.get("content-type"))) return response;
        const text = await response.clone().text();
        record(url, text);
        if (!activeFor(url)) return response;
        const next = transformJsonText(text, rules.rowCount);
        if (next === text) return response;
        return new Response(next, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      };
    }
    function patchXhr() {
      const open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        const href = String(url);
        if (!SKIP_EXTENSION.test(href)) {
          this.addEventListener("readystatechange", () => {
            if (this.readyState !== XMLHttpRequest.DONE) return;
            if (this.responseType !== "" && this.responseType !== "text") return;
            let text;
            try {
              text = this.responseText;
            } catch {
              return;
            }
            if (!text || !isJsonResponse(this.getResponseHeader("content-type"))) return;
            record(href, text);
            if (!activeFor(href)) return;
            const next = transformJsonText(text, rules.rowCount);
            if (next === text) return;
            Object.defineProperty(this, "responseText", { value: next, configurable: true });
            Object.defineProperty(this, "response", { value: next, configurable: true });
          });
        }
        return open.call(this, method, url, ...rest);
      };
    }
    function paint() {
      const run = () => {
        document.getElementById("empeo-inspector-banner")?.remove();
        if (rules.rowCount === null) return;
        const banner = document.createElement("div");
        banner.id = "empeo-inspector-banner";
        banner.textContent = `CHAOS \xB7 ROWS = ${rules.rowCount.toLocaleString("en-US")} \xB7 ${rules.urlContains ?? "\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E19\u0E49\u0E32"}`;
        banner.style.cssText = [
          "position:fixed",
          "inset:0 0 auto 0",
          "z-index:2147483645",
          `background:${ACCENT2}`,
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
          `border:3px solid ${ACCENT2}`,
          "pointer-events:none"
        ].join(";");
        banner.appendChild(frame);
        document.body.appendChild(banner);
      };
      if (document.body) run();
      else document.addEventListener("DOMContentLoaded", run, { once: true });
    }
  }
  function isJsonResponse(contentType) {
    return !!contentType && contentType.toLowerCase().includes("json");
  }
})();
