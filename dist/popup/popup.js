"use strict";
(() => {
  // src/shared/icons.ts
  var ICON_ENVS = [
    { id: "dev", label: "dev", base: "https://apps-dev.gofive.co.th/" },
    { id: "uat", label: "uat", base: "https://apps-uat.gofive.co.th/" },
    { id: "prod", label: "prod", base: "https://app.gofive.co.th/modules/" }
  ];
  var CSS_PATH = "assets/icons/go5-icon/style.css";
  var ICON_PREFIX = "gf-icon-";
  function iconCssUrl(env) {
    return env.base + CSS_PATH;
  }
  function parseIconCss(css) {
    const found = /* @__PURE__ */ new Map();
    const rule = /\.([a-zA-Z0-9_-]+):before\s*\{[^}]*?content:\s*["']\\?([0-9a-fA-F]{2,6})["']/g;
    for (const match of css.matchAll(rule)) {
      const cls = match[1];
      if (found.has(cls)) continue;
      found.set(cls, {
        cls,
        short: cls.replace(/^[a-z0-9]+-icon-/i, ""),
        code: match[2].toLowerCase()
      });
    }
    return [...found.values()];
  }
  function mergeByName(perEnv) {
    const merged = /* @__PURE__ */ new Map();
    for (const [envId, icons2] of Object.entries(perEnv)) {
      for (const icon of icons2) {
        const row = merged.get(icon.short) ?? { short: icon.short, codes: {}, envs: [] };
        row.codes[envId] = icon.code;
        if (!row.envs.includes(envId)) row.envs.push(envId);
        merged.set(icon.short, row);
      }
    }
    return [...merged.values()].sort((a, b) => a.short.localeCompare(b.short, "en"));
  }
  function classOf(icon) {
    return ICON_PREFIX + icon.short;
  }
  function glyphOf(icon, fontEnv) {
    const code = icon.codes[fontEnv] ?? Object.values(icon.codes)[0];
    return code ? String.fromCodePoint(parseInt(code, 16)) : "";
  }
  function codeLabelOf(icon) {
    const seen = [];
    for (const env of ICON_ENVS) {
      const code = icon.codes[env.id];
      if (code && !seen.includes(code)) seen.push(code);
    }
    return seen.join(" / ");
  }
  function isPartial(icon) {
    return icon.envs.length < ICON_ENVS.length;
  }
  function searchIcons(icons2, query) {
    const q = query.trim().toLowerCase().replace(/^\.?(?:[a-z0-9]+-icon-)?/, "");
    if (!q) return icons2;
    const scored = [];
    for (const icon of icons2) {
      const name = icon.short.toLowerCase();
      let rank;
      if (name === q) rank = 0;
      else if (name.startsWith(q)) rank = 1;
      else if (name.includes(q)) rank = 2;
      else if (Object.values(icon.codes).includes(q)) rank = 3;
      else continue;
      scored.push({ icon, rank });
    }
    return scored.sort((a, b) => a.rank - b.rank || a.icon.short.length - b.icon.short.length).map((s) => s.icon);
  }
  function newSince(names, known) {
    const seen = new Set(known);
    return names.filter((name) => !seen.has(name));
  }

  // src/shared/tokens.generated.ts
  var TOKENS = {
    "themes": [
      "custom-light",
      "empeo-dark",
      "empeo-light",
      "etaxgo-light",
      "salesbear-light",
      "venio-dark",
      "venio-light"
    ],
    "rows": [
      {
        "key": "background-default",
        "cssVar": "--go5-background-default",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#F5F5F5",
          "empeo-dark": "#383842",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#ECECF1",
          "salesbear-light": "#F5F5F5",
          "venio-dark": "#383842",
          "venio-light": "#ECECF1"
        }
      },
      {
        "key": "background-light",
        "cssVar": "--go5-background-light",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "badge-secondary-bg",
        "cssVar": "--go5-badge-secondary-bg",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#F6F6F8",
          "empeo-dark": "#525260",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#ECECF1",
          "salesbear-light": "#F6F6F8",
          "venio-dark": "#525260",
          "venio-light": "#ECECF1"
        }
      },
      {
        "key": "badge-secondary-text",
        "cssVar": "--go5-badge-secondary-text",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#A5A5B6",
          "empeo-dark": "#BCBCC8",
          "empeo-light": "#A5A5B6",
          "etaxgo-light": "#A5A5B6",
          "salesbear-light": "#A5A5B6",
          "venio-dark": "#BCBCC8",
          "venio-light": "#A5A5B6"
        }
      },
      {
        "key": "bg-primary",
        "cssVar": "--go5-bg-primary",
        "cls": null,
        "group": "surface",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "bg-secondary",
        "cssVar": "--go5-bg-secondary",
        "cls": null,
        "group": "surface",
        "values": {
          "custom-light": "#F6F6F8",
          "empeo-dark": "#383842",
          "empeo-light": "#F6F6F8",
          "etaxgo-light": "#F6F6F8",
          "salesbear-light": "#F6F6F8",
          "venio-dark": "#383842",
          "venio-light": "#F6F6F8"
        }
      },
      {
        "key": "button-outline-default-bg",
        "cssVar": "--go5-button-outline-default-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-outline-default-line",
        "cssVar": "--go5-button-outline-default-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#DFDFE8",
          "venio-dark": "#838395",
          "venio-light": "#DFDFE8"
        }
      },
      {
        "key": "button-outline-default-text",
        "cssVar": "--go5-button-outline-default-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#525260",
          "empeo-dark": "#F6F6F8",
          "empeo-light": "#383842",
          "etaxgo-light": "#383842",
          "salesbear-light": "#525260",
          "venio-dark": "#F6F6F8",
          "venio-light": "#525260"
        }
      },
      {
        "key": "button-outline-disabled-bg",
        "cssVar": "--go5-button-outline-disabled-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-outline-disabled-line",
        "cssVar": "--go5-button-outline-disabled-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#E2E2E2",
          "empeo-dark": "#6A6A7C",
          "empeo-light": "#DFDFE8",
          "etaxgo-light": "#E2E2E2",
          "salesbear-light": "#E2E2E2",
          "venio-dark": "#6A6A7C",
          "venio-light": "#E2E2E2"
        }
      },
      {
        "key": "button-outline-disabled-text",
        "cssVar": "--go5-button-outline-disabled-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "button-outline-hover-bg",
        "cssVar": "--go5-button-outline-hover-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#F5F9FF",
          "empeo-dark": "#F05B2F1A",
          "empeo-light": "#FFF3EC",
          "etaxgo-light": "#FFEAE5",
          "salesbear-light": "#FFF8E0",
          "venio-dark": "rgba(from var(--go5-text-color-2) r g b / 0.6)",
          "venio-light": "#F5F9FF"
        }
      },
      {
        "key": "button-outline-hover-line",
        "cssVar": "--go5-button-outline-hover-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-outline-hover-text",
        "cssVar": "--go5-button-outline-hover-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-outline-pressed-bg",
        "cssVar": "--go5-button-outline-pressed-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#E7F0FF",
          "empeo-dark": "#FFE1CC",
          "empeo-light": "#FFE1CC",
          "etaxgo-light": "#FFBEB2",
          "salesbear-light": "#FFEAA3",
          "venio-dark": "#051F47",
          "venio-light": "#E7F0FF"
        }
      },
      {
        "key": "button-outline-pressed-line",
        "cssVar": "--go5-button-outline-pressed-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-outline-pressed-text",
        "cssVar": "--go5-button-outline-pressed-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-primary-default-bg",
        "cssVar": "--go5-button-primary-default-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-primary-default-line",
        "cssVar": "--go5-button-primary-default-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-primary-default-text",
        "cssVar": "--go5-button-primary-default-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#FFFFFF",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#FFFFFF",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-primary-disabled-bg",
        "cssVar": "--go5-button-primary-disabled-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#F5F5F5",
          "empeo-dark": "#525260",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#ECECF1",
          "salesbear-light": "#F5F5F5",
          "venio-dark": "#525260",
          "venio-light": "#F5F5F5"
        }
      },
      {
        "key": "button-primary-disabled-line",
        "cssVar": "--go5-button-primary-disabled-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#F5F5F5",
          "empeo-dark": "#525260",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#ECECF1",
          "salesbear-light": "#F5F5F5",
          "venio-dark": "#525260",
          "venio-light": "#F5F5F5"
        }
      },
      {
        "key": "button-primary-disabled-text",
        "cssVar": "--go5-button-primary-disabled-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#A5A5B6",
          "empeo-light": "#BCBCC8",
          "etaxgo-light": "#BCBCC8",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#A5A5B6",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "button-primary-hover-bg",
        "cssVar": "--go5-button-primary-hover-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#418AFD",
          "empeo-dark": "#F26C44",
          "empeo-light": "#F26C44",
          "etaxgo-light": "#F96252",
          "salesbear-light": "#FFDC66",
          "venio-dark": "#418AFD",
          "venio-light": "#418AFD"
        }
      },
      {
        "key": "button-primary-hover-line",
        "cssVar": "--go5-button-primary-hover-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#418AFD",
          "empeo-dark": "#F26C44",
          "empeo-light": "#F26C44",
          "etaxgo-light": "#F96252",
          "salesbear-light": "#FFDC66",
          "venio-dark": "#418AFD",
          "venio-light": "#418AFD"
        }
      },
      {
        "key": "button-primary-hover-text",
        "cssVar": "--go5-button-primary-hover-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#FFFFFF",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#FFFFFF",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-primary-pressed-bg",
        "cssVar": "--go5-button-primary-pressed-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#035CE6",
          "empeo-dark": "#E54111",
          "empeo-light": "#E54111",
          "etaxgo-light": "#C71F22",
          "salesbear-light": "#FFB700",
          "venio-dark": "#035CE6",
          "venio-light": "#035CE6"
        }
      },
      {
        "key": "button-primary-pressed-line",
        "cssVar": "--go5-button-primary-pressed-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#035CE6",
          "empeo-dark": "#E54111",
          "empeo-light": "#E54111",
          "etaxgo-light": "#C71F22",
          "salesbear-light": "#FFB700",
          "venio-dark": "#035CE6",
          "venio-light": "#035CE6"
        }
      },
      {
        "key": "button-primary-pressed-text",
        "cssVar": "--go5-button-primary-pressed-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#FFFFFF",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#FFFFFF",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-secondary-default-bg",
        "cssVar": "--go5-button-secondary-default-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-secondary-default-line",
        "cssVar": "--go5-button-secondary-default-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#6A6A7C",
          "empeo-light": "#DFDFE8",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#DFDFE8",
          "venio-dark": "#6A6A7C",
          "venio-light": "#DFDFE8"
        }
      },
      {
        "key": "button-secondary-default-text",
        "cssVar": "--go5-button-secondary-default-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#525260",
          "empeo-dark": "#ECECF1",
          "empeo-light": "#525260",
          "etaxgo-light": "#525260",
          "salesbear-light": "#525260",
          "venio-dark": "#ECECF1",
          "venio-light": "#525260"
        }
      },
      {
        "key": "button-secondary-disabled-bg",
        "cssVar": "--go5-button-secondary-disabled-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "button-secondary-disabled-line",
        "cssVar": "--go5-button-secondary-disabled-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#E2E2E2",
          "empeo-dark": "#6A6A7C",
          "empeo-light": "#DFDFE8",
          "etaxgo-light": "#E2E2E2",
          "salesbear-light": "#E2E2E2",
          "venio-dark": "#6A6A7C",
          "venio-light": "#DFDFE8"
        }
      },
      {
        "key": "button-secondary-disabled-text",
        "cssVar": "--go5-button-secondary-disabled-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "button-secondary-hover-bg",
        "cssVar": "--go5-button-secondary-hover-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#F6F6F8",
          "empeo-dark": "#383842",
          "empeo-light": "#F6F6F8",
          "etaxgo-light": "#F6F6F8",
          "salesbear-light": "#F6F6F8",
          "venio-dark": "#383842",
          "venio-light": "#F6F6F8"
        }
      },
      {
        "key": "button-secondary-hover-line",
        "cssVar": "--go5-button-secondary-hover-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#D9D9D9",
          "empeo-light": "#D9D9D9",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#DFDFE8",
          "venio-dark": "#D9D9D9",
          "venio-light": "#DFDFE8"
        }
      },
      {
        "key": "button-secondary-hover-text",
        "cssVar": "--go5-button-secondary-hover-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#525260",
          "empeo-dark": "#ECECF1",
          "empeo-light": "#525260",
          "etaxgo-light": "#525260",
          "salesbear-light": "#525260",
          "venio-dark": "#ECECF1",
          "venio-light": "#525260"
        }
      },
      {
        "key": "button-secondary-pressed-bg",
        "cssVar": "--go5-button-secondary-pressed-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "rgba(226, 226, 226, 0.6)",
          "empeo-dark": "#525260",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#ECECF1",
          "salesbear-light": "rgba(226, 226, 226, 0.6)",
          "venio-dark": "#525260",
          "venio-light": "rgba(226, 226, 226, 0.6)"
        }
      },
      {
        "key": "button-secondary-pressed-line",
        "cssVar": "--go5-button-secondary-pressed-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#D9D9D9",
          "empeo-light": "#D9D9D9",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#DFDFE8",
          "venio-dark": "#D9D9D9",
          "venio-light": "#DFDFE8"
        }
      },
      {
        "key": "button-secondary-pressed-text",
        "cssVar": "--go5-button-secondary-pressed-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#525260",
          "empeo-dark": "#ECECF1",
          "empeo-light": "#525260",
          "etaxgo-light": "#525260",
          "salesbear-light": "#525260",
          "venio-dark": "#ECECF1",
          "venio-light": "#525260"
        }
      },
      {
        "key": "button-text-default-bg",
        "cssVar": "--go5-button-text-default-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-default-line",
        "cssVar": "--go5-button-text-default-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-default-text",
        "cssVar": "--go5-button-text-default-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "button-text-disabled-bg",
        "cssVar": "--go5-button-text-disabled-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-disabled-line",
        "cssVar": "--go5-button-text-disabled-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-disabled-text",
        "cssVar": "--go5-button-text-disabled-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#A5A5B6",
          "empeo-light": "#BCBCC8",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#A5A5B6",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "button-text-hover-bg",
        "cssVar": "--go5-button-text-hover-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-hover-line",
        "cssVar": "--go5-button-text-hover-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-hover-text",
        "cssVar": "--go5-button-text-hover-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#418AFD",
          "empeo-dark": "#F26C44",
          "empeo-light": "#F26C44",
          "etaxgo-light": "#F96252",
          "salesbear-light": "#FFDC66",
          "venio-dark": "#418AFD",
          "venio-light": "#418AFD"
        }
      },
      {
        "key": "button-text-pressed-bg",
        "cssVar": "--go5-button-text-pressed-bg",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-pressed-line",
        "cssVar": "--go5-button-text-pressed-line",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "transparent",
          "empeo-dark": "transparent",
          "empeo-light": "transparent",
          "etaxgo-light": "transparent",
          "salesbear-light": "transparent",
          "venio-dark": "transparent",
          "venio-light": "transparent"
        }
      },
      {
        "key": "button-text-pressed-text",
        "cssVar": "--go5-button-text-pressed-text",
        "cls": null,
        "group": "button",
        "values": {
          "custom-light": "#035CE6",
          "empeo-dark": "#E54111",
          "empeo-light": "#E54111",
          "etaxgo-light": "#C71F22",
          "salesbear-light": "#FFB700",
          "venio-dark": "#035CE6",
          "venio-light": "#035CE6"
        }
      },
      {
        "key": "card-bg-color",
        "cssVar": "--go5-card-bg-color",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "#383842",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#383842",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "card-hover",
        "cssVar": "--go5-card-hover",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "rgba(255, 255, 255, 0.16)",
          "empeo-light": "rgba(0, 0, 0, 0.16)",
          "etaxgo-light": "rgba(0, 0, 0, 0.16)",
          "salesbear-light": "rgba(0, 0, 0, 0.16)",
          "venio-dark": "rgba(255, 255, 255, 0.16)",
          "venio-light": "rgba(0, 0, 0, 0.16)"
        }
      },
      {
        "key": "card-shadow",
        "cssVar": "--go5-card-shadow",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "rgba(255, 255, 255, 0.08)",
          "empeo-light": "rgba(0, 0, 0, 0.08)",
          "etaxgo-light": "rgba(0, 0, 0, 0.08)",
          "salesbear-light": "rgba(0, 0, 0, 0.08)",
          "venio-dark": "rgba(255, 255, 255, 0.08)",
          "venio-light": "rgba(0, 0, 0, 0.08)"
        }
      },
      {
        "key": "color-error",
        "cssVar": "--go5-color-error",
        "cls": "go5-color-error",
        "group": "semantic",
        "values": {
          "custom-light": "#DE3A45",
          "empeo-dark": "#C81720",
          "empeo-light": "#C81720",
          "etaxgo-light": "#C81720",
          "salesbear-light": "#DE3A45",
          "venio-dark": "#FF3B30",
          "venio-light": "#DE3A45"
        }
      },
      {
        "key": "color-loading",
        "cssVar": "--go5-color-loading",
        "cls": null,
        "group": "semantic",
        "values": {
          "custom-light": "#418AFD",
          "empeo-dark": "#F26C44",
          "empeo-light": "#F26C44",
          "etaxgo-light": "#F96252",
          "salesbear-light": "#FFDC66",
          "venio-dark": "#418AFD",
          "venio-light": "#418AFD"
        }
      },
      {
        "key": "color-primary",
        "cssVar": "--go5-color-primary",
        "cls": "go5-color-primary",
        "group": "semantic",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#F05B2F",
          "empeo-light": "#F05B2F",
          "etaxgo-light": "#EB1C26",
          "salesbear-light": "#FFC505",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        }
      },
      {
        "key": "color-primary-dark",
        "cssVar": "--go5-color-primary-dark",
        "cls": null,
        "group": "semantic",
        "values": {
          "custom-light": "#035CE6",
          "empeo-dark": "#E54111",
          "empeo-light": "#E54111",
          "etaxgo-light": "#C71F22",
          "salesbear-light": "#FFB700",
          "venio-dark": "#035CE6",
          "venio-light": "#035CE6"
        }
      },
      {
        "key": "color-secondary",
        "cssVar": "--go5-color-secondary",
        "cls": "go5-color-secondary",
        "group": "semantic",
        "values": {
          "custom-light": "#F5F9FF",
          "empeo-dark": "#F05B2F1A",
          "empeo-light": "#FFF3EC",
          "etaxgo-light": "#FFEAE5",
          "salesbear-light": "#FFF8E0",
          "venio-dark": "#1A2641",
          "venio-light": "#F5F9FF"
        }
      },
      {
        "key": "color-success",
        "cssVar": "--go5-color-success",
        "cls": "go5-color-success",
        "group": "semantic",
        "values": {
          "custom-light": "#21CE9B",
          "empeo-dark": "#00C291",
          "empeo-light": "#00C291",
          "etaxgo-light": "#16BC6D",
          "salesbear-light": "#21CE9B",
          "venio-dark": "#21CE9B",
          "venio-light": "#21CE9B"
        }
      },
      {
        "key": "color-warning",
        "cssVar": "--go5-color-warning",
        "cls": null,
        "group": "semantic",
        "values": {
          "custom-light": "#EFC439",
          "empeo-dark": "#FFB31A",
          "empeo-light": "#FFB31A",
          "etaxgo-light": "#FFB31A",
          "salesbear-light": "#FFB700",
          "venio-dark": "#FFB31A",
          "venio-light": "#EFC439"
        }
      },
      {
        "key": "hover-bg-table",
        "cssVar": "--go5-hover-bg-table",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "#2D2D36",
          "empeo-light": "#FAFAFB",
          "venio-dark": "#2D2D36",
          "venio-light": "#FAFAFB"
        }
      },
      {
        "key": "input-bg",
        "cssVar": "--go5-input-bg",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "input-disabled-bg",
        "cssVar": "--go5-input-disabled-bg",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#F6F6F8",
          "empeo-dark": "#383842",
          "empeo-light": "#F6F6F8",
          "etaxgo-light": "#F6F6F8",
          "salesbear-light": "#F6F6F8",
          "venio-dark": "#383842",
          "venio-light": "#F6F6F8"
        }
      },
      {
        "key": "input-disabled-text",
        "cssVar": "--go5-input-disabled-text",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#FFFFFF",
          "empeo-light": "#1C1C22",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "input-icon",
        "cssVar": "--go5-input-icon",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#BCBCC8",
          "empeo-dark": "#A5A5B6",
          "empeo-light": "#BCBCC8",
          "etaxgo-light": "#BCBCC8",
          "salesbear-light": "#BCBCC8",
          "venio-dark": "#A5A5B6",
          "venio-light": "#BCBCC8"
        }
      },
      {
        "key": "input-label",
        "cssVar": "--go5-input-label",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#838395",
          "empeo-dark": "#D2D2DA",
          "empeo-light": "#838395",
          "etaxgo-light": "#838395",
          "salesbear-light": "#838395",
          "venio-dark": "#D2D2DA",
          "venio-light": "#838395"
        }
      },
      {
        "key": "input-line",
        "cssVar": "--go5-input-line",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "input-placeholder",
        "cssVar": "--go5-input-placeholder",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "input-tertiary-bg",
        "cssVar": "--go5-input-tertiary-bg",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#FFF8E0",
          "empeo-dark": "#FFF8E0",
          "empeo-light": "#FFF8E0",
          "etaxgo-light": "#FFF8E0",
          "salesbear-light": "#FFF8E0",
          "venio-dark": "#FFF8E0",
          "venio-light": "#FFF8E0"
        }
      },
      {
        "key": "input-tertiary-icon",
        "cssVar": "--go5-input-tertiary-icon",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#F8CA51",
          "empeo-dark": "#F8CA51",
          "empeo-light": "#F8CA51",
          "etaxgo-light": "#F8CA51",
          "salesbear-light": "#F8CA51",
          "venio-dark": "#F8CA51",
          "venio-light": "#F8CA51"
        }
      },
      {
        "key": "input-tertiary-line",
        "cssVar": "--go5-input-tertiary-line",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#FFDC66",
          "empeo-dark": "#FFDC66",
          "empeo-light": "#FFDC66",
          "etaxgo-light": "#FFDC66",
          "salesbear-light": "#FFDC66",
          "venio-dark": "#FFDC66",
          "venio-light": "#FFDC66"
        }
      },
      {
        "key": "input-tertiary-text",
        "cssVar": "--go5-input-tertiary-text",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#1A1A1A",
          "empeo-dark": "#1A1A1A",
          "empeo-light": "#1A1A1A",
          "etaxgo-light": "#1A1A1A",
          "salesbear-light": "#1A1A1A",
          "venio-dark": "#1A1A1A",
          "venio-light": "#1A1A1A"
        }
      },
      {
        "key": "input-text",
        "cssVar": "--go5-input-text",
        "cls": null,
        "group": "input",
        "values": {
          "custom-light": "#1C1C22",
          "empeo-dark": "#FFFFFF",
          "empeo-light": "#1C1C22",
          "etaxgo-light": "#1C1C22",
          "salesbear-light": "#1C1C22",
          "venio-dark": "#FFFFFF",
          "venio-light": "#1C1C22"
        }
      },
      {
        "key": "nav-background",
        "cssVar": "--go5-nav-background",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "linear-gradient(180deg, #0581F6 0%, #0FB3E6 68.75%)",
          "empeo-dark": "linear-gradient(180deg, #F47243 9.18%, #E54111 71.62%)",
          "empeo-light": "linear-gradient(180deg, #F47243 9.18%, #E54111 71.62%)",
          "etaxgo-light": "linear-gradient(180deg, #C71F22 9.18%, #EB1C26 71.62%)",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "linear-gradient(180deg, #0581F6 0%, #0FB3E6 68.75%)",
          "venio-light": "linear-gradient(180deg, #0581F6 0%, #0FB3E6 68.75%)"
        }
      },
      {
        "key": "nav-bg-icon-active",
        "cssVar": "--go5-nav-bg-icon-active",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "rgb(26 26 26 / 20%)",
          "empeo-dark": "rgb(255 255 255 / 30%)",
          "empeo-light": "rgb(255 255 255 / 30%)",
          "etaxgo-light": "rgb(255 255 255 / 30%)",
          "salesbear-light": "#FFF3CC",
          "venio-dark": "rgb(255 255 255 / 30%)",
          "venio-light": "rgb(26 26 26 / 20%)"
        }
      },
      {
        "key": "nav-box-shadow",
        "cssVar": "--go5-nav-box-shadow",
        "cls": null,
        "group": "other",
        "values": {
          "salesbear-light": "drop-shadow(0px 0px 10px rgba(202, 202, 202, 0.5))"
        }
      },
      {
        "key": "nav-icon-active",
        "cssVar": "--go5-nav-icon-active",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFC505",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "nav-icon-default",
        "cssVar": "--go5-nav-icon-default",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#B5B5B5",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "note-bg",
        "cssVar": "--go5-note-bg",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "linear-gradient(0deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.72) 100%), #FFDC66",
          "empeo-light": "#FFFDF3",
          "etaxgo-light": "#FFFDF3",
          "salesbear-light": "#FFFDF3",
          "venio-dark": "linear-gradient(0deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.72) 100%), #FFDC66",
          "venio-light": "#FFFDF3"
        }
      },
      {
        "key": "note-border",
        "cssVar": "--go5-note-border",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "#FFEAA3",
          "empeo-light": "#FFC505",
          "etaxgo-light": "#FFC505",
          "salesbear-light": "#FFC505",
          "venio-dark": "#FFEAA3",
          "venio-light": "#FFC505"
        }
      },
      {
        "key": "selection-active-bg",
        "cssVar": "--go5-selection-active-bg",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#F5F9FF",
          "empeo-dark": "linear-gradient(0deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.72) 100%), currentColor",
          "empeo-light": "#FFF3EC",
          "etaxgo-light": "#FFEAE5",
          "salesbear-light": "#FFF8E0",
          "venio-dark": "linear-gradient(0deg, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.72) 100%), currentColor",
          "venio-light": "#F5F9FF"
        }
      },
      {
        "key": "selection-default-bg",
        "cssVar": "--go5-selection-default-bg",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "selection-default-line",
        "cssVar": "--go5-selection-default-line",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#D9D9D9",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D9D9D9",
          "venio-dark": "#838395",
          "venio-light": "#D9D9D9"
        }
      },
      {
        "key": "selection-default-text",
        "cssVar": "--go5-selection-default-text",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#838395",
          "empeo-dark": "#D2D2DA",
          "empeo-light": "#838395",
          "etaxgo-light": "#838395",
          "salesbear-light": "#838395",
          "venio-dark": "#D2D2DA",
          "venio-light": "#838395"
        }
      },
      {
        "key": "selection-disabled-bg",
        "cssVar": "--go5-selection-disabled-bg",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#F5F5F5",
          "empeo-dark": "#383842",
          "empeo-light": "#F6F6F8",
          "etaxgo-light": "#F6F6F8",
          "salesbear-light": "#F6F6F8",
          "venio-dark": "#383842",
          "venio-light": "#F6F6F8"
        }
      },
      {
        "key": "selection-disabled-line",
        "cssVar": "--go5-selection-disabled-line",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#D9D9D9",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D9D9D9",
          "venio-dark": "#838395",
          "venio-light": "#D9D9D9"
        }
      },
      {
        "key": "selection-disabled-text",
        "cssVar": "--go5-selection-disabled-text",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "shadow-basic",
        "cssVar": "--go5-shadow-basic",
        "cls": null,
        "group": "shadow",
        "values": {
          "empeo-dark": "0 0 12px 0 rgba(255, 255, 255, 0.10)",
          "empeo-light": "0 0 12px 0 rgba(0, 0, 0, 0.10)",
          "etaxgo-light": "0 0 12px 0 rgba(0, 0, 0, 0.10)",
          "salesbear-light": "0 0 12px 0 rgba(0, 0, 0, 0.10)",
          "venio-dark": "0 0 12px 0 rgba(255, 255, 255, 0.10)",
          "venio-light": "0 0 12px 0 rgba(0, 0, 0, 0.10)"
        }
      },
      {
        "key": "shadow-highlight",
        "cssVar": "--go5-shadow-highlight",
        "cls": null,
        "group": "shadow",
        "values": {
          "empeo-dark": "0 2px 12px 0 rgba(255, 255, 255, 0.16)",
          "empeo-light": "0 2px 12px 0 rgba(0, 0, 0, 0.16)",
          "etaxgo-light": "0 2px 12px 0 rgba(0, 0, 0, 0.16)",
          "salesbear-light": "0 2px 12px 0 rgba(0, 0, 0, 0.16)",
          "venio-dark": "0 2px 12px 0 rgba(255, 255, 255, 0.16)",
          "venio-light": "0 2px 12px 0 rgba(0, 0, 0, 0.16)"
        }
      },
      {
        "key": "shadow-soft",
        "cssVar": "--go5-shadow-soft",
        "cls": null,
        "group": "shadow",
        "values": {
          "empeo-dark": "0 0 8px 0 rgba(255, 255, 255, 0.08)",
          "empeo-light": "0 0 8px 0 rgba(0, 0, 0, 0.08)",
          "etaxgo-light": "0 0 8px 0 rgba(0, 0, 0, 0.08)",
          "salesbear-light": "0 0 8px 0 rgba(0, 0, 0, 0.08)",
          "venio-dark": "0 0 8px 0 rgba(255, 255, 255, 0.08)",
          "venio-light": "0 0 8px 0 rgba(0, 0, 0, 0.08)"
        }
      },
      {
        "key": "table-body",
        "cssVar": "--go5-table-body",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "table-header",
        "cssVar": "--go5-table-header",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#ECECF1",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#ECECF1",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "table-header-icon-sort",
        "cssVar": "--go5-table-header-icon-sort",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF99",
          "empeo-dark": "#FFFFFF99",
          "empeo-light": "#FFFFFF99",
          "etaxgo-light": "#FFFFFF99",
          "salesbear-light": "#6A6A7C",
          "venio-dark": "#FFFFFF99",
          "venio-light": "#FFFFFF99"
        }
      },
      {
        "key": "table-header-text",
        "cssVar": "--go5-table-header-text",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#383842",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "table-hover",
        "cssVar": "--go5-table-hover",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#F5F5F5",
          "empeo-dark": "#F6F6F8",
          "empeo-light": "#F6F6F8",
          "etaxgo-light": "#F6F6F8",
          "salesbear-light": "#F5F5F5",
          "venio-dark": "rgba(56, 56, 66, 0.6)",
          "venio-light": "#ECECF1"
        }
      },
      {
        "key": "table-hover-content-bg",
        "cssVar": "--go5-table-hover-content-bg",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#FAFAFB",
          "empeo-dark": "#2D2D35",
          "empeo-light": "#FAFAFB",
          "etaxgo-light": "#FAFAFB",
          "salesbear-light": "#FAFAFB",
          "venio-dark": "#2D2D35",
          "venio-light": "#FAFAFB"
        }
      },
      {
        "key": "table-line",
        "cssVar": "--go5-table-line",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#E2E2E2",
          "empeo-dark": "#6A6A7C",
          "empeo-light": "#E2E2E2",
          "etaxgo-light": "#E2E2E2",
          "salesbear-light": "#E2E2E2",
          "venio-dark": "#6A6A7C",
          "venio-light": "#E2E2E2"
        }
      },
      {
        "key": "tag-default-bg",
        "cssVar": "--go5-tag-default-bg",
        "cls": null,
        "group": "other",
        "values": {
          "custom-light": "#F5F9FF",
          "empeo-dark": "#F05B2F1A",
          "empeo-light": "#FFF3EC",
          "etaxgo-light": "#FFEAE5",
          "salesbear-light": "#FFF8E0",
          "venio-dark": "#1A2641",
          "venio-light": "#E7F0FF"
        }
      },
      {
        "key": "tag-hover",
        "cssVar": "--go5-tag-hover",
        "cls": null,
        "group": "other",
        "values": {
          "empeo-dark": "#072C65",
          "empeo-light": "#FFE1CC",
          "etaxgo-light": "#FFD8D1",
          "salesbear-light": "#FFF2C8",
          "venio-dark": "#072C65",
          "venio-light": "rgba(184, 211, 254, 0.60)"
        }
      },
      {
        "key": "text-color-1",
        "cssVar": "--go5-text-color-1",
        "cls": "go5-text-color-1",
        "group": "text",
        "values": {
          "custom-light": "#FFFFFF",
          "empeo-dark": "#1C1C22",
          "empeo-light": "#FFFFFF",
          "etaxgo-light": "#FFFFFF",
          "salesbear-light": "#FFFFFF",
          "venio-dark": "#1C1C22",
          "venio-light": "#FFFFFF"
        }
      },
      {
        "key": "text-color-10",
        "cssVar": "--go5-text-color-10",
        "cls": "go5-text-color-10",
        "group": "text",
        "values": {
          "custom-light": "#525260",
          "empeo-dark": "#ECECF1",
          "empeo-light": "#525260",
          "etaxgo-light": "#525260",
          "salesbear-light": "#525260",
          "venio-dark": "#ECECF1",
          "venio-light": "#525260"
        }
      },
      {
        "key": "text-color-11",
        "cssVar": "--go5-text-color-11",
        "cls": "go5-text-color-11",
        "group": "text",
        "values": {
          "custom-light": "#383842",
          "empeo-dark": "#F6F6F8",
          "empeo-light": "#383842",
          "etaxgo-light": "#383842",
          "salesbear-light": "#383842",
          "venio-dark": "#F6F6F8",
          "venio-light": "#383842"
        }
      },
      {
        "key": "text-color-12",
        "cssVar": "--go5-text-color-12",
        "cls": "go5-text-color-12",
        "group": "text",
        "values": {
          "custom-light": "#1C1C22",
          "empeo-dark": "#FFFFFF",
          "empeo-light": "#1C1C22",
          "etaxgo-light": "#1C1C22",
          "salesbear-light": "#1C1C22",
          "venio-dark": "#FFFFFF",
          "venio-light": "#1C1C22"
        }
      },
      {
        "key": "text-color-2",
        "cssVar": "--go5-text-color-2",
        "cls": "go5-text-color-2",
        "group": "text",
        "values": {
          "custom-light": "#F6F6F8",
          "empeo-dark": "#383842",
          "empeo-light": "#F6F6F8",
          "etaxgo-light": "#F6F6F8",
          "salesbear-light": "#F6F6F8",
          "venio-dark": "#383842",
          "venio-light": "#F6F6F8"
        }
      },
      {
        "key": "text-color-3",
        "cssVar": "--go5-text-color-3",
        "cls": "go5-text-color-3",
        "group": "text",
        "values": {
          "custom-light": "#ECECF1",
          "empeo-dark": "#525260",
          "empeo-light": "#ECECF1",
          "etaxgo-light": "#ECECF1",
          "salesbear-light": "#ECECF1",
          "venio-dark": "#525260",
          "venio-light": "#ECECF1"
        }
      },
      {
        "key": "text-color-4",
        "cssVar": "--go5-text-color-4",
        "cls": "go5-text-color-4",
        "group": "text",
        "values": {
          "custom-light": "#DFDFE8",
          "empeo-dark": "#6A6A7C",
          "empeo-light": "#DFDFE8",
          "etaxgo-light": "#DFDFE8",
          "salesbear-light": "#DFDFE8",
          "venio-dark": "#6A6A7C",
          "venio-light": "#DFDFE8"
        }
      },
      {
        "key": "text-color-5",
        "cssVar": "--go5-text-color-5",
        "cls": "go5-text-color-5",
        "group": "text",
        "values": {
          "custom-light": "#D2D2DA",
          "empeo-dark": "#838395",
          "empeo-light": "#D2D2DA",
          "etaxgo-light": "#D2D2DA",
          "salesbear-light": "#D2D2DA",
          "venio-dark": "#838395",
          "venio-light": "#D2D2DA"
        }
      },
      {
        "key": "text-color-6",
        "cssVar": "--go5-text-color-6",
        "cls": "go5-text-color-6",
        "group": "text",
        "values": {
          "custom-light": "#BCBCC8",
          "empeo-dark": "#A5A5B6",
          "empeo-light": "#BCBCC8",
          "etaxgo-light": "#BCBCC8",
          "salesbear-light": "#BCBCC8",
          "venio-dark": "#A5A5B6",
          "venio-light": "#BCBCC8"
        }
      },
      {
        "key": "text-color-7",
        "cssVar": "--go5-text-color-7",
        "cls": "go5-text-color-7",
        "group": "text",
        "values": {
          "custom-light": "#A5A5B6",
          "empeo-dark": "#BCBCC8",
          "empeo-light": "#A5A5B6",
          "etaxgo-light": "#A5A5B6",
          "salesbear-light": "#A5A5B6",
          "venio-dark": "#BCBCC8",
          "venio-light": "#A5A5B6"
        }
      },
      {
        "key": "text-color-8",
        "cssVar": "--go5-text-color-8",
        "cls": "go5-text-color-8",
        "group": "text",
        "values": {
          "custom-light": "#838395",
          "empeo-dark": "#D2D2DA",
          "empeo-light": "#838395",
          "etaxgo-light": "#838395",
          "salesbear-light": "#838395",
          "venio-dark": "#D2D2DA",
          "venio-light": "#838395"
        }
      },
      {
        "key": "text-color-9",
        "cssVar": "--go5-text-color-9",
        "cls": "go5-text-color-9",
        "group": "text",
        "values": {
          "custom-light": "#6A6A7C",
          "empeo-dark": "#DFDFE8",
          "empeo-light": "#6A6A7C",
          "etaxgo-light": "#6A6A7C",
          "salesbear-light": "#6A6A7C",
          "venio-dark": "#DFDFE8",
          "venio-light": "#6A6A7C"
        }
      },
      {
        "key": "feature-activity",
        "cssVar": null,
        "cls": "go5-color-feature-activity",
        "group": "feature",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#116DFC",
          "empeo-light": "#116DFC",
          "etaxgo-light": "#116DFC",
          "salesbear-light": "#116DFC",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        },
        "invalidHex": false
      },
      {
        "key": "feature-deal",
        "cssVar": null,
        "cls": "go5-color-feature-deal",
        "group": "feature",
        "values": {
          "custom-light": "#E00095",
          "empeo-dark": "#E00095",
          "empeo-light": "#E00095",
          "etaxgo-light": "#E00095",
          "salesbear-light": "#E00095",
          "venio-dark": "#E00095",
          "venio-light": "#E00095"
        },
        "invalidHex": false
      },
      {
        "key": "feature-case",
        "cssVar": null,
        "cls": "go5-color-feature-case",
        "group": "feature",
        "values": {
          "custom-light": "#FAC005",
          "empeo-dark": "#FAC005",
          "empeo-light": "#FAC005",
          "etaxgo-light": "#FAC005",
          "salesbear-light": "#FAC005",
          "venio-dark": "#FAC005",
          "venio-light": "#FAC005"
        },
        "invalidHex": false
      },
      {
        "key": "feature-customer",
        "cssVar": null,
        "cls": "go5-color-feature-customer",
        "group": "feature",
        "values": {
          "custom-light": "#4ca32",
          "empeo-dark": "#4ca32",
          "empeo-light": "#4ca32",
          "etaxgo-light": "#4ca32",
          "salesbear-light": "#4ca32",
          "venio-dark": "#4ca32",
          "venio-light": "#4ca32"
        },
        "invalidHex": true
      },
      {
        "key": "feature-quotation",
        "cssVar": null,
        "cls": "go5-color-feature-quotation",
        "group": "feature",
        "values": {
          "custom-light": "#7D2EF0",
          "empeo-dark": "#7D2EF0",
          "empeo-light": "#7D2EF0",
          "etaxgo-light": "#7D2EF0",
          "salesbear-light": "#7D2EF0",
          "venio-dark": "#7D2EF0",
          "venio-light": "#7D2EF0"
        },
        "invalidHex": false
      },
      {
        "key": "feature-salesorder",
        "cssVar": null,
        "cls": "go5-color-feature-salesorder",
        "group": "feature",
        "values": {
          "custom-light": "#116df",
          "empeo-dark": "#116df",
          "empeo-light": "#116df",
          "etaxgo-light": "#116df",
          "salesbear-light": "#116df",
          "venio-dark": "#116df",
          "venio-light": "#116df"
        },
        "invalidHex": true
      },
      {
        "key": "feature-expense",
        "cssVar": null,
        "cls": "go5-color-feature-expense",
        "group": "feature",
        "values": {
          "custom-light": "#3AA8AF",
          "empeo-dark": "#3AA8AF",
          "empeo-light": "#3AA8AF",
          "etaxgo-light": "#3AA8AF",
          "salesbear-light": "#3AA8AF",
          "venio-dark": "#3AA8AF",
          "venio-light": "#3AA8AF"
        },
        "invalidHex": false
      },
      {
        "key": "feature-conversation",
        "cssVar": null,
        "cls": "go5-color-feature-conversation",
        "group": "feature",
        "values": {
          "custom-light": "#116df",
          "empeo-dark": "#116df",
          "empeo-light": "#116df",
          "etaxgo-light": "#116df",
          "salesbear-light": "#116df",
          "venio-dark": "#116df",
          "venio-light": "#116df"
        },
        "invalidHex": true
      },
      {
        "key": "feature-contract",
        "cssVar": null,
        "cls": "go5-color-feature-contract",
        "group": "feature",
        "values": {
          "custom-light": "#0848AF",
          "empeo-dark": "#0848AF",
          "empeo-light": "#0848AF",
          "etaxgo-light": "#0848AF",
          "salesbear-light": "#0848AF",
          "venio-dark": "#0848AF",
          "venio-light": "#0848AF"
        },
        "invalidHex": false
      },
      {
        "key": "feature-task",
        "cssVar": null,
        "cls": "go5-color-feature-task",
        "group": "feature",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#116DFC",
          "empeo-light": "#116DFC",
          "etaxgo-light": "#116DFC",
          "salesbear-light": "#116DFC",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        },
        "invalidHex": false
      },
      {
        "key": "feature-warranty",
        "cssVar": null,
        "cls": "go5-color-feature-warranty",
        "group": "feature",
        "values": {
          "custom-light": "#116DFC",
          "empeo-dark": "#116DFC",
          "empeo-light": "#116DFC",
          "etaxgo-light": "#116DFC",
          "salesbear-light": "#116DFC",
          "venio-dark": "#116DFC",
          "venio-light": "#116DFC"
        },
        "invalidHex": false
      }
    ]
  };

  // src/shared/tokens.ts
  var HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  function normalizeHex(input) {
    if (!input) return null;
    const m = String(input).trim().match(HEX_RE);
    if (!m) return null;
    let v = m[1];
    if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    return `#${v.slice(0, 6).toUpperCase()}`;
  }
  function toRgb(hex) {
    const n = normalizeHex(hex);
    if (!n) return null;
    return [
      parseInt(n.slice(1, 3), 16),
      parseInt(n.slice(3, 5), 16),
      parseInt(n.slice(5, 7), 16)
    ];
  }
  function colorDistance(a, b) {
    const x = toRgb(a);
    const y = toRgb(b);
    if (!x || !y) return Infinity;
    const dr = x[0] - y[0];
    const dg = x[1] - y[1];
    const db = x[2] - y[2];
    return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
  }
  function parseRgba(input) {
    if (!input) return null;
    const m = String(input).match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.%]+))?\s*\)/i
    );
    if (m) {
      const rawAlpha = m[4];
      const a = rawAlpha === void 0 ? 1 : rawAlpha.includes("%") ? parseFloat(rawAlpha) / 100 : parseFloat(rawAlpha);
      return { r: +m[1], g: +m[2], b: +m[3], a };
    }
    const rgb = toRgb(input);
    return rgb ? { r: rgb[0], g: rgb[1], b: rgb[2], a: 1 } : null;
  }
  function parseShadow(input) {
    if (!input) return null;
    const text = String(input).trim();
    if (!text || text === "none") return null;
    let color = null;
    let rest = text.replace(/rgba?\([^)]*\)/i, (m) => {
      color = m;
      return " ";
    });
    if (!color) {
      const hex = rest.match(/#[0-9a-fA-F]{3,8}/);
      if (hex) {
        color = hex[0];
        rest = rest.replace(hex[0], " ");
      }
    }
    const nums = (rest.match(/-?[\d.]+/g) ?? []).map(Number);
    if (!nums.length) return null;
    return {
      color: parseRgba(color) ?? { r: 0, g: 0, b: 0, a: 1 },
      x: nums[0] ?? 0,
      y: nums[1] ?? 0,
      blur: nums[2] ?? 0,
      spread: nums[3] ?? 0,
      inset: /\binset\b/i.test(text)
    };
  }
  function shadowDistance(a, b) {
    if (!a || !b) return Infinity;
    if (a.inset !== b.inset) return Infinity;
    const geometry = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.blur - b.blur) + Math.abs(a.spread - b.spread);
    const rgb = Math.abs(a.color.r - b.color.r) + Math.abs(a.color.g - b.color.g) + Math.abs(a.color.b - b.color.b);
    return geometry + rgb / 8 + Math.abs(a.color.a - b.color.a) * 100;
  }
  function looksLikeShadow(input) {
    const text = input.trim();
    if (normalizeHex(text)) return false;
    const hasColor = /rgba?\(|#[0-9a-f]{3,8}/i.test(text);
    const numbers = (text.replace(/rgba?\([^)]*\)/i, " ").match(/-?[\d.]+/g) ?? []).length;
    return hasColor && numbers >= 2 || numbers >= 3;
  }
  var GROUP_RANK = {
    text: 0,
    semantic: 1,
    surface: 2,
    shadow: 3,
    feature: 4,
    input: 5,
    button: 6,
    other: 7
  };
  function tokenRank(row) {
    return (row.cls ? 0 : 10) + GROUP_RANK[row.group];
  }
  function valueOf(row, brand2, mode2) {
    return row.values[`${brand2}-${mode2}`] ?? null;
  }
  function hasTheme(table, brand2, mode2) {
    return table.themes.includes(`${brand2}-${mode2}`);
  }
  function brandsOf(table) {
    const seen = [];
    for (const theme of table.themes) {
      const brand2 = theme.replace(/-(light|dark)$/, "");
      if (!seen.includes(brand2)) seen.push(brand2);
    }
    const preferred = ["empeo", "venio"];
    return seen.sort((a, b) => {
      const ia = preferred.indexOf(a);
      const ib = preferred.indexOf(b);
      return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b);
    });
  }
  function findByHex(table, hex, brand2) {
    const target = normalizeHex(hex);
    if (!target) return [];
    const best = /* @__PURE__ */ new Map();
    for (const row of table.rows) {
      if (row.group === "shadow") continue;
      for (const mode2 of ["light", "dark"]) {
        const value = normalizeHex(valueOf(row, brand2, mode2));
        if (!value) continue;
        const distance = colorDistance(target, value);
        const current = best.get(row.key);
        if (!current || distance < current.distance) best.set(row.key, { row, distance });
      }
    }
    return [...best.values()].sort(
      (a, b) => a.distance - b.distance || tokenRank(a.row) - tokenRank(b.row)
    );
  }
  function findByShadow(table, value, brand2) {
    const target = parseShadow(value);
    if (!target) return [];
    return table.rows.filter((row) => row.group === "shadow").map((row) => ({
      row,
      distance: Math.min(
        shadowDistance(target, parseShadow(valueOf(row, brand2, "light"))),
        shadowDistance(target, parseShadow(valueOf(row, brand2, "dark")))
      )
    })).filter((hit) => Number.isFinite(hit.distance)).sort((a, b) => a.distance - b.distance);
  }
  function findByName(table, needle) {
    const q = needle.trim().toLowerCase().replace(/^[.\-]+/, "");
    if (!q) return [];
    return table.rows.filter((row) => `${row.key} ${row.cls ?? ""} ${row.cssVar ?? ""}`.toLowerCase().includes(q)).sort((a, b) => tokenRank(a) - tokenRank(b));
  }
  function usageOf(row) {
    return row.cls ? `.${row.cls}` : `var(${row.cssVar})`;
  }

  // src/popup/popup.ts
  var GROUPS = [
    { id: "text", name: "Text ramp" },
    { id: "semantic", name: "Semantic" },
    { id: "surface", name: "Surface" },
    { id: "shadow", name: "Shadow" },
    { id: "button", name: "Button \xB7 internal" },
    { id: "input", name: "Input \xB7 internal" },
    { id: "other", name: "Other" }
  ];
  var NO_RESULT = '<div class="idle">No result</div>';
  var $q = document.getElementById("q");
  var $chip = document.getElementById("chip");
  var $clear = document.getElementById("clear");
  var $ansBlock = document.getElementById("ansblk");
  var $ansLabel = document.getElementById("anslbl");
  var $ans = document.getElementById("ans");
  var $list = document.getElementById("list");
  var $brand = document.getElementById("brand");
  var $group = document.getElementById("group");
  var $light = document.getElementById("mode-light");
  var $dark = document.getElementById("mode-dark");
  var $pick = document.getElementById("pick");
  var $fold = document.getElementById("fold");
  var $tokenBody = document.getElementById("tokenbody");
  var $toast = document.getElementById("toast");
  var $lensColors = document.getElementById("lens-colors");
  var $lensIcons = document.getElementById("lens-icons");
  var $panelColors = document.getElementById("panel-colors");
  var $panelIcons = document.getElementById("panel-icons");
  var $iconGrid = document.getElementById("icongrid");
  var $iconIdle = document.getElementById("iconidle");
  var $iconLabel = document.getElementById("iconlbl");
  var $envLine = document.getElementById("envline");
  var $icAll = document.getElementById("ic-all");
  var $icNew = document.getElementById("ic-new");
  var $icPartial = document.getElementById("ic-partial");
  var $viewCards = document.getElementById("view-cards");
  var $viewGrid = document.getElementById("view-grid");
  var $refresh = document.getElementById("refresh");
  var brands = brandsOf(TOKENS);
  var brand = brands.includes("empeo") ? "empeo" : brands[0];
  var mode = "light";
  var group = "text";
  var toastTimer;
  function toast(message) {
    $toast.textContent = message;
    $toast.classList.add("on");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => $toast.classList.remove("on"), 1600);
  }
  function copy(text) {
    void navigator.clipboard.writeText(text).then(
      () => toast(`Copied \xB7 ${text}`),
      () => toast(text)
    );
  }
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function swatch(value, big = false) {
    if (value && /px/.test(value)) {
      return `<span class="shbox${big ? " big" : ""}" style="box-shadow:${escapeHtml(value)}"></span>`;
    }
    const hex = normalizeHex(value);
    return `<span class="sw${big ? " big" : ""}">${hex ? `<i style="background:${hex}"></i>` : ""}</span>`;
  }
  function typeTag(row) {
    return row.cls ? '<span class="tag cls">class</span>' : '<span class="tag varonly">var()</span>';
  }
  function bindCopy(host) {
    for (const el of host.querySelectorAll("[data-use]")) {
      el.addEventListener("click", (event) => {
        event.preventDefault();
        copy(el.dataset.use ?? "");
      });
    }
  }
  function valuesRow(light, dark, matched) {
    const hitLight = matched && normalizeHex(light) && normalizeHex(light) === normalizeHex(matched);
    const hitDark = matched && normalizeHex(dark) && normalizeHex(dark) === normalizeHex(matched);
    const longest = Math.max((light ?? "").length, (dark ?? "").length);
    return `<div class="ans-vals${longest > 14 ? " stack" : ""}"><span class="lv"><b>LIGHT</b>${swatch(light)}<span class="${hitLight ? "hit" : ""}">${light ?? "\u2014"}</span></span><span class="lv"><b>DARK</b>${swatch(dark)}<span class="${hitDark ? "hit" : ""}">${dark ?? "\u2014"}</span></span></div>`;
  }
  function answerCard(row, matched, distance) {
    const light = valueOf(row, brand, "light");
    const dark = valueOf(row, brand, "dark");
    const use = usageOf(row);
    return `<div class="ans"><div class="ans-top">${swatch(matched ?? light, true)}<span class="cn">${escapeHtml(use)}</span><button class="copy" type="button" data-use="${escapeHtml(use)}">Copy</button></div><div class="ans-meta">` + typeTag(row) + (distance > 0 ? `<span class="tag near">\u0394 ${Math.round(distance)}</span>` : "") + (row.invalidHex ? '<span class="tag bad">invalid hex in DS</span>' : "") + "</div>" + valuesRow(light, dark, matched) + "</div>";
  }
  function altRow(row, distance) {
    const use = usageOf(row);
    return `<button class="row" type="button" data-use="${escapeHtml(use)}">` + swatch(valueOf(row, brand, mode) ?? valueOf(row, brand, "light")) + `<span class="cn${row.cls ? "" : " vo"}">${escapeHtml(use)}</span><span class="meta">` + (distance > 0 ? `<span class="hx">\u0394 ${Math.round(distance)}</span>` : "") + typeTag(row) + "</span></button>";
  }
  function expander(label, rows, open = false) {
    if (!rows.length) return "";
    return `<details class="more"${open ? " open" : ""}><summary>${label}</summary><div class="rows">${rows.join("")}</div></details>`;
  }
  function syncSearchChrome() {
    $clear.hidden = !$q.value;
    $chip.style.background = (lens === "colors" ? normalizeHex($q.value.trim()) : null) ?? "transparent";
  }
  function renderAnswer() {
    syncSearchChrome();
    const query = $q.value.trim();
    if (!query) {
      $ansBlock.hidden = true;
      $ansLabel.textContent = "Result";
      $ans.innerHTML = "";
      return;
    }
    $ansBlock.hidden = false;
    const hex = normalizeHex(query);
    if (hex) {
      renderHex(hex);
    } else if (looksLikeShadow(query)) {
      renderShadow(query);
    } else {
      renderName(query);
    }
    bindCopy($ans);
  }
  function renderHex(hex) {
    const hits = findByHex(TOKENS, hex, brand);
    const exact = hits.filter((h) => h.distance === 0).sort((a, b) => tokenRank(a.row) - tokenRank(b.row));
    const near = hits.filter((h) => h.distance > 0);
    if (exact.length) {
      $ansLabel.textContent = `Exact match \xB7 ${hex}`;
      $ans.innerHTML = answerCard(exact[0].row, hex, 0) + expander(
        `${exact.length - 1} more tokens share this color`,
        exact.slice(1, 10).map((h) => altRow(h.row, 0))
      );
      return;
    }
    if (near.length) {
      $ansLabel.textContent = `No exact match \xB7 ${hex}`;
      $ans.innerHTML = answerCard(near[0].row, hex, near[0].distance) + expander(
        "Other close matches",
        near.slice(1, 5).map((h) => altRow(h.row, h.distance)),
        true
      );
      return;
    }
    $ansLabel.textContent = "Result";
    $ans.innerHTML = NO_RESULT;
  }
  function renderShadow(value) {
    const hits = findByShadow(TOKENS, value, brand);
    if (!hits.length) {
      $ansLabel.textContent = "Result";
      $ans.innerHTML = NO_RESULT;
      return;
    }
    const top = hits[0];
    const use = usageOf(top.row);
    $ansLabel.textContent = `${top.distance === 0 ? "Exact match" : "No exact match"} \xB7 box-shadow`;
    $ans.innerHTML = `<div class="ans"><div class="ans-top">${swatch(value, true)}<span class="cn">${top.distance === 0 ? escapeHtml(use) : "No matching token"}</span><button class="copy" type="button" data-use="${escapeHtml(use)}">Copy</button></div><div class="ans-meta"><span class="tag varonly">var()</span>` + (top.distance > 0 ? `<span class="tag near">closest ${top.row.key} \xB7 \u0394 ${Math.round(top.distance)}</span>` : "") + "</div>" + valuesRow(valueOf(top.row, brand, "light"), valueOf(top.row, brand, "dark"), null) + "</div>" + expander(
      `${hits.length - 1} other DS shadows`,
      hits.slice(1).map((h) => altRow(h.row, h.distance))
    );
  }
  function renderName(query) {
    const found = findByName(TOKENS, query);
    if (!found.length) {
      $ansLabel.textContent = "Result";
      $ans.innerHTML = NO_RESULT;
      return;
    }
    $ansLabel.textContent = `${found.length} ${found.length === 1 ? "token" : "tokens"}`;
    $ans.innerHTML = answerCard(found[0], null, 0) + expander(
      `${found.length - 1} more`,
      found.slice(1, 12).map((row) => altRow(row, 0)),
      true
    );
  }
  function renderList() {
    const rows = TOKENS.rows.filter((row) => row.group === group).sort((a, b) => {
      if (!!a.cls !== !!b.cls) return a.cls ? -1 : 1;
      return a.key.localeCompare(b.key, "en", { numeric: true });
    });
    if (!rows.length) {
      $list.innerHTML = NO_RESULT;
      return;
    }
    $list.innerHTML = rows.map((row) => {
      const value = valueOf(row, brand, mode);
      const use = usageOf(row);
      return `<button class="row" type="button" data-use="${escapeHtml(use)}">` + swatch(value) + `<span class="cn${row.cls ? "" : " vo"}">${escapeHtml(use)}</span><span class="hx">${value ?? "\u2014"}</span></button>`;
    }).join("");
    bindCopy($list);
  }
  function syncMode() {
    const dark = hasTheme(TOKENS, brand, "dark");
    $dark.disabled = !dark;
    $dark.title = dark ? "" : `no dark theme for ${brand}`;
    if (!dark && mode === "dark") mode = "light";
    $light.setAttribute("aria-pressed", String(mode === "light"));
    $dark.setAttribute("aria-pressed", String(mode === "dark"));
  }
  function applyAccent() {
    const primary = TOKENS.rows.find((row) => row.key === "color-primary");
    const hex = primary ? normalizeHex(valueOf(primary, brand, "light")) : null;
    if (hex) document.documentElement.style.setProperty("--accent", hex);
  }
  for (const name of brands) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    option.selected = name === brand;
    $brand.append(option);
  }
  for (const entry of GROUPS) {
    if (!TOKENS.rows.some((row) => row.group === entry.id)) continue;
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    option.selected = entry.id === group;
    $group.append(option);
  }
  $brand.addEventListener("change", () => {
    brand = $brand.value;
    syncMode();
    applyAccent();
    renderList();
    renderAnswer();
  });
  $group.addEventListener("change", () => {
    group = $group.value;
    renderList();
  });
  $light.addEventListener("click", () => {
    mode = "light";
    syncMode();
    renderList();
  });
  $dark.addEventListener("click", () => {
    if ($dark.disabled) return;
    mode = "dark";
    syncMode();
    renderList();
  });
  var ICON_CACHE_KEY = "ds-icons:snapshot:v1";
  var ICON_VIEW_KEY = "ds-icons:view";
  var ICON_BASELINE_KEY = "ds-icons:baseline:v1";
  var icons = [];
  var iconFilter = "all";
  var iconView = readIconView();
  var iconsLoaded = false;
  var baseline = readBaseline();
  var freshNames = /* @__PURE__ */ new Set();
  function readBaseline() {
    try {
      const raw = localStorage.getItem(ICON_BASELINE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeBaseline(names) {
    baseline = { at: Date.now(), names };
    try {
      localStorage.setItem(ICON_BASELINE_KEY, JSON.stringify(baseline));
    } catch {
    }
  }
  function diffAgainstBaseline() {
    const names = icons.map((icon) => icon.short);
    if (baseline) {
      freshNames = new Set(newSince(names, baseline.names));
    } else {
      writeBaseline(names);
      freshNames = /* @__PURE__ */ new Set();
    }
    $icNew.disabled = freshNames.size === 0;
    if (!freshNames.size && iconFilter === "new") iconFilter = "all";
  }
  function isFresh(icon) {
    return freshNames.has(icon.short);
  }
  function markAllSeen() {
    writeBaseline(icons.map((icon) => icon.short));
    freshNames = /* @__PURE__ */ new Set();
    if (iconFilter === "new") setIconFilter("all");
    else renderIconsPanel();
  }
  function readIconView() {
    try {
      return localStorage.getItem(ICON_VIEW_KEY) === "grid" ? "grid" : "cards";
    } catch {
      return "cards";
    }
  }
  function readIconCache() {
    try {
      const raw = localStorage.getItem(ICON_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function writeIconCache(snapshot) {
    try {
      localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
    }
  }
  async function fetchIconSets(hard = false) {
    const perEnv = {};
    const modified = {};
    await Promise.all(
      ICON_ENVS.map(async (env) => {
        const res = await fetch(iconCssUrl(env), { cache: hard ? "reload" : "no-cache" });
        if (!res.ok) throw new Error(`${env.id}: HTTP ${res.status}`);
        perEnv[env.id] = parseIconCss(await res.text());
        const lastModified = res.headers.get("last-modified");
        if (lastModified) modified[env.id] = lastModified;
      })
    );
    return { perEnv, modified };
  }
  function shortDate(value) {
    if (!value) return "?";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "?";
    return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function clockOf(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  function partialFlag() {
    const behind = icons.filter(isPartial);
    if (!behind.length) return "";
    const shapes = new Set(behind.map((icon) => [...icon.envs].sort().join("+")));
    const title = shapes.size === 1 ? `${behind.length} icon(s) exist only on ${[...shapes][0].split("+").join(", ")}` : `${behind.length} icons are on some environments but not all`;
    return ` <span class="warn" title="${escapeHtml(title)}">${behind.length} Mismatched</span>`;
  }
  function freshFlag() {
    if (!freshNames.size) return "";
    const since = baseline ? ` since ${shortDate(new Date(baseline.at).toUTCString())}` : "";
    const title = `${freshNames.size} icon(s) added${since} \u2014 click to mark them all as seen`;
    return ` <button type="button" class="newchip" id="seen" title="${escapeHtml(title)}">${freshNames.size} New \u2713</button>`;
  }
  var lastSnapshot = null;
  function renderIconsPanel() {
    renderEnvLine(lastSnapshot);
    renderIcons();
  }
  function renderEnvLine(snapshot) {
    lastSnapshot = snapshot;
    if (!snapshot) {
      $envLine.innerHTML = "";
      return;
    }
    const counts = ICON_ENVS.map((env) => {
      const count = snapshot.perEnv[env.id]?.length ?? 0;
      const deployed = snapshot.modified?.[env.id];
      const title = deployed ? `${env.label} \u2014 last shipped ${shortDate(deployed)} (${deployed})` : env.label;
      return `<span title="${escapeHtml(title)}">${env.label} <b>${count}</b></span>`;
    }).join(" \xB7 ");
    const synced = `<span class="when sync">Synced ${clockOf(snapshot.fetchedAt)}</span>`;
    $envLine.innerHTML = `<div class="envrow">${counts}${freshFlag()}${partialFlag()}${synced}</div>`;
    document.getElementById("seen")?.addEventListener("click", markAllSeen);
  }
  function renderIcons() {
    const pool = iconFilter === "partial" ? icons.filter(isPartial) : iconFilter === "new" ? icons.filter(isFresh) : icons;
    const list = searchIcons(pool, $q.value);
    $iconLabel.textContent = list.length === pool.length ? "Icons" : `Icons \xB7 ${list.length}`;
    if (!icons.length) return;
    if (!list.length) {
      $iconGrid.innerHTML = "";
      $iconIdle.hidden = false;
      $iconIdle.textContent = "No result";
      return;
    }
    $iconGrid.classList.toggle("dense", iconView === "grid");
    $iconGrid.innerHTML = list.map(iconView === "grid" ? tileHtml : cardHtml).join("");
    bindCopy($iconGrid);
    $iconIdle.hidden = true;
  }
  function cardHtml(icon) {
    const cls = classOf(icon);
    const dots = ICON_ENVS.map((env) => {
      const has = icon.envs.includes(env.id);
      return `<span class="dot ${has ? "has" : "no"}" title="${env.label}${has ? "" : " \u2014 missing"}">${env.label}</span>`;
    }).join("");
    return `<button class="icard${marks(icon)}" type="button" data-use="${cls}"><span class="top"><span class="glyph">${glyphOf(icon, "uat")}</span><span class="nm" title="${cls}">${escapeHtml(icon.short)}</span>${isFresh(icon) ? '<span class="newtag">NEW</span>' : ""}</span><span class="foot"><span class="code">${codeLabelOf(icon)}</span><span class="dots">${dots}</span></span></button>`;
  }
  function marks(icon) {
    return `${isPartial(icon) ? " partial" : ""}${isFresh(icon) ? " fresh" : ""}`;
  }
  function tileHtml(icon) {
    const cls = classOf(icon);
    const missing = ICON_ENVS.filter((env) => !icon.envs.includes(env.id)).map((env) => env.label);
    const notes = [isFresh(icon) ? "new" : "", missing.length ? `missing on ${missing.join(", ")}` : ""].filter(Boolean);
    const title = notes.length ? `${cls} \u2014 ${notes.join(", ")}` : cls;
    return `<button class="itile${marks(icon)}" type="button" data-use="${cls}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><span class="glyph">${glyphOf(icon, "uat")}</span></button>`;
  }
  async function loadIcons(hard = false) {
    if (iconsLoaded && !hard) return;
    iconsLoaded = true;
    const cached = readIconCache();
    if (cached && !hard) {
      icons = mergeByName(cached.perEnv);
      diffAgainstBaseline();
      renderEnvLine(cached);
      renderIcons();
      $iconIdle.hidden = true;
    }
    $refresh.classList.add("is-busy");
    try {
      const { perEnv, modified } = await fetchIconSets(hard);
      const snapshot = { fetchedAt: Date.now(), perEnv, modified };
      writeIconCache(snapshot);
      icons = mergeByName(perEnv);
      diffAgainstBaseline();
      renderEnvLine(snapshot);
      renderIcons();
      $iconIdle.hidden = true;
      if (hard) toast(freshNames.size ? `Synced \xB7 ${freshNames.size} new` : `Synced \xB7 ${icons.length} icons`);
    } catch (error) {
      iconsLoaded = false;
      if (!cached) {
        $iconIdle.hidden = false;
        $iconIdle.textContent = "Could not load the icon set from the CDN";
      } else {
        toast("Showing cached data \u2014 sync failed");
      }
      console.error(error);
    } finally {
      $refresh.classList.remove("is-busy");
    }
  }
  var LENS_KEY = "ds-colors:lens";
  var lens = "colors";
  var queries = { colors: "", icons: "" };
  function applyLens(next) {
    if (next !== lens) queries[lens] = $q.value;
    lens = next;
    const isIcons = next === "icons";
    $q.value = queries[next];
    $lensColors.setAttribute("aria-selected", String(!isIcons));
    $lensIcons.setAttribute("aria-selected", String(isIcons));
    $panelColors.hidden = isIcons;
    $panelIcons.hidden = !isIcons;
    $brand.hidden = isIcons;
    $pick.hidden = isIcons || !window.EyeDropper;
    $q.placeholder = isIcons ? "Search icons by name or codepoint" : "Paste hex, box-shadow or token name";
    localStorage.setItem(LENS_KEY, next);
    if (isIcons) void loadIcons();
    renderCurrent();
  }
  function renderCurrent() {
    if (lens === "icons") {
      syncSearchChrome();
      scheduleIconRender();
    } else {
      renderAnswer();
    }
  }
  var iconRenderTimer;
  function scheduleIconRender() {
    if (iconRenderTimer !== void 0) clearTimeout(iconRenderTimer);
    iconRenderTimer = setTimeout(() => {
      iconRenderTimer = void 0;
      renderIcons();
    }, 70);
  }
  $lensColors.addEventListener("click", () => applyLens("colors"));
  $lensIcons.addEventListener("click", () => applyLens("icons"));
  function setIconFilter(next) {
    iconFilter = next;
    $icAll.setAttribute("aria-pressed", String(next === "all"));
    $icNew.setAttribute("aria-pressed", String(next === "new"));
    $icPartial.setAttribute("aria-pressed", String(next === "partial"));
    $icNew.disabled = freshNames.size === 0;
    renderIconsPanel();
  }
  for (const [id, value] of [
    ["ic-all", "all"],
    ["ic-new", "new"],
    ["ic-partial", "partial"]
  ]) {
    document.getElementById(id)?.addEventListener("click", () => setIconFilter(value));
  }
  for (const [id, value] of [
    ["view-cards", "cards"],
    ["view-grid", "grid"]
  ]) {
    document.getElementById(id)?.addEventListener("click", () => {
      iconView = value;
      try {
        localStorage.setItem(ICON_VIEW_KEY, value);
      } catch {
      }
      applyIconView();
      renderIcons();
    });
  }
  function applyIconView() {
    $viewCards.setAttribute("aria-pressed", String(iconView === "cards"));
    $viewGrid.setAttribute("aria-pressed", String(iconView === "grid"));
  }
  applyIconView();
  $refresh.addEventListener("click", () => {
    void loadIcons(true);
  });
  $q.addEventListener("input", renderCurrent);
  $clear.addEventListener("click", () => {
    $q.value = "";
    $q.focus();
    renderCurrent();
  });
  function iconCells() {
    return [...$iconGrid.querySelectorAll("[data-use]")];
  }
  function columnCount() {
    const columns = getComputedStyle($iconGrid).gridTemplateColumns;
    return Math.max(1, columns.split(" ").filter(Boolean).length);
  }
  function focusCell(index) {
    const cells = iconCells();
    if (!cells.length) return;
    const target = cells[Math.max(0, Math.min(index, cells.length - 1))];
    target.focus();
    target.scrollIntoView({ block: "nearest" });
  }
  $q.addEventListener("keydown", (event) => {
    if (lens !== "icons" || event.key !== "ArrowDown") return;
    event.preventDefault();
    focusCell(0);
  });
  $iconGrid.addEventListener("keydown", (event) => {
    const cells = iconCells();
    const here = cells.indexOf(document.activeElement);
    if (here < 0) return;
    const step = columnCount();
    const moves = {
      ArrowRight: here + 1,
      ArrowLeft: here - 1,
      ArrowDown: here + step,
      ArrowUp: here - step,
      Home: 0,
      End: cells.length - 1
    };
    if (event.key === "ArrowUp" && here < step) {
      event.preventDefault();
      $q.focus();
      return;
    }
    if (event.key in moves) {
      event.preventDefault();
      focusCell(moves[event.key]);
      return;
    }
    if (event.key === "Escape" || event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
      $q.focus();
    }
  });
  function setUpEyeDropper() {
    const Dropper = window.EyeDropper;
    if (!Dropper) return;
    $pick.hidden = false;
    $pick.addEventListener("click", () => {
      $pick.classList.add("is-busy");
      new Dropper().open().then(
        (result) => {
          $pick.classList.remove("is-busy");
          $q.value = result.sRGBHex.toUpperCase();
          renderAnswer();
          $q.focus();
        },
        () => {
          $pick.classList.remove("is-busy");
        }
      );
    });
  }
  var FOLD_KEY = "ds-colors:tokens-folded";
  function applyFold(folded) {
    $tokenBody.hidden = folded;
    $fold.setAttribute("aria-expanded", String(!folded));
    $fold.title = folded ? "Show tokens" : "Hide tokens";
  }
  function setUpFold() {
    let folded = localStorage.getItem(FOLD_KEY) === "1";
    applyFold(folded);
    $fold.addEventListener("click", () => {
      folded = !folded;
      localStorage.setItem(FOLD_KEY, folded ? "1" : "0");
      applyFold(folded);
    });
  }
  setUpEyeDropper();
  setUpFold();
  applyLens(localStorage.getItem(LENS_KEY) ?? "colors");
  syncMode();
  applyAccent();
  renderList();
  renderAnswer();
  $q.focus();
})();
