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

  // src/inject/chaos.ts
  var SKIP_EXTENSION = /\.(js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)(\?|$)/i;
  var RULES_TIMEOUT_MS = 1e3;
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
        release();
      }
      if (data.want === "dump") {
        window.postMessage({ port: PORT, dump: [...seen.values()] }, "*");
      }
    });
    const activeFor = (url) => rules.rowCount !== null && matchesScope(url, rules.urlContains);
    const shouldSkip = (url) => SKIP_EXTENSION.test(url);
    const announce = (url, text) => {
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
    };
    patchFetch();
    patchXhr();
    function patchFetch() {
      const original = window.fetch;
      window.fetch = async function(...args) {
        const response = await original.apply(this, args);
        const url = response.url || String(args[0]);
        if (shouldSkip(url)) return response;
        if (!ready) await rulesReady;
        if (!isJsonResponse(response.headers.get("content-type"))) return response;
        const text = await response.clone().text();
        announce(url, text);
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
        if (!shouldSkip(href)) {
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
            announce(href, text);
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
  }
  function isJsonResponse(contentType) {
    return !!contentType && contentType.toLowerCase().includes("json");
  }
})();
