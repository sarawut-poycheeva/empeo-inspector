import {
	classOf,
	codeLabelOf,
	fontFamilyOf,
	glyphSourceOf,
	ICON_ENVS,
	iconCssUrl,
	iconFontUrl,
	isPartial,
	mergeByName,
	parseIconCss,
	recordSync,
	searchIcons,
	unseenAdditions,
	type Icon,
	type IconEnv,
	type IconHistory,
	type ParsedIcon,
} from "../shared/icons.ts";
import {
	activeCount,
	addEntry,
	DEFAULT_PORT,
	deriveName,
	labelOf,
	moduleCandidates,
	normalizePath,
	parsePort,
	REDIRECT_STORAGE_KEYS,
	targetUrl,
	type RedirectEntry,
	type RedirectState,
} from "../shared/redirect.ts";
import {
	DEFAULT_SCREENS_STATE,
	PRESETS,
	SCREENS_STORAGE_KEY,
	toggle as toggleScreen,
	UNSUPPORTED_PAGE,
	type ScreensState,
} from "../shared/screens.ts";
import { TOKENS } from "../shared/tokens.generated.ts";
import {
	brandsOf,
	findByHex,
	findByName,
	findByShadow,
	hasTheme,
	looksLikeShadow,
	normalizeHex,
	tokenRank,
	usageOf,
	valueOf,
	type Hit,
	type Mode,
	type TokenGroup,
	type TokenRow,
} from "../shared/tokens.ts";

/**
 * `EyeDropper` is not in TypeScript's DOM library yet, and it is not on every
 * Chrome build, so it is declared here and feature-detected before use.
 */
interface EyeDropperResult {
	sRGBHex: string;
}

interface EyeDropperInstance {
	open(options?: { signal?: AbortSignal }): Promise<EyeDropperResult>;
}

declare global {
	interface Window {
		EyeDropper?: new () => EyeDropperInstance;
	}
}

/** Feature colours stay searchable by hex but are not worth a browse entry. */
const GROUPS: { id: TokenGroup; name: string }[] = [
	{ id: "text", name: "Text ramp" },
	{ id: "semantic", name: "Semantic" },
	{ id: "surface", name: "Surface" },
	{ id: "shadow", name: "Shadow" },
	{ id: "button", name: "Button · internal" },
	{ id: "input", name: "Input · internal" },
	{ id: "other", name: "Other" },
];

const NO_RESULT = '<div class="idle">No result</div>';

const $q = document.getElementById("q") as HTMLInputElement;
const $chip = document.getElementById("chip") as HTMLElement;
const $clear = document.getElementById("clear") as HTMLButtonElement;
const $ansBlock = document.getElementById("ansblk") as HTMLElement;
const $ansLabel = document.getElementById("anslbl") as HTMLElement;
const $ans = document.getElementById("ans") as HTMLElement;
const $list = document.getElementById("list") as HTMLElement;
const $brand = document.getElementById("brand") as HTMLSelectElement;
const $group = document.getElementById("group") as HTMLSelectElement;
const $light = document.getElementById("mode-light") as HTMLButtonElement;
const $dark = document.getElementById("mode-dark") as HTMLButtonElement;
const $pick = document.getElementById("pick") as HTMLButtonElement;
const $fold = document.getElementById("fold") as HTMLButtonElement;
const $tokenBody = document.getElementById("tokenbody") as HTMLElement;
const $toast = document.getElementById("toast") as HTMLElement;

const $lensColors = document.getElementById("lens-colors") as HTMLButtonElement;
const $lensIcons = document.getElementById("lens-icons") as HTMLButtonElement;
const $panelColors = document.getElementById("panel-colors") as HTMLElement;
const $panelIcons = document.getElementById("panel-icons") as HTMLElement;
const $iconGrid = document.getElementById("icongrid") as HTMLElement;
const $iconIdle = document.getElementById("iconidle") as HTMLElement;
const $iconLabel = document.getElementById("iconlbl") as HTMLElement;
const $envLine = document.getElementById("envline") as HTMLElement;
const $icAll = document.getElementById("ic-all") as HTMLButtonElement;
const $icNew = document.getElementById("ic-new") as HTMLButtonElement;
const $icPartial = document.getElementById("ic-partial") as HTMLButtonElement;
const $viewCards = document.getElementById("view-cards") as HTMLButtonElement;
const $viewGrid = document.getElementById("view-grid") as HTMLButtonElement;
const $refresh = document.getElementById("refresh") as HTMLButtonElement;

const $search = document.querySelector(".search") as HTMLElement;
const $lensRedirect = document.getElementById("lens-redirect") as HTMLButtonElement;
const $panelRedirect = document.getElementById("panel-redirect") as HTMLElement;
const $lensScreens = document.getElementById("lens-screens") as HTMLButtonElement;
const $panelScreens = document.getElementById("panel-screens") as HTMLElement;
const $sizes = document.getElementById("sizes") as HTMLElement;
const $scrOpen = document.getElementById("scropen") as HTMLButtonElement;
const $scrHost = document.getElementById("scrhost") as HTMLElement;
const $scrNotice = document.getElementById("scrnotice") as HTMLElement;
const $rules = document.getElementById("rules") as HTMLElement;
const $ruleIdle = document.getElementById("ruleidle") as HTMLElement;
const $notice = document.getElementById("rnotice") as HTMLElement;
const $global = document.getElementById("global") as HTMLInputElement;
const $armed = document.getElementById("armed") as HTMLElement;
const $addRule = document.getElementById("addrule") as HTMLFormElement;
const $rPath = document.getElementById("rpath") as HTMLInputElement;
const $rPort = document.getElementById("rport") as HTMLInputElement;
const $rAdd = document.getElementById("radd") as HTMLButtonElement;
const $rCancel = document.getElementById("rcancel") as HTMLButtonElement;
const $scan = document.getElementById("scan") as HTMLButtonElement;
const $found = document.getElementById("found") as HTMLElement;
const $foundLabel = document.getElementById("foundlbl") as HTMLElement;
const $foundList = document.getElementById("foundlist") as HTMLElement;
const $foundClose = document.getElementById("foundclose") as HTMLButtonElement;

const brands = brandsOf(TOKENS);
let brand = brands.includes("empeo") ? "empeo" : brands[0];
let mode: Mode = "light";
let group: TokenGroup = "text";

// ---------- small helpers ----------

let toastTimer: number | undefined;

function toast(message: string): void {
	$toast.textContent = message;
	$toast.classList.add("on");
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => $toast.classList.remove("on"), 1600);
}

function copy(text: string): void {
	void navigator.clipboard.writeText(text).then(
		() => toast(`Copied · ${text}`),
		() => toast(text),
	);
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A value containing `px` is a shadow, so preview it as a shadowed box. */
function swatch(value: string | null, big = false): string {
	if (value && /px/.test(value)) {
		return `<span class="shbox${big ? " big" : ""}" style="box-shadow:${escapeHtml(value)}"></span>`;
	}
	const hex = normalizeHex(value);
	return `<span class="sw${big ? " big" : ""}">${hex ? `<i style="background:${hex}"></i>` : ""}</span>`;
}

function typeTag(row: TokenRow): string {
	return row.cls ? '<span class="tag cls">class</span>' : '<span class="tag varonly">var()</span>';
}

function bindCopy(host: HTMLElement): void {
	for (const el of host.querySelectorAll<HTMLElement>("[data-use]")) {
		el.addEventListener("click", (event) => {
			event.preventDefault();
			copy(el.dataset.use ?? "");
		});
	}
}

// ---------- answer card ----------

function valuesRow(light: string | null, dark: string | null, matched: string | null): string {
	const hitLight = matched && normalizeHex(light) && normalizeHex(light) === normalizeHex(matched);
	const hitDark = matched && normalizeHex(dark) && normalizeHex(dark) === normalizeHex(matched);
	const longest = Math.max((light ?? "").length, (dark ?? "").length);

	return (
		`<div class="ans-vals${longest > 14 ? " stack" : ""}">` +
		`<span class="lv"><b>LIGHT</b>${swatch(light)}<span class="${hitLight ? "hit" : ""}">${light ?? "—"}</span></span>` +
		`<span class="lv"><b>DARK</b>${swatch(dark)}<span class="${hitDark ? "hit" : ""}">${dark ?? "—"}</span></span>` +
		`</div>`
	);
}

/**
 * Says why a token whose stored value looks nothing like the input is
 * nevertheless the right answer. Without it the card reads as a wrong hit: the
 * value row shows `#F05B2F1A` under a heading that claims an exact match on
 * `#322223`, which is the sort of thing that makes someone stop trusting the
 * lens. The percentage is also the actionable half — it is what has to be
 * written next to the token.
 */
function blendTag(blend: Hit["blend"]): string {
	if (!blend) return "";
	const text = `${Math.round(blend.alpha * 100)}% over ${blend.over}`;
	return `<span class="tag blend" title="This token is translucent — what you picked is it composited on ${blend.over}">${escapeHtml(text)}</span>`;
}

function answerCard(row: TokenRow, matched: string | null, distance: number, blend?: Hit["blend"]): string {
	const light = valueOf(row, brand, "light");
	const dark = valueOf(row, brand, "dark");
	const use = usageOf(row);

	return (
		'<div class="ans">' +
		`<div class="ans-top">${swatch(matched ?? light, true)}` +
		`<span class="cn">${escapeHtml(use)}</span>` +
		`<button class="copy" type="button" data-use="${escapeHtml(use)}">Copy</button></div>` +
		'<div class="ans-meta">' +
		typeTag(row) +
		blendTag(blend) +
		(distance > 0 ? `<span class="tag near">Δ ${Math.round(distance)}</span>` : "") +
		(row.invalidHex ? '<span class="tag bad">invalid hex in DS</span>' : "") +
		"</div>" +
		valuesRow(light, dark, matched) +
		"</div>"
	);
}

function altRow(row: TokenRow, distance: number, blend?: Hit["blend"]): string {
	const use = usageOf(row);
	return (
		`<button class="row" type="button" data-use="${escapeHtml(use)}">` +
		swatch(valueOf(row, brand, mode) ?? valueOf(row, brand, "light")) +
		`<span class="cn${row.cls ? "" : " vo"}">${escapeHtml(use)}</span>` +
		'<span class="meta">' +
		(distance > 0 ? `<span class="hx">Δ ${Math.round(distance)}</span>` : "") +
		(blend ? `<span class="hx">${Math.round(blend.alpha * 100)}%</span>` : "") +
		typeTag(row) +
		"</span></button>"
	);
}

function expander(label: string, rows: string[], open = false): string {
	if (!rows.length) return "";
	return (
		`<details class="more"${open ? " open" : ""}><summary>${label}</summary>` +
		`<div class="rows">${rows.join("")}</div></details>`
	);
}

// ---------- search ----------

/**
 * Shared by both lenses. The swatch is a colours-lens affordance — leaving the
 * last picked hex painted while looking at icons said nothing true.
 */
function syncSearchChrome(): void {
	$clear.hidden = !$q.value;
	$chip.style.background = (lens === "colors" ? normalizeHex($q.value.trim()) : null) ?? "transparent";
}

function renderAnswer(): void {
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

/**
 * Exact or nothing.
 *
 * Nearest-match used to answer here, on the reasoning that colours lifted from a
 * design file are often a digit or two off. The reasoning was fine and the
 * behaviour was still wrong: the near hit is rendered in the same card as a real
 * answer, so it reads as "use this" — and a developer who acts on it has just
 * written a token that is not the colour they were given, with the tool's
 * blessing. Being told nothing sends them to ask the designer, which is the
 * correct next step when a colour is genuinely not in the system.
 */
function renderHex(hex: string): void {
	const exact = findByHex(TOKENS, hex, brand)
		.filter((hit) => hit.distance === 0)
		// An opaque token that simply *is* this colour outranks one that only
		// becomes it at 16% over a surface — both are exact, but the first needs
		// no reasoning about what it was sitting on.
		.sort((a, b) => Number(!!a.blend) - Number(!!b.blend) || tokenRank(a.row) - tokenRank(b.row));

	if (!exact.length) {
		$ansLabel.textContent = "Result";
		$ans.innerHTML = NO_RESULT;
		return;
	}

	$ansLabel.textContent = `Exact match · ${hex}`;
	$ans.innerHTML =
		answerCard(exact[0].row, hex, 0, exact[0].blend) +
		expander(
			`${exact.length - 1} more tokens share this color`,
			exact.slice(1, 10).map((h) => altRow(h.row, 0, h.blend)),
		);
}

function renderShadow(value: string): void {
	const hits: Hit[] = findByShadow(TOKENS, value, brand);
	if (!hits.length) {
		$ansLabel.textContent = "Result";
		$ans.innerHTML = NO_RESULT;
		return;
	}

	const top = hits[0];
	const use = usageOf(top.row);
	$ansLabel.textContent = `${top.distance === 0 ? "Exact match" : "No exact match"} · box-shadow`;

	$ans.innerHTML =
		'<div class="ans">' +
		`<div class="ans-top">${swatch(value, true)}` +
		`<span class="cn">${top.distance === 0 ? escapeHtml(use) : "No matching token"}</span>` +
		`<button class="copy" type="button" data-use="${escapeHtml(use)}">Copy</button></div>` +
		'<div class="ans-meta"><span class="tag varonly">var()</span>' +
		(top.distance > 0 ? `<span class="tag near">closest ${top.row.key} · Δ ${Math.round(top.distance)}</span>` : "") +
		"</div>" +
		valuesRow(valueOf(top.row, brand, "light"), valueOf(top.row, brand, "dark"), null) +
		"</div>" +
		expander(
			`${hits.length - 1} other DS shadows`,
			hits.slice(1).map((h) => altRow(h.row, h.distance)),
		);
}

function renderName(query: string): void {
	const found = findByName(TOKENS, query);
	if (!found.length) {
		$ansLabel.textContent = "Result";
		$ans.innerHTML = NO_RESULT;
		return;
	}

	$ansLabel.textContent = `${found.length} ${found.length === 1 ? "token" : "tokens"}`;
	$ans.innerHTML =
		answerCard(found[0], null, 0) +
		expander(
			`${found.length - 1} more`,
			found.slice(1, 12).map((row) => altRow(row, 0)),
			true,
		);
}

// ---------- browse list ----------

function renderList(): void {
	const rows = TOKENS.rows
		.filter((row) => row.group === group)
		.sort((a, b) => {
			if (!!a.cls !== !!b.cls) return a.cls ? -1 : 1;
			return a.key.localeCompare(b.key, "en", { numeric: true });
		});

	if (!rows.length) {
		$list.innerHTML = NO_RESULT;
		return;
	}

	$list.innerHTML = rows
		.map((row) => {
			const value = valueOf(row, brand, mode);
			const use = usageOf(row);
			return (
				`<button class="row" type="button" data-use="${escapeHtml(use)}">` +
				swatch(value) +
				`<span class="cn${row.cls ? "" : " vo"}">${escapeHtml(use)}</span>` +
				`<span class="hx">${value ?? "—"}</span></button>`
			);
		})
		.join("");

	bindCopy($list);
}

// ---------- chrome ----------

function syncMode(): void {
	const dark = hasTheme(TOKENS, brand, "dark");
	$dark.disabled = !dark;
	$dark.title = dark ? "" : `no dark theme for ${brand}`;
	if (!dark && mode === "dark") mode = "light";
	$light.setAttribute("aria-pressed", String(mode === "light"));
	$dark.setAttribute("aria-pressed", String(mode === "dark"));
}

/** The popup wears the brand it is documenting. */
function applyAccent(): void {
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
	group = $group.value as TokenGroup;
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

// ==================== icons lens ====================

/**
 * Icons cannot be generated at build time — the assets exist only on the CDN,
 * with no copy in any repo. Fetching also makes the deploy question answerable:
 * comparing the three environments shows whether an icon someone added has
 * actually shipped past uat yet.
 *
 * Identity is the class name, never the codepoint. Inserting one glyph shifts
 * the slot of everything after it, so a single addition on uat made 1,128 of
 * 1,204 icons look different from dev when compared by codepoint — all false.
 */
const ICON_CACHE_KEY = "ds-icons:snapshot:v1";

interface IconSnapshot {
	fetchedAt: number;
	perEnv: Record<string, ParsedIcon[]>;
	/** `Last-Modified` per environment — when that environment last shipped the set. */
	modified?: Record<string, string>;
}

const ICON_VIEW_KEY = "ds-icons:view";
const ICON_ROUNDS_KEY = "ds-icons:rounds:v1";

/**
 * The predecessor keyed the whole diff on the last acknowledgement, so it
 * answered "what changed since you last clicked ✓" — a span that grows with
 * every release nobody dismissed. Dropped rather than migrated: carrying it
 * over would show its accumulated backlog once as a single round, which is the
 * exact reading being fixed.
 */
const ICON_BASELINE_KEY_V1 = "ds-icons:baseline:v1";

let icons: Icon[] = [];
let iconFilter: "all" | "new" | "partial" = "all";
let iconView: IconView = readIconView();
let iconsLoaded = false;
let history: IconHistory | null = readHistory();
/** What the most recent change added, unless it has been acknowledged. */
let freshNames = new Set<string>();

function readHistory(): IconHistory | null {
	try {
		localStorage.removeItem(ICON_BASELINE_KEY_V1);
		const raw = localStorage.getItem(ICON_ROUNDS_KEY);
		return raw ? (JSON.parse(raw) as IconHistory) : null;
	} catch {
		return null;
	}
}

function writeHistory(next: IconHistory): void {
	history = next;
	try {
		localStorage.setItem(ICON_ROUNDS_KEY, JSON.stringify(next));
	} catch {
		// nothing to do; the diff just restarts from the next successful sync
	}
}

/**
 * Folds a completed sync into the history. Only ever called with a set that
 * came off the network — replaying the cache through it would compare a set
 * against itself and, on a first run, adopt an anchor that may already be days
 * stale.
 */
function observeSync(): string[] {
	const { history: next, added } = recordSync(
		history,
		icons.map((icon) => icon.short),
		Date.now(),
	);

	writeHistory(next);
	applyFresh();
	return added;
}

/** Recomputes the flag from stored state. Safe on any paint, cached or not. */
function applyFresh(): void {
	freshNames = new Set(
		unseenAdditions(
			history,
			icons.map((icon) => icon.short),
		),
	);

	$icNew.disabled = freshNames.size === 0;
	if (!freshNames.size && iconFilter === "new") iconFilter = "all";
}

function isFresh(icon: Icon): boolean {
	return freshNames.has(icon.short);
}

/**
 * Acknowledges the round rather than resetting the anchor. The anchor is the
 * last thing synced and has nothing to do with what has been looked at; tying
 * the two together is what made the count accumulate.
 */
function markAllSeen(): void {
	if (history) writeHistory({ ...history, seenAt: Date.now() });
	freshNames = new Set();
	if (iconFilter === "new") setIconFilter("all");
	else renderIconsPanel();
}

/**
 * `cards` names each icon; `grid` is glyph-only so the eye can sweep for a shape
 * it half-remembers. Search is identical in both — the view only changes the
 * rendering of the same result list.
 */
type IconView = "cards" | "grid";

function readIconView(): IconView {
	try {
		return localStorage.getItem(ICON_VIEW_KEY) === "grid" ? "grid" : "cards";
	} catch {
		return "cards";
	}
}

function readIconCache(): IconSnapshot | null {
	try {
		const raw = localStorage.getItem(ICON_CACHE_KEY);
		return raw ? (JSON.parse(raw) as IconSnapshot) : null;
	} catch {
		return null;
	}
}

function writeIconCache(snapshot: IconSnapshot): void {
	try {
		localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(snapshot));
	} catch {
		// A full quota is not worth failing the lens over; the fetch still worked.
	}
}

/**
 * There are two caches in front of this file and only one of them answers to
 * `fetch` options.
 *
 * The browser's is handled by the request options. Cloudflare's is not: the file
 * is `immutable` with a one-year max-age, so the edge serves its own copy of a
 * bare URL no matter what the client asks for. Measured on dev — `cf-cache-status:
 * HIT`, `age: 337162`, four days behind the origin. Only a distinct URL gets past
 * it, which is why `iconCssUrl` carries a buster and why the app does the same
 * when it loads this file.
 *
 * `Last-Modified` is CORS-safelisted, so it can be read cross-origin and tells
 * you when each environment last deployed the set. Note it reflects the object
 * that answered, so it is only trustworthy once the buster is in place.
 */
/**
 * One font per environment, registered at runtime rather than in the stylesheet.
 *
 * A static `@font-face` cannot carry a cache buster, and the woff is `immutable`
 * with a one-year max-age, so the browser keeps whichever copy it downloaded
 * first — for a year. That is how the stylesheet came back fresh while the glyphs
 * stayed old: `empeo-magic-wand` moved to slot `eab9`, and slot `eab9` in the
 * cached font was a person.
 *
 * Three families rather than one, because the slot numbers differ per
 * environment; a card has to draw its glyph with the font that agrees with the
 * codepoint it used.
 */
const fontsLoaded = new Set<string>();

/**
 * The font's buster is its own `Last-Modified`, not the clock.
 *
 * A timestamp would be correct and expensive: the woff is 520 KB per
 * environment, so every open would pull 1.5 MB that is almost always identical
 * to what the browser already holds. Keying on the deploy time instead gives a
 * URL that is stable while the set is unchanged — cached like any other asset —
 * and different the moment anything ships, which is exactly when the glyph table
 * must be re-read.
 *
 * The HEAD that learns it still needs a clock buster of its own, or the edge
 * would answer that from cache too and we would be back where we started. It
 * carries no body, so the cost is a few hundred bytes.
 */
async function fontBuster(env: IconEnv, stamp: number): Promise<string> {
	try {
		const res = await fetch(iconFontUrl(env, stamp), { method: "HEAD", cache: "no-store" });
		const lastModified = res.headers.get("last-modified");
		const at = lastModified ? Date.parse(lastModified) : NaN;
		if (!Number.isNaN(at)) return String(at);
	} catch {
		// unreachable, or a header we cannot read — fall back to always-fresh
	}
	return String(stamp);
}

async function loadFonts(stamp: number): Promise<void> {
	await Promise.all(
		ICON_ENVS.map(async (env) => {
			const family = fontFamilyOf(env.id);
			const buster = await fontBuster(env, stamp);
			const key = `${family}:${buster}`;
			if (fontsLoaded.has(key)) return;

			try {
				const face = new FontFace(family, `url(${iconFontUrl(env, buster)}) format("woff")`, { display: "block" });
				await face.load();
				document.fonts.add(face);
				fontsLoaded.add(key);
			} catch (error) {
				// One environment being unreachable must not blank the other two.
				console.warn(`[Dev Inspectors] could not load the ${env.id} icon font:`, error);
			}
		}),
	);

	renderIcons();
}

async function fetchIconSets(): Promise<{
	perEnv: Record<string, ParsedIcon[]>;
	modified: Record<string, string>;
}> {
	const perEnv: Record<string, ParsedIcon[]> = {};
	const modified: Record<string, string> = {};
	const stamp = Date.now(); // one per sweep, so the three environments compare like for like

	void loadFonts(stamp);

	await Promise.all(
		ICON_ENVS.map(async (env) => {
			// The buster is what actually defeats the CDN; `no-store` keeps the browser
			// from filling its own cache with URLs that will never be requested again.
			const res = await fetch(iconCssUrl(env, stamp), { cache: "no-store" });
			if (!res.ok) throw new Error(`${env.id}: HTTP ${res.status}`);
			perEnv[env.id] = parseIconCss(await res.text());
			const lastModified = res.headers.get("last-modified");
			if (lastModified) modified[env.id] = lastModified;
		}),
	);

	return { perEnv, modified };
}

/** `19 Aug`, not `19/8` — a bare numeric pair reads as a version or a ratio. */
function shortDate(value: string | undefined): string {
	if (!value) return "?";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "?";
	return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clockOf(ms: number): string {
	const d = new Date(ms);
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * One wording, matching the filter button that selects exactly this set — the
 * chip and the button have to be recognisably the same thing. Which
 * environments are involved goes in the tooltip, where a varying label would
 * otherwise make the badge a different width on every sync.
 */
function partialFlag(): string {
	const behind = icons.filter(isPartial);
	if (!behind.length) return "";

	const shapes = new Set(behind.map((icon) => [...icon.envs].sort().join("+")));
	const title =
		shapes.size === 1
			? `${behind.length} icon(s) exist only on ${[...shapes][0].split("+").join(", ")}`
			: `${behind.length} icons are on some environments but not all`;

	return ` <span class="warn" title="${escapeHtml(title)}">${behind.length} Mismatched</span>`;
}

/**
 * Clickable, because the count is only half of it — "3 new" wants an answer to
 * "fine, I have looked", and that acknowledgement is what dismisses the round.
 */
function freshFlag(): string {
	if (!freshNames.size) return "";

	// The round's own timestamp, not the last sync's: it says which deploy these
	// belong to, and that is the thing a count alone cannot tell you.
	const at = history?.last?.at;
	const when = at ? ` in the ${shortDate(new Date(at).toUTCString())} ${clockOf(at)} sync` : "";
	const title = `${freshNames.size} icon(s) added${when} — click to mark them all as seen`;

	return ` <button type="button" class="newchip" id="seen" title="${escapeHtml(title)}">${freshNames.size} New ✓</button>`;
}

let lastSnapshot: IconSnapshot | null = null;

function renderIconsPanel(): void {
	renderEnvLine(lastSnapshot);
	renderIcons();
}

function renderEnvLine(snapshot: IconSnapshot | null): void {
	lastSnapshot = snapshot;
	if (!snapshot) {
		$envLine.innerHTML = "";
		return;
	}

	// The deploy date is not worth a row of its own — it is context for a count,
	// so it lives in that count's tooltip and the row stays one line.
	const counts = ICON_ENVS.map((env) => {
		const count = snapshot.perEnv[env.id]?.length ?? 0;
		const deployed = snapshot.modified?.[env.id];
		const title = deployed ? `${env.label} — last shipped ${shortDate(deployed)} (${deployed})` : env.label;
		return `<span title="${escapeHtml(title)}">${env.label} <b>${count}</b></span>`;
	}).join(" · ");

	const synced = `<span class="when sync">Synced ${clockOf(snapshot.fetchedAt)}</span>`;

	$envLine.innerHTML = `<div class="envrow">${counts}${freshFlag()}${partialFlag()}${synced}</div>`;
	document.getElementById("seen")?.addEventListener("click", markAllSeen);
}

function renderIcons(): void {
	const pool =
		iconFilter === "partial" ? icons.filter(isPartial) : iconFilter === "new" ? icons.filter(isFresh) : icons;
	const list = searchIcons(pool, $q.value);

	$iconLabel.textContent = list.length === pool.length ? "Icons" : `Icons · ${list.length}`;

	if (!icons.length) return; // still loading; the idle line already says so

	if (!list.length) {
		$iconGrid.innerHTML = "";
		$iconIdle.hidden = false;
		$iconIdle.textContent = "No result";
		return;
	}

	// Everything, uncapped. A cap makes the lens lie: "not in the set" and "past
	// the cutoff" look identical, which is fatal for a tool whose question is
	// "does this icon exist yet". The cost is one innerHTML of ~1,200 items, paid
	// once per open — see scheduleIconRender for why typing does not pay it.
	$iconGrid.classList.toggle("dense", iconView === "grid");
	$iconGrid.innerHTML = list.map(iconView === "grid" ? tileHtml : cardHtml).join("");

	bindCopy($iconGrid);
	$iconIdle.hidden = true;
}

function cardHtml(icon: Icon): string {
	const cls = classOf(icon);
	const dots = ICON_ENVS.map((env) => {
		const has = icon.envs.includes(env.id);
		return `<span class="dot ${has ? "has" : "no"}" title="${env.label}${has ? "" : " — missing"}">${env.label}</span>`;
	}).join("");

	return (
		`<button class="icard${marks(icon)}" type="button" data-use="${cls}">` +
		`<span class="top">${glyphHtml(icon)}` +
		`<span class="nm" title="${cls}">${escapeHtml(icon.short)}</span>` +
		`${isFresh(icon) ? '<span class="newtag">NEW</span>' : ""}</span>` +
		`<span class="foot"><span class="code">${codeLabelOf(icon)}</span>` +
		`<span class="dots">${dots}</span></span></button>`
	);
}

/**
 * Draws the glyph with the font of the environment its codepoint came from.
 *
 * Pinning every card to one font was the bug: slot numbers shift between
 * environments, so `empeo-magic-wand`'s `eab9` drawn with a font that had a
 * person at `eab9` showed a person, confidently and with the right name under it.
 */
function glyphHtml(icon: Icon): string {
	const source = glyphSourceOf(icon);
	if (!source) return '<span class="glyph"></span>';

	return `<span class="glyph" style="font-family:'${fontFamilyOf(source.env)}'">${source.char}</span>`;
}

/** New and mismatched are independent — a just-added icon is usually both. */
function marks(icon: Icon): string {
	return `${isPartial(icon) ? " partial" : ""}${isFresh(icon) ? " fresh" : ""}`;
}

/**
 * Glyph only. The name has to survive somewhere, so it goes in the tooltip
 * together with the environments — an outlined tile still needs to say which
 * one it is missing from, which a border colour alone cannot.
 */
function tileHtml(icon: Icon): string {
	const cls = classOf(icon);
	const missing = ICON_ENVS.filter((env) => !icon.envs.includes(env.id)).map((env) => env.label);
	const notes = [isFresh(icon) ? "new" : "", missing.length ? `missing on ${missing.join(", ")}` : ""].filter(Boolean);
	const title = notes.length ? `${cls} — ${notes.join(", ")}` : cls;

	return (
		`<button class="itile${marks(icon)}" type="button" data-use="${cls}" ` +
		`title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">` +
		`${glyphHtml(icon)}</button>`
	);
}

async function loadIcons(hard = false): Promise<void> {
	if (iconsLoaded && !hard) return;
	iconsLoaded = true;

	// Paint from the last snapshot first so the lens is never blank.
	const cached = readIconCache();
	if (cached && !hard) {
		icons = mergeByName(cached.perEnv);
		applyFresh();
		renderEnvLine(cached);
		renderIcons();
		$iconIdle.hidden = true;
	}

	$refresh.classList.add("is-busy");

	try {
		// No hard/soft distinction any more: every fetch carries a fresh buster, so
		// every fetch is already as authoritative as Sync used to be.
		const { perEnv, modified } = await fetchIconSets();
		const snapshot: IconSnapshot = { fetchedAt: Date.now(), perEnv, modified };
		writeIconCache(snapshot);
		icons = mergeByName(perEnv);
		const added = observeSync();
		renderEnvLine(snapshot);
		renderIcons();
		$iconIdle.hidden = true;
		// `added` is what THIS sync found, which is not the same as what is
		// flagged: an earlier round stays flagged until it is acknowledged, and
		// reporting that here would read as "this sync found them".
		if (hard) toast(added.length ? `Synced · ${added.length} new` : `Synced · ${icons.length} icons`);
	} catch (error) {
		iconsLoaded = false; // let the next visit try again
		if (!cached) {
			$iconIdle.hidden = false;
			$iconIdle.textContent = "Could not load the icon set from the CDN";
		} else {
			toast("Showing cached data — sync failed");
		}
		console.error(error);
	} finally {
		$refresh.classList.remove("is-busy");
	}
}

// ==================== lens switching ====================

const LENS_KEY = "ds-colors:lens";
type Lens = "colors" | "icons" | "redirect" | "screens";
let lens: Lens = "colors";

/**
 * Screens is built and tested but not exposed yet.
 *
 * It works on paper and has never been opened against a real portal, so the two
 * questions that decide its shape — whether the frames keep the tab's session,
 * and whether several copies of the app can boot in one tab — are still open.
 * A lens that might show five login screens is worse than no lens.
 *
 * Kept rather than removed, because the answer to both questions is one session
 * with a logged-in portal away. Flip this to `true`, rebuild, and the tab, the
 * panel and `content.js` are all still wired. Everything the flag touches is
 * reachable from this constant — there is no second switch.
 */
const SCREENS_ENABLED = false;

/**
 * One input, two lenses, two unrelated vocabularies — a hex means nothing to the
 * icon set and an icon name means nothing to the token table. Sharing the box
 * made switching lenses land on "No result" every time, so each lens keeps its
 * own query and gets it back on return.
 */
const queries: Record<Lens, string> = { colors: "", icons: "", redirect: "", screens: "" };

function applyLens(next: Lens): void {
	// The stored lens outlives the flag: someone who was on Screens when it was
	// switched off would otherwise reopen the popup to a selected tab that is not
	// on screen, and a body that renders nothing.
	if (next === "screens" && !SCREENS_ENABLED) next = "colors";

	if (next !== lens) queries[lens] = $q.value;
	lens = next;

	$q.value = queries[next];

	for (const [tab, panel, name] of [
		[$lensColors, $panelColors, "colors"],
		[$lensIcons, $panelIcons, "icons"],
		[$lensRedirect, $panelRedirect, "redirect"],
		[$lensScreens, $panelScreens, "screens"],
	] as const) {
		tab.setAttribute("aria-selected", String(next === name));
		panel.hidden = next !== name;
	}

	// The brand only affects colour tokens, and the eyedropper only feeds a hex.
	$brand.hidden = next !== "colors";
	$pick.hidden = next !== "colors" || !window.EyeDropper;

	// Neither of these lenses searches anything: one takes a module path, the
	// other a set of device sizes.
	$search.hidden = next === "redirect" || next === "screens";

	$q.placeholder = next === "icons" ? "Search icons by name or codepoint" : "Paste hex, box-shadow or token name";

	localStorage.setItem(LENS_KEY, next);

	if (next === "icons") void loadIcons();
	if (next === "redirect") void loadRules();
	if (next === "screens") void loadScreens();
	renderCurrent();
}

function renderCurrent(): void {
	if (lens === "icons") {
		syncSearchChrome();
		scheduleIconRender();
	} else if (lens === "colors") {
		renderAnswer();
	}
}

/**
 * The icon grid is uncapped, so a keystroke can rebuild ~1,200 nodes. Typing
 * fires input events faster than that, so bursts are coalesced and only the last
 * one paints. The colours lens is a handful of nodes and stays synchronous.
 */
let iconRenderTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleIconRender(): void {
	if (iconRenderTimer !== undefined) clearTimeout(iconRenderTimer);
	iconRenderTimer = setTimeout(() => {
		iconRenderTimer = undefined;
		renderIcons();
	}, 70);
}

// Driven off the same table applyLens paints from, so adding a lens cannot leave
// a tab that renders but does nothing — which is exactly what happened when
// these were three hand-written lines and the third was never added.
for (const [tab, name] of [
	[$lensColors, "colors"],
	[$lensIcons, "icons"],
	[$lensRedirect, "redirect"],
	[$lensScreens, "screens"],
] as const) {
	tab.addEventListener("click", () => applyLens(name));
}

// Hidden here rather than deleted from index.html, so the flag is the only thing
// that has to move to bring it back.
$lensScreens.hidden = !SCREENS_ENABLED;

function setIconFilter(next: typeof iconFilter): void {
	iconFilter = next;
	$icAll.setAttribute("aria-pressed", String(next === "all"));
	$icNew.setAttribute("aria-pressed", String(next === "new"));
	$icPartial.setAttribute("aria-pressed", String(next === "partial"));
	// Nothing to filter to is worse than a disabled button that explains itself.
	$icNew.disabled = freshNames.size === 0;
	renderIconsPanel();
}

for (const [id, value] of [
	["ic-all", "all"],
	["ic-new", "new"],
	["ic-partial", "partial"],
] as const) {
	document.getElementById(id)?.addEventListener("click", () => setIconFilter(value));
}

for (const [id, value] of [
	["view-cards", "cards"],
	["view-grid", "grid"],
] as const) {
	document.getElementById(id)?.addEventListener("click", () => {
		iconView = value;
		try {
			localStorage.setItem(ICON_VIEW_KEY, value);
		} catch {
			// preference only; the view still switched for this session
		}
		applyIconView();
		renderIcons();
	});
}

function applyIconView(): void {
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

// ==================== keyboard ====================

/**
 * Enter and Space already copy, because every icon is a real `<button>`. What is
 * missing is a way in and a way across: 1,200 tiles behind Tab is not a way in,
 * and Tab alone cannot move up a row. Arrow keys handle both.
 *
 * The column count is read from the resolved grid rather than guessed, so the
 * same code steps a 2-across card list and a 10-across tile grid.
 */
function iconCells(): HTMLElement[] {
	return [...$iconGrid.querySelectorAll<HTMLElement>("[data-use]")];
}

function columnCount(): number {
	const columns = getComputedStyle($iconGrid).gridTemplateColumns;
	return Math.max(1, columns.split(" ").filter(Boolean).length);
}

function focusCell(index: number): void {
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
	const here = cells.indexOf(document.activeElement as HTMLElement);
	if (here < 0) return;

	const step = columnCount();
	const moves: Record<string, number> = {
		ArrowRight: here + 1,
		ArrowLeft: here - 1,
		ArrowDown: here + step,
		ArrowUp: here - step,
		Home: 0,
		End: cells.length - 1,
	};

	// Up from the first row goes back to the search box, which is where anyone
	// pressing it repeatedly is trying to get to.
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

	// Typing while a tile has focus should search, not do nothing.
	if (event.key === "Escape" || (event.key.length === 1 && !event.metaKey && !event.ctrlKey)) {
		$q.focus();
	}
});

/**
 * The eyedropper reads one composited pixel. It has no idea which element the
 * pixel came from, so it can answer "which token is this colour" and nothing
 * else — not the shadow, not the class, not the font. Two consequences worth
 * knowing before trusting a pick:
 *
 *  - The value is what is on screen after blending. Opacity, an overlapping
 *    shadow or a translucent overlay all shift it away from the authored colour.
 *  - Text is anti-aliased, so the edge of a glyph is a blend with whatever is
 *    behind it. Aim at the middle of a thick stroke, or expect a near miss.
 *
 * Its real advantage is reach: it picks from anywhere on screen, including a
 * design tool or an image, which nothing else here can do.
 *
 * Known risk, not yet observed: Chrome dismisses a toolbar popup when it loses
 * focus, and the eyedropper draws its own overlay. If the popup is torn down
 * mid-pick this promise never settles and the colour is lost — no workaround
 * exists inside a context that no longer runs. Fixing it would mean moving to a
 * side panel or doing the picking from a content script, so it is not worth
 * building until a pick is actually seen to fail.
 */
function setUpEyeDropper(): void {
	const Dropper = window.EyeDropper;
	if (!Dropper) return; // older Chrome — the button stays hidden

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
				// Cancelled with Esc, or the pick was interrupted. Nothing to report.
				$pick.classList.remove("is-busy");
			},
		);
	});
}

/**
 * Folding the token list leaves just the header, the search box and whatever was
 * looked up — which is the whole tool for anyone who only ever pastes a value.
 *
 * The choice is remembered in `localStorage` rather than `chrome.storage`, which
 * would drag in the `storage` permission for the sake of one boolean. A popup is
 * rebuilt from scratch every time it opens, so without this the list would
 * unfold again on every single use.
 */
const FOLD_KEY = "ds-colors:tokens-folded";

function applyFold(folded: boolean): void {
	$tokenBody.hidden = folded;
	$fold.setAttribute("aria-expanded", String(!folded));
	$fold.title = folded ? "Show tokens" : "Hide tokens";
}

function setUpFold(): void {
	let folded = localStorage.getItem(FOLD_KEY) === "1";
	applyFold(folded);

	$fold.addEventListener("click", () => {
		folded = !folded;
		localStorage.setItem(FOLD_KEY, folded ? "1" : "0");
		applyFold(folded);
	});
}

// ==================== redirect lens ====================

/**
 * Point a deployed Module Federation bundle at a local build, so a change can be
 * verified against real UAT data without deploying.
 *
 * State lives in `chrome.storage.local`, not `localStorage`, because the service
 * worker is the only thing allowed to touch the rules and it cannot read a page's
 * `localStorage`. The popup writes; the worker reacts. That split is what stops
 * the live rule set from drifting away from the list on screen.
 */
let rules: RedirectEntry[] = [];
let globalEnabled = true;

/**
 * The banner is the only channel this lens has for "you are looking at something
 * that cannot work". Everything that writes it goes through here so two causes
 * cannot half-overwrite each other.
 */
function setNotice(text: string, mild = false): void {
	$notice.textContent = text;
	$notice.hidden = !text;
	$notice.classList.toggle("mild", mild);
}

async function readRedirectState(): Promise<RedirectState> {
	const stored = (await chrome.storage.local.get(REDIRECT_STORAGE_KEYS)) as Partial<RedirectState>;
	return { globalEnabled: stored.globalEnabled !== false, entries: stored.entries ?? [] };
}

function saveRules(next: RedirectEntry[]): void {
	rules = next;
	void chrome.storage.local.set({ entries: next });
	renderRules();
}

async function loadRules(): Promise<void> {
	const state = await readRedirectState();
	rules = state.entries;
	globalEnabled = state.globalEnabled;
	$global.checked = globalEnabled;

	// Without the API the lens still writes and lists entries perfectly, and
	// redirects nothing at all — the worst kind of broken. Say it here rather than
	// only in a service-worker console nobody opens.
	setNotice(
		chrome.declarativeNetRequest
			? ""
			: "Chrome is running this with an older permission set, so nothing is being redirected. Remove the extension and Load unpacked again — Reload does not grant new permissions.",
	);

	renderRules();
	void probePorts();
	void readMatched();
}

/** Counts and paused styling — everything that changes on a toggle. */
function paintHeader(): void {
	// Counts rules that are live right now, which is not the same as rules in the
	// list: five entries with two switches on is "2 active". The distinction is
	// the whole point of the number, so the label has to survive being read cold.
	const live = activeCount({ globalEnabled, entries: rules });
	const paused = !globalEnabled && rules.length > 0;

	// Rows keep their own switch when the master is off, so without a word here
	// the list looks armed while nothing is actually redirecting.
	$armed.textContent = paused ? "Paused" : live ? `${live} active` : "";
	$armed.title = paused
		? "The master switch is off — no redirect is running, and the list is kept"
		: live
			? `${live} of ${rules.length} redirect${rules.length === 1 ? "" : "s"} are live — matching requests are served from localhost`
			: "";
	$armed.classList.toggle("is-paused", paused);
	$armed.hidden = !paused && !live;
	$ruleIdle.hidden = rules.length > 0;
	$panelRedirect.classList.toggle("paused", !globalEnabled && rules.length > 0);
}

/**
 * Flipping a switch must not rebuild the list.
 *
 * It used to call the full render, which replaced the very `<input>` being
 * clicked: the knob jumped instead of sliding, focus was lost, and the write
 * echoed back through `storage.onChanged` into a second rebuild plus a network
 * probe. Three renders and a round trip per click is what made the switch feel
 * stuck. Only the row's own class and the header actually change here.
 */
function setRuleEnabled(id: number, enabled: boolean): void {
	rules = rules.map((entry) => (entry.id === id ? { ...entry, enabled } : entry));
	void chrome.storage.local.set({ entries: rules });

	const row = $rules.querySelector<HTMLElement>(`[data-toggle="${id}"]`)?.closest<HTMLElement>(".rule");
	row?.classList.toggle("off", !enabled);
	paintHeader();
}

function renderRules(): void {
	paintHeader();

	$rules.innerHTML = rules
		.map((entry) => {
			const state = probes.get(entry.port);
			const dot =
				state === undefined
					? '<span class="probe" title="Checking the port…">·</span>'
					: state
						? `<span class="probe up" title="Something is listening on :${entry.port}"></span>`
						: `<span class="probe down" title="Nothing is listening on :${entry.port} — the redirect will fail"></span>`;

			const name = labelOf(entry);
			const here = matchedHere.has(entry.id)
				? '<span class="rhere" title="This redirect matched a request on the page you are looking at">on this page</span>'
				: "";

			return (
				`<li class="rule${entry.enabled ? "" : " off"}${entry.id === editingId ? " editing" : ""}">` +
				`<label class="tgl" title="${entry.enabled ? "Disable" : "Enable"} this redirect">` +
				`<input type="checkbox" data-toggle="${entry.id}"${entry.enabled ? " checked" : ""} ` +
				`data-testid="checkbox-redirect-${entry.id}" /><span class="track"></span></label>` +
				`${dot}` +
				`<span class="rmain">` +
				`<input class="rname" value="${escapeHtml(name)}" data-name="${entry.id}" spellcheck="false" ` +
				`aria-label="Name" title="Click to rename — blank restores “${escapeHtml(deriveName(entry.path))}”" ` +
				`data-testid="textbox-redirect-name-${entry.id}" />` +
				`<span class="rsub"><span class="rpath" title="${escapeHtml(targetUrl(entry))}">${escapeHtml(entry.path)}</span>${here}</span>` +
				`</span>` +
				`<input class="rport" type="text" inputmode="numeric" value="${entry.port}" ` +
				`data-port="${entry.id}" aria-label="Port for ${escapeHtml(name)}" ` +
				`data-testid="textbox-redirect-port-${entry.id}" />` +
				`<button class="rdel" type="button" data-edit="${entry.id}" title="Edit path and port" ` +
				`data-testid="button-redirect-edit-${entry.id}">` +
				`<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">` +
				`<path d="M11.4 2.3a1.5 1.5 0 0 1 2.1 2.1L5.8 12.2l-2.9.8.8-2.9 7.7-7.8Z" fill="none" ` +
				`stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg></button>` +
				`<button class="rdel" type="button" data-del="${entry.id}" title="Remove ${escapeHtml(name)}" ` +
				`data-testid="button-redirect-remove-${entry.id}">✕</button></li>`
			);
		})
		.join("");

	for (const box of $rules.querySelectorAll<HTMLInputElement>("[data-toggle]")) {
		box.addEventListener("change", () => setRuleEnabled(Number(box.dataset.toggle), box.checked));
	}

	for (const field of $rules.querySelectorAll<HTMLInputElement>("[data-name]")) {
		// Renaming changes no rule, so this writes state without touching the DOM —
		// re-rendering here would yank the field out from under the cursor.
		field.addEventListener("change", () => {
			const id = Number(field.dataset.name);
			const entry = rules.find((candidate) => candidate.id === id);
			if (!entry) return;

			const typed = field.value.trim();
			rules = rules.map((candidate) => (candidate.id === id ? { ...candidate, label: typed } : candidate));
			void chrome.storage.local.set({ entries: rules });

			// Blank means "go back to the derived name" rather than "no name".
			field.value = labelOf({ ...entry, label: typed });
		});

		field.addEventListener("keydown", (event) => {
			if (event.key === "Enter") field.blur();
		});
	}

	for (const field of $rules.querySelectorAll<HTMLInputElement>("[data-port]")) {
		field.addEventListener("change", () => {
			const id = Number(field.dataset.port);
			const port = parsePort(field.value);
			if (port === null) {
				toast("Port must be 1–65535");
				renderRules();
				return;
			}
			saveRules(rules.map((entry) => (entry.id === id ? { ...entry, port } : entry)));
			void probePorts();
		});
	}

	for (const button of $rules.querySelectorAll<HTMLButtonElement>("[data-edit]")) {
		button.addEventListener("click", () => startEditing(Number(button.dataset.edit)));
	}

	for (const button of $rules.querySelectorAll<HTMLButtonElement>("[data-del]")) {
		button.addEventListener("click", () => {
			const id = Number(button.dataset.del);
			// Deleting what is being edited would leave the form pointed at nothing.
			if (id === editingId) stopEditing();
			saveRules(rules.filter((entry) => entry.id !== id));
		});
	}
}

/**
 * Is anything actually listening?
 *
 * The failure that costs the most time is a redirect pointing at a server that
 * was never started, or was stopped hours ago: the page simply breaks, with
 * nothing to say why. A `no-cors` request cannot read the status — an opaque
 * response comes back for a 404 just as much as a 200 — so this claims only what
 * it can prove: the port answered. That is exactly the failure worth catching.
 */
const probes = new Map<number, boolean>();

/**
 * Which rules actually fired on the page you are looking at.
 *
 * "Armed" and "did something here" are different questions, and only the second
 * one tells you whether the module you are debugging is really coming from your
 * machine. Chrome keeps a per-tab log of matched rules; the rule ids in it are
 * our entry ids, because `buildDnrRule` uses the entry id as the rule id.
 *
 * Reading it needs `declarativeNetRequestFeedback`. Only the tab id is used, so
 * no `tabs` permission — that one gates the url and title, which are none of
 * this lens's business.
 */
let matchedHere = new Set<number>();

/**
 * Ask whether we may, instead of trying and being told off.
 *
 * The API object exists as soon as `declarativeNetRequest` is granted, so its
 * presence says nothing about `declarativeNetRequestFeedback` — which Chrome
 * grants on install and not on Reload. Calling anyway throws, and every throw is
 * collected into the Errors page on chrome://extensions, which never clears
 * itself: a state that is known, expected and already explained in the UI ends
 * up sitting there looking like a crash. `chrome.permissions.contains` needs no
 * permission of its own, so the question is free to ask.
 */
async function canReadMatches(): Promise<boolean> {
	if (!chrome.declarativeNetRequest?.getMatchedRules) return false;
	if (!chrome.permissions?.contains) return true; // old Chrome: let the call decide

	try {
		return await chrome.permissions.contains({ permissions: ["declarativeNetRequestFeedback"] });
	} catch {
		return false;
	}
}

async function readMatched(): Promise<void> {
	matchedHere = new Set();

	if (!(await canReadMatches())) {
		// Mild, and leading with what still works: an alarming banner about a label
		// would send someone hunting a redirect bug that does not exist.
		setNotice(
			"Redirects are working. Only the “on this page” label is off: it needs a permission Chrome grants on install, not on Reload. " +
				"Remove the extension and Load unpacked again to turn it on.",
			true,
		);
		renderRules();
		return;
	}

	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab?.id !== undefined) {
			const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id });
			matchedHere = new Set(rulesMatchedInfo.map((info) => info.rule.ruleId));
		}
	} catch (error) {
		// Permission is held, so this is something unexpected — quota, or a tab that
		// went away. Worth seeing in the Errors page, unlike the case above.
		console.warn("[Dev Inspectors] could not read matched rules:", error);
	}

	renderRules();
}

/**
 * Only ports never seen this session, so a toggle costs nothing on the network.
 * The map is module scope, so reopening the popup re-checks everything — which is
 * the right granularity: a dev server does not usually stop while the popup is
 * open, and it very often has while it was closed.
 */
async function probePorts(): Promise<void> {
	const unknown = [...new Set(rules.map((entry) => entry.port))].filter((port) => !probes.has(port));
	if (!unknown.length) return;

	await Promise.all(
		unknown.map(async (port) => {
			try {
				await fetch(`http://localhost:${port}/`, { mode: "no-cors", cache: "no-store" });
				probes.set(port, true);
			} catch {
				probes.set(port, false);
			}
		}),
	);

	renderRules();
}

$global.addEventListener("change", () => {
	globalEnabled = $global.checked;
	void chrome.storage.local.set({ globalEnabled });
	paintHeader(); // no row changes, so the list must not be rebuilt either
});

/**
 * Editing reuses the add form rather than turning the row into one.
 *
 * A row that becomes editable in place has to hold two inputs, a save and a
 * cancel, in the same width that already carries a switch, a port and two
 * buttons — and every row has to be built ready for it. Sending the values down
 * to the form that already exists costs one piece of state and reads as one
 * place where paths get typed, whether they are new or not.
 */
let editingId: number | null = null;

function startEditing(id: number): void {
	const entry = rules.find((candidate) => candidate.id === id);
	if (!entry) return;

	editingId = id;
	$rPath.value = entry.path;
	$rPort.value = String(entry.port);
	$rAdd.textContent = "Save";
	$rCancel.hidden = false;
	$addRule.classList.add("editing");

	renderRules(); // marks which row is being edited
	$rPath.focus();
	$rPath.select();
}

function stopEditing(): void {
	const wasEditing = editingId !== null;

	editingId = null;
	$rPath.value = "";
	$rPort.value = String(DEFAULT_PORT);
	$rAdd.textContent = "Add";
	$rCancel.hidden = true;
	$addRule.classList.remove("editing");

	if (wasEditing) renderRules();
}

/**
 * Read what the page actually loaded, instead of asking someone to remember it.
 *
 * `performance.getEntriesByType("resource")` is already in every page, listing
 * every request it made — no network interception, no background listener that a
 * sleeping service worker would miss, and nothing to keep in sync. The injected
 * function has to be self-contained: it runs in the page, where none of this
 * file's scope exists, so the filtering happens back here.
 *
 * `activeTab` is what makes this narrow: clicking the toolbar icon grants access
 * to that one tab, and it lapses when the tab navigates. It cannot read a tab you
 * did not open the popup on.
 */
/** Pages no extension may touch, whatever it was granted. */
const UNSCANNABLE = /^(chrome|chrome-extension|edge|about|devtools|view-source|file):|^https:\/\/chromewebstore\.google\.com/;

async function scanPage(): Promise<void> {
	$scan.classList.add("is-busy");

	try {
		// Same trap as the feedback permission: `scripting` arrives on install, not
		// on Reload, and reaching through a missing namespace throws a TypeError that
		// says nothing about why. Ask first.
		if (!chrome.scripting?.executeScript) {
			setNotice(
				"Scan page needs the scripting permission, which Chrome grants on install and not on Reload. " +
					"Remove the extension and Load unpacked again. Redirects are unaffected.",
				true,
			);
			return;
		}

		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab?.id === undefined) {
			toast("No page to scan");
			return;
		}

		if (tab.url && UNSCANNABLE.test(tab.url)) {
			toast("Browser pages cannot be scanned");
			return;
		}

		const [injection] = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			/**
			 * Script tags first, resource timing second.
			 *
			 * The resource buffer holds 250 entries by default and then silently drops
			 * everything after — an app this size passes that during startup, so the
			 * remotes are often simply not in it. `@angular-extensions/elements` loads
			 * every micro-app with `createElement('script')`, and a script tag stays in
			 * the DOM as long as the page lives, with no cap. Timing entries still add
			 * anything fetched some other way.
			 */
			func: () => {
				const urls = new Set<string>();
				for (const tag of document.querySelectorAll<HTMLScriptElement>("script[src]")) urls.add(tag.src);
				for (const entry of performance.getEntriesByType("resource")) urls.add(entry.name);
				return [...urls];
			},
		});

		setNotice(""); // a working scan retires whatever the last failure said
		renderFound((injection?.result as string[] | undefined) ?? []);
	} catch (error) {
		// Never a bare "cannot": one message for every cause is what made this
		// impossible to act on, and the reasons need different fixes — a missing
		// permission, a page that refuses injection, an iframe that went away.
		const reason = error instanceof Error ? error.message : String(error);
		setNotice(`Scan page failed: ${reason}`, true);
		console.warn("[Dev Inspectors] scan failed:", error);
	} finally {
		$scan.classList.remove("is-busy");
	}
}

/** The last raw scan, so re-rendering after an add does not need another scan. */
let scanned: string[] = [];

function renderFound(urls: string[]): void {
	scanned = urls;
	$found.hidden = false;

	const paths = moduleCandidates(urls);

	if (!paths.length) {
		// A bare negative is unactionable: "found nothing" and "saw nothing" need
		// different fixes, and only the denominator tells them apart.
		const scripts = urls.filter((url) => /\.js(\?|#|$)/.test(url)).length;
		$foundLabel.textContent = scripts
			? `No module bundles among ${scripts} scripts on this page`
			: "No scripts visible on this page";
		$foundList.innerHTML = "";
		return;
	}

	const known = new Set(rules.map((entry) => entry.path));
	$foundLabel.textContent = `${paths.length} bundle${paths.length === 1 ? "" : "s"} on this page`;

	$foundList.innerHTML = paths
		.map((path) => {
			const already = known.has(path);
			return (
				`<li>` +
				`<span class="fpath" title="${escapeHtml(path)}">${escapeHtml(path)}</span>` +
				(already
					? `<span class="fadded">added</span>`
					: `<button type="button" data-pick="${escapeHtml(path)}" title="Add a redirect for ${escapeHtml(path)}">+ Add</button>`) +
				`</li>`
			);
		})
		.join("");

	for (const button of $foundList.querySelectorAll<HTMLButtonElement>("[data-pick]")) {
		button.addEventListener("click", () => {
			const path = button.dataset.pick ?? "";
			const port = parsePort($rPort.value) ?? DEFAULT_PORT;
			saveRules(addEntry(rules, path, port));
			renderFound(scanned); // the row it came from now reads "added"
			void probePorts();
		});
	}
}

$scan.addEventListener("click", () => void scanPage());

$foundClose.addEventListener("click", () => {
	$found.hidden = true;
});

$rCancel.addEventListener("click", () => {
	stopEditing();
	$rPath.focus();
});

$rPath.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && editingId !== null) {
		event.preventDefault();
		stopEditing();
	}
});

$addRule.addEventListener("submit", (event) => {
	event.preventDefault();

	const path = normalizePath($rPath.value);
	if (!path) {
		toast("Enter a module path or a URL");
		return;
	}

	const port = parsePort($rPort.value);
	if (port === null) {
		toast("Port must be 1–65535");
		return;
	}

	if (editingId !== null) {
		// Editing a path onto one that already exists would leave two rules racing
		// over the same request, which is the case `addEntry` exists to prevent.
		const clash = rules.some((entry) => entry.id !== editingId && entry.path === path);
		if (clash) {
			toast("Another redirect already uses that path");
			return;
		}

		saveRules(rules.map((entry) => (entry.id === editingId ? { ...entry, path, port } : entry)));
		stopEditing();
	} else {
		saveRules(addEntry(rules, path, port));
		$rPath.value = "";
	}

	$rPath.focus();
	void probePorts();
});

/**
 * Another popup window can change this underneath us, so listening is right —
 * but our own writes echo back through here too. Reloading on those rebuilt the
 * list under the user's finger. Comparing against what is already on screen is
 * enough to tell the two apart, and needs no bookkeeping to stay honest.
 */
chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;

	const entries = changes.entries?.newValue as RedirectEntry[] | undefined;
	const flag = changes.globalEnabled?.newValue as boolean | undefined;

	const listMoved = entries !== undefined && JSON.stringify(entries) !== JSON.stringify(rules);
	const flagMoved = flag !== undefined && flag !== globalEnabled;

	if (listMoved || flagMoved) void loadRules();
});

// ==================== screens lens ====================

/**
 * The popup is 480px wide, so it is not where the frames go — it only chooses
 * the sizes and asks the page to render them. The overlay itself lives in
 * `src/content.ts`, inside the tab, which is what keeps every frame same-origin
 * and signed in. See the note at the top of `shared/screens.ts`.
 */
let screens: ScreensState = DEFAULT_SCREENS_STATE;

async function loadScreens(): Promise<void> {
	try {
		const stored = await chrome.storage.local.get(SCREENS_STORAGE_KEY);
		screens = { ...DEFAULT_SCREENS_STATE, ...(stored[SCREENS_STORAGE_KEY] as Partial<ScreensState>) };
	} catch {
		screens = DEFAULT_SCREENS_STATE;
	}

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	const url = tab?.url ?? "";
	const blocked = !url || UNSUPPORTED_PAGE.test(url);

	$scrHost.textContent = blocked ? "" : new URL(url).host;
	$scrOpen.disabled = blocked;

	setScreensNotice(
		blocked ? "This is a browser page. Open a site first — no extension can render frames here." : "",
	);

	renderSizes();
}

function setScreensNotice(text: string): void {
	$scrNotice.textContent = text;
	$scrNotice.hidden = !text;
}

function renderSizes(): void {
	$sizes.innerHTML = PRESETS.map((preset) => {
		const on = screens.enabled.includes(preset.id);
		return (
			`<li><button type="button" class="size${on ? " on" : ""}" data-id="${preset.id}" ` +
			`data-testid="button-screens-size-${preset.id}" aria-pressed="${on}">` +
			`<span class="sname">${preset.name}</span>` +
			`<span class="sdim">${preset.w} × ${preset.h}</span></button></li>`
		);
	}).join("");
}

$sizes.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
	if (!button?.dataset.id) return;

	screens = toggleScreen(screens, button.dataset.id);
	void chrome.storage.local.set({ [SCREENS_STORAGE_KEY]: screens });
	renderSizes();
});

$scrOpen.addEventListener("click", async () => {
	// Same trap the Redirect lens documents: `scripting` is granted on install,
	// never on Reload, and reaching through the missing namespace throws a
	// TypeError that says nothing about the cause.
	if (!chrome.scripting?.executeScript) {
		setScreensNotice(
			"Screens needs the scripting permission, which Chrome grants on install and not on Reload. " +
				"Remove the extension and Load unpacked again.",
		);
		return;
	}

	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (tab?.id === undefined) return;

	try {
		await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
		window.close(); // the overlay is behind the popup; leaving it open hides the thing just opened
	} catch (error) {
		setScreensNotice(String(error instanceof Error ? error.message : error));
	}
});

setUpEyeDropper();
setUpFold();
applyLens((localStorage.getItem(LENS_KEY) as Lens | null) ?? "colors");

syncMode();
applyAccent();
renderList();
renderAnswer();
$q.focus();