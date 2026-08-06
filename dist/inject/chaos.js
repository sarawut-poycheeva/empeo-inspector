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

  // src/inject/overlay.ts
  var ACCENT = "#c2610a";
  var MIN_TOKENS = 2;
  var MAX_TOKENS = 60;
  var MAX_HOPS = 12;
  var SETTLE_MS = 120;
  var COUNTS = [
    { label: "\u0E27\u0E48\u0E32\u0E07", value: 0 },
    { label: "100", value: 100 },
    { label: "1000", value: 1e3 }
  ];
  var teardown = null;
  function isOpen() {
    return teardown !== null;
  }
  function open(hooks) {
    if (teardown || !document.body) return;
    const outline = box(["position:fixed", `outline:2px solid ${ACCENT}`, `background:${ACCENT}14`, "display:none"]);
    const badge = box([
      "position:fixed",
      "z-index:2147483647",
      "background:#14181e",
      "color:#fff",
      "font:500 11.5px/1.5 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
      "border-radius:7px",
      "padding:7px 9px",
      "display:none",
      "pointer-events:auto",
      "box-shadow:0 8px 26px rgba(0,0,0,.45)",
      "max-width:340px"
    ]);
    const flag = box([
      "position:fixed",
      "left:12px",
      "bottom:12px",
      "z-index:2147483647",
      `background:${ACCENT}`,
      "color:#fff",
      "font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
      "letter-spacing:.06em",
      "border-radius:5px",
      "padding:6px 10px"
    ]);
    flag.textContent = "\u0E42\u0E2B\u0E21\u0E14\u0E2A\u0E48\u0E2D\u0E07 \xB7 ESC \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E34\u0E14";
    document.body.append(outline, badge, flag);
    let subject = null;
    let locked = false;
    let settle;
    const onMove = (event) => {
      if (locked) return;
      const { clientX: x, clientY: y } = event;
      clearTimeout(settle);
      settle = setTimeout(() => update(x, y), SETTLE_MS);
    };
    const update = (x, y) => {
      const found = subjectAt(x, y);
      if (found === subject) return;
      subject = found;
      if (!found) {
        outline.style.display = "none";
        badge.style.display = "none";
        return;
      }
      const rect = found.getBoundingClientRect();
      Object.assign(outline.style, {
        display: "block",
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
      render(hooks.match(tokensIn(found)), rect);
    };
    const render = (hit, rect) => {
      badge.replaceChildren();
      if (!hit) {
        badge.append(line("\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E19\u0E35\u0E49\u0E21\u0E32\u0E08\u0E32\u0E01 API \u0E44\u0E2B\u0E19", "#9aa4b1"));
        badge.append(line("\u0E25\u0E2D\u0E07\u0E0A\u0E35\u0E49\u0E17\u0E35\u0E48\u0E41\u0E16\u0E27\u0E43\u0E19\u0E15\u0E32\u0E23\u0E32\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", "#6f7987"));
      } else {
        const facts = [hit.name];
        if (hit.rows !== null) facts.push(`${hit.rows.toLocaleString("en-US")} \u0E41\u0E16\u0E27`);
        if (hit.durationMs !== null) facts.push(`${Math.round(hit.durationMs)} ms`);
        badge.append(line(facts.join(" \xB7 "), "#fff"));
        const row = box(["display:flex", "gap:5px", "margin-top:6px", "flex-wrap:wrap"]);
        const applied = hooks.rowsFor(hit.name);
        for (const count of COUNTS) {
          row.append(
            action(count.label, applied === count.value, () => {
              hooks.apply(hit.name, count.value);
            })
          );
        }
        if (applied !== null) {
          row.append(
            action("\u0E04\u0E37\u0E19\u0E04\u0E48\u0E32", false, () => {
              hooks.apply(hit.name, null);
            })
          );
        }
        badge.append(row);
      }
      badge.style.display = "block";
      badge.style.visibility = "hidden";
      requestAnimationFrame(() => {
        const height = badge.offsetHeight;
        const top = rect.top - height - 8 < 8 ? rect.bottom + 8 : rect.top - height - 8;
        badge.style.top = `${Math.max(8, top)}px`;
        badge.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - badge.offsetWidth - 8))}px`;
        badge.style.visibility = "visible";
      });
    };
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      hooks.close();
    };
    badge.addEventListener("mouseenter", () => {
      locked = true;
    });
    badge.addEventListener("mouseleave", () => {
      locked = false;
    });
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("keydown", onKey, true);
    teardown = () => {
      clearTimeout(settle);
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("keydown", onKey, true);
      outline.remove();
      badge.remove();
      flag.remove();
      teardown = null;
    };
  }
  function close() {
    teardown?.();
  }
  function action(label, on, run) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = [
      "pointer-events:auto",
      "font:600 11px/1 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
      "padding:5px 9px",
      "border-radius:5px",
      "cursor:pointer",
      on ? `background:${ACCENT}` : "background:#242a33",
      on ? "border:1px solid transparent" : "border:1px solid #333b46",
      "color:#fff"
    ].join(";");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      run();
    });
    return button;
  }
  function line(text, color) {
    const node = box([`color:${color}`, "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"]);
    node.textContent = text;
    return node;
  }
  function box(styles) {
    const node = document.createElement("div");
    node.style.cssText = ["pointer-events:none", "z-index:2147483646", ...styles].join(";");
    return node;
  }
  function subjectAt(x, y) {
    let node = document.elementFromPoint(x, y);
    let hops = 0;
    while (node && node !== document.body && hops < MAX_HOPS) {
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
        rules = data.rules;
        paint();
        release();
      }
      if (typeof data.inspect === "boolean") {
        if (data.inspect) openOverlay();
        else close();
      }
      if (data.applied) location.reload();
    });
    patchFetch();
    patchXhr();
    function openOverlay() {
      if (isOpen()) return;
      open({
        match: (tokens) => {
          const candidates = [...seen.values()].map(({ name, samples, rows }) => ({ name, samples, rows }));
          const hit = bestMatch(tokens, candidates);
          return hit ? seen.get(hit.name) ?? null : null;
        },
        rowsFor: (scope) => rules.urlContains === scope ? rules.rowCount : null,
        apply: (scope, rowCount) => {
          window.postMessage({ port: PORT, apply: { urlContains: rowCount === null ? null : scope, rowCount } }, "*");
        },
        close: () => {
          close();
          window.postMessage({ port: PORT, inspect: false }, "*");
        }
      });
    }
    function activeFor(url) {
      return rules.rowCount !== null && matchesScope(url, rules.urlContains);
    }
    function record(url, text, durationMs) {
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
        durationMs,
        samples: collectSamples(parsed)
      };
      const previous = seen.get(entry.name);
      if (previous && (previous.rows ?? -1) > (entry.rows ?? -1)) return;
      seen.set(entry.name, entry);
    }
    function patchFetch() {
      const original = window.fetch;
      window.fetch = async function(...args) {
        const started = performance.now();
        const response = await original.apply(this, args);
        const url = response.url || String(args[0]);
        if (SKIP_EXTENSION.test(url)) return response;
        if (!ready) await rulesReady;
        if (!isJsonResponse(response.headers.get("content-type"))) return response;
        const text = await response.clone().text();
        record(url, text, performance.now() - started);
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
      const open2 = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        const href = String(url);
        if (!SKIP_EXTENSION.test(href)) {
          const started = performance.now();
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
            record(href, text, performance.now() - started);
            if (!activeFor(href)) return;
            const next = transformJsonText(text, rules.rowCount);
            if (next === text) return;
            Object.defineProperty(this, "responseText", { value: next, configurable: true });
            Object.defineProperty(this, "response", { value: next, configurable: true });
          });
        }
        return open2.call(this, method, url, ...rest);
      };
    }
    function paint() {
      const run = () => {
        document.getElementById("empeo-inspector-banner")?.remove();
        if (rules.rowCount === null) return;
        const banner = document.createElement("div");
        banner.id = "empeo-inspector-banner";
        banner.textContent = `CHAOS \xB7 ${rules.urlContains} \xB7 ${rules.rowCount === 0 ? "\u0E27\u0E48\u0E32\u0E07" : `${rules.rowCount.toLocaleString("en-US")} \u0E41\u0E16\u0E27`}`;
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
