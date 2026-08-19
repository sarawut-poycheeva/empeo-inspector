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

function renderAnswer(): void {
	const query = $q.value.trim();
	$clear.hidden = !query;
	$chip.style.background = normalizeHex(query) ?? "transparent";

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

$q.addEventListener("input", renderAnswer);

$clear.addEventListener("click", () => {
	$q.value = "";
	$q.focus();
	renderAnswer();
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

syncMode();
applyAccent();
renderList();
renderAnswer();
$q.focus();