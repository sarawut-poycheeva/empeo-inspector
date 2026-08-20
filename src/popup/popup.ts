import {
	classOf,
	codeLabelOf,
	glyphOf,
	ICON_ENVS,
	iconCssUrl,
	isPartial,
	mergeByName,
	newSince,
	parseIconCss,
	searchIcons,
	type Icon,
	type ParsedIcon,
} from "../shared/icons.ts";
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

function answerCard(row: TokenRow, matched: string | null, distance: number): string {
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
		(distance > 0 ? `<span class="tag near">Δ ${Math.round(distance)}</span>` : "") +
		(row.invalidHex ? '<span class="tag bad">invalid hex in DS</span>' : "") +
		"</div>" +
		valuesRow(light, dark, matched) +
		"</div>"
	);
}

function altRow(row: TokenRow, distance: number): string {
	const use = usageOf(row);
	return (
		`<button class="row" type="button" data-use="${escapeHtml(use)}">` +
		swatch(valueOf(row, brand, mode) ?? valueOf(row, brand, "light")) +
		`<span class="cn${row.cls ? "" : " vo"}">${escapeHtml(use)}</span>` +
		'<span class="meta">' +
		(distance > 0 ? `<span class="hx">Δ ${Math.round(distance)}</span>` : "") +
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

function renderHex(hex: string): void {
	const hits = findByHex(TOKENS, hex, brand);
	const exact = hits.filter((h) => h.distance === 0).sort((a, b) => tokenRank(a.row) - tokenRank(b.row));
	const near = hits.filter((h) => h.distance > 0);

	if (exact.length) {
		$ansLabel.textContent = `Exact match · ${hex}`;
		$ans.innerHTML =
			answerCard(exact[0].row, hex, 0) +
			expander(
				`${exact.length - 1} more tokens share this color`,
				exact.slice(1, 10).map((h) => altRow(h.row, 0)),
			);
		return;
	}

	if (near.length) {
		$ansLabel.textContent = `No exact match · ${hex}`;
		$ans.innerHTML =
			answerCard(near[0].row, hex, near[0].distance) +
			expander(
				"Other close matches",
				near.slice(1, 5).map((h) => altRow(h.row, h.distance)),
				true,
			);
		return;
	}

	$ansLabel.textContent = "Result";
	$ans.innerHTML = NO_RESULT;
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
const ICON_BASELINE_KEY = "ds-icons:baseline:v1";

/**
 * What the set looked like the last time the user said they had seen it.
 *
 * Diffing against the *previous fetch* would be useless: two opens an hour apart
 * would clear the flag whether or not anyone looked at it, so a new icon would
 * only ever be visible to whoever happened to sync in that window. Anchoring to
 * an explicit "seen" instead means an addition stays flagged until someone
 * actually acknowledges it.
 */
interface IconBaseline {
	at: number;
	names: string[];
}

let icons: Icon[] = [];
let iconFilter: "all" | "new" | "partial" = "all";
let iconView: IconView = readIconView();
let iconsLoaded = false;
let baseline: IconBaseline | null = readBaseline();
/** Names present now but not in the baseline. Empty until the first diff. */
let freshNames = new Set<string>();

function readBaseline(): IconBaseline | null {
	try {
		const raw = localStorage.getItem(ICON_BASELINE_KEY);
		return raw ? (JSON.parse(raw) as IconBaseline) : null;
	} catch {
		return null;
	}
}

function writeBaseline(names: string[]): void {
	baseline = { at: Date.now(), names };
	try {
		localStorage.setItem(ICON_BASELINE_KEY, JSON.stringify(baseline));
	} catch {
		// nothing to do; the diff just restarts from the next successful sync
	}
}

/**
 * The first run has nothing to compare against, so it adopts the current set as
 * the baseline rather than announcing 1,204 new icons.
 */
function diffAgainstBaseline(): void {
	const names = icons.map((icon) => icon.short);

	if (baseline) {
		freshNames = new Set(newSince(names, baseline.names));
	} else {
		writeBaseline(names);
		freshNames = new Set();
	}

	$icNew.disabled = freshNames.size === 0;
	if (!freshNames.size && iconFilter === "new") iconFilter = "all";
}

function isFresh(icon: Icon): boolean {
	return freshNames.has(icon.short);
}

function markAllSeen(): void {
	writeBaseline(icons.map((icon) => icon.short));
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
 * The stylesheet is served `cache-control: max-age=31536000, immutable`, so a
 * default fetch is answered from cache without ever contacting the server — for
 * a year. For a lens whose whole job is "has this shipped yet" that guarantees a
 * wrong answer, which is exactly why the app itself appends `?v=<timestamp>`.
 *
 * `no-cache` forces revalidation, so the ETag still saves the body on a 304 but
 * the answer is never stale. `reload` skips the cache entirely, for the refresh
 * button when you do not trust what you are looking at.
 *
 * `Last-Modified` is CORS-safelisted, so it can be read cross-origin and tells
 * you when each environment last deployed the set.
 */
async function fetchIconSets(hard = false): Promise<{
	perEnv: Record<string, ParsedIcon[]>;
	modified: Record<string, string>;
}> {
	const perEnv: Record<string, ParsedIcon[]> = {};
	const modified: Record<string, string> = {};

	await Promise.all(
		ICON_ENVS.map(async (env) => {
			const res = await fetch(iconCssUrl(env), { cache: hard ? "reload" : "no-cache" });
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
 * "fine, I have looked", and that acknowledgement is what the whole baseline
 * hangs on.
 */
function freshFlag(): string {
	if (!freshNames.size) return "";

	const since = baseline ? ` since ${shortDate(new Date(baseline.at).toUTCString())}` : "";
	const title = `${freshNames.size} icon(s) added${since} — click to mark them all as seen`;

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
		`<span class="top"><span class="glyph">${glyphOf(icon, "uat")}</span>` +
		`<span class="nm" title="${cls}">${escapeHtml(icon.short)}</span>` +
		`${isFresh(icon) ? '<span class="newtag">NEW</span>' : ""}</span>` +
		`<span class="foot"><span class="code">${codeLabelOf(icon)}</span>` +
		`<span class="dots">${dots}</span></span></button>`
	);
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
		`<span class="glyph">${glyphOf(icon, "uat")}</span></button>`
	);
}

async function loadIcons(hard = false): Promise<void> {
	if (iconsLoaded && !hard) return;
	iconsLoaded = true;

	// Paint from the last snapshot first so the lens is never blank.
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
		const snapshot: IconSnapshot = { fetchedAt: Date.now(), perEnv, modified };
		writeIconCache(snapshot);
		icons = mergeByName(perEnv);
		diffAgainstBaseline();
		renderEnvLine(snapshot);
		renderIcons();
		$iconIdle.hidden = true;
		if (hard) toast(freshNames.size ? `Synced · ${freshNames.size} new` : `Synced · ${icons.length} icons`);
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
type Lens = "colors" | "icons";
let lens: Lens = "colors";

/**
 * One input, two lenses, two unrelated vocabularies — a hex means nothing to the
 * icon set and an icon name means nothing to the token table. Sharing the box
 * made switching lenses land on "No result" every time, so each lens keeps its
 * own query and gets it back on return.
 */
const queries: Record<Lens, string> = { colors: "", icons: "" };

function applyLens(next: Lens): void {
	if (next !== lens) queries[lens] = $q.value;
	lens = next;
	const isIcons = next === "icons";

	$q.value = queries[next];

	$lensColors.setAttribute("aria-selected", String(!isIcons));
	$lensIcons.setAttribute("aria-selected", String(isIcons));
	$panelColors.hidden = isIcons;
	$panelIcons.hidden = !isIcons;

	// The brand only affects colour tokens, and the eyedropper only feeds a hex.
	$brand.hidden = isIcons;
	$pick.hidden = isIcons || !window.EyeDropper;

	$q.placeholder = isIcons
		? "Search icons by name or codepoint"
		: "Paste hex, box-shadow or token name";

	localStorage.setItem(LENS_KEY, next);

	if (isIcons) void loadIcons();
	renderCurrent();
}

function renderCurrent(): void {
	if (lens === "icons") {
		syncSearchChrome();
		scheduleIconRender();
	} else {
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

$lensColors.addEventListener("click", () => applyLens("colors"));
$lensIcons.addEventListener("click", () => applyLens("icons"));

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

setUpEyeDropper();
setUpFold();
applyLens((localStorage.getItem(LENS_KEY) as Lens | null) ?? "colors");

syncMode();
applyAccent();
renderList();
renderAnswer();
$q.focus();