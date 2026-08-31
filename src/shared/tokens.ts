/**
 * Matching a value back to a design-system token.
 *
 * Three things make this less trivial than an equality check:
 *
 *  - **A token with alpha never renders as its own value.** `tag-default-bg` is
 *    `#F05B2F1A`; the pixel an eyedropper reads is `#322223`. So translucent
 *    tokens are compared as what they composite to over the page surfaces, and
 *    the hit carries the alpha and the surface so the answer is explainable.
 *  - Values are authored in five shapes — `#RRGGBB`, `#RRGGBBAA`, `rgba()`,
 *    `rgb(r g b / n%)` and `rgba(from var(--x) r g b / n)`. A hex-only parser
 *    silently skipped the last three, which is worse than failing: 29 token
 *    values were unfindable with no indication that they existed.
 *  - Chrome normalises `box-shadow` to `rgba(0, 0, 0, 0.08) 0px 0px 8px 0px` —
 *    colour first, units added — while CSS is authored with the colour last.
 *    The same shadow therefore never compares equal as a string.
 *
 * Distance is still computed and still orders the results, but the colours lens
 * shows exact hits only: a near miss rendered as an answer reads as "use this",
 * and the token that comes back is not the colour the designer handed over.
 */

export type Mode = "light" | "dark";

export type TokenGroup =
	| "text"
	| "semantic"
	| "surface"
	| "shadow"
	| "feature"
	| "button"
	| "input"
	| "other";

export interface TokenRow {
	key: string;
	/** null for feature colours, which are hardcoded in SCSS rather than themed. */
	cssVar: string | null;
	/** Present only for the 27 tokens that ship a utility class. */
	cls: string | null;
	group: TokenGroup;
	values: Record<string, string>;
	/** Set when the DS source holds a malformed hex, so CSS drops the declaration. */
	invalidHex?: boolean;
}

export interface TokenTable {
	themes: string[];
	rows: TokenRow[];
}

export interface Hit {
	row: TokenRow;
	/** 0 means exact. */
	distance: number;
	/**
	 * Set when the token only matches once its alpha is composited over a
	 * surface. Without this the hit would be unexplainable: nothing about
	 * `tag-default-bg = #F05B2F1A` looks like the `#FDEEEA` that was pasted.
	 */
	blend?: { over: string; alpha: number };
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Accepts `838395`, `#838395`, `#fff`, `#F05B2F1A`. Returns `#RRGGBB` (alpha dropped). */
export function normalizeHex(input: string | null | undefined): string | null {
	if (!input) return null;
	const m = String(input).trim().match(HEX_RE);
	if (!m) return null;
	let v = m[1];
	if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
	return `#${v.slice(0, 6).toUpperCase()}`;
}

function toRgb(hex: string): [number, number, number] | null {
	const n = normalizeHex(hex);
	if (!n) return null;
	return [
		parseInt(n.slice(1, 3), 16),
		parseInt(n.slice(3, 5), 16),
		parseInt(n.slice(5, 7), 16),
	];
}

/** Weighted so green counts most, matching how the eye reads difference. */
export function colorDistance(a: string, b: string): number {
	const x = toRgb(a);
	const y = toRgb(b);
	if (!x || !y) return Infinity;
	const dr = x[0] - y[0];
	const dg = x[1] - y[1];
	const db = x[2] - y[2];
	return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

export interface Rgba {
	r: number;
	g: number;
	b: number;
	a: number;
}

export interface Shadow {
	color: Rgba;
	x: number;
	y: number;
	blur: number;
	spread: number;
	inset: boolean;
}

export function parseRgba(input: string | null | undefined): Rgba | null {
	if (!input) return null;
	const m = String(input).match(
		/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*(?:[,/]\s*([\d.%]+))?\s*\)/i,
	);
	if (m) {
		const rawAlpha = m[4];
		const a =
			rawAlpha === undefined
				? 1
				: rawAlpha.includes("%")
					? parseFloat(rawAlpha) / 100
					: parseFloat(rawAlpha);
		return { r: +m[1], g: +m[2], b: +m[3], a };
	}

	const rgb = toRgb(input);
	if (!rgb) return null;

	// `normalizeHex` throws alpha away, which is right for something a person
	// pasted — `#F05B2F1A` off a design file means "the brand orange" — and wrong
	// for a token value, where the alpha is the whole difference between
	// `color-primary` and `tag-default-bg`. Read it back off the original.
	const eight = String(input).trim().match(/^#?[0-9a-f]{6}([0-9a-f]{2})$/i);

	return { r: rgb[0], g: rgb[1], b: rgb[2], a: eight ? parseInt(eight[1], 16) / 255 : 1 };
}

function clampByte(value: number): number {
	return Math.min(255, Math.max(0, Math.round(value)));
}

function toHex(r: number, g: number, b: number): string {
	return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/**
 * What a translucent colour actually becomes on screen — the pixel an eyedropper
 * reads, which is never the token's own value.
 *
 * Straight `source-over` alpha compositing, in sRGB rather than linear light,
 * because that is what the browser does for `background-color`. Matching the
 * browser matters more here than being colorimetrically correct: the target is a
 * screenshot of a browser.
 */
export function composite(fore: Rgba, over: string): string | null {
	const back = toRgb(over);
	if (!back) return null;

	const a = Math.min(1, Math.max(0, fore.a));
	return toHex(
		fore.r * a + back[0] * (1 - a),
		fore.g * a + back[1] * (1 - a),
		fore.b * a + back[2] * (1 - a),
	);
}

/**
 * CSS relative colour: `rgba(from var(--go5-text-color-2) r g b / 0.6)`.
 *
 * One token in the whole set uses it (`button-outline-hover-bg` on venio-dark),
 * but the shape is spreading through the design system, and an unparsed value is
 * silently unfindable rather than visibly broken — the worst failure mode for a
 * lens whose entire job is answering "which token is this".
 */
function resolveRelative(table: TokenTable, value: string, brand: string, mode: Mode): string | null {
	const m = value.match(/rgba?\(\s*from\s+var\(\s*(--[\w-]+)\s*\)\s+r\s+g\s+b\s*\/\s*([\d.%]+)\s*\)/i);
	if (!m) return null;

	const source = table.rows.find((row) => row.cssVar === m[1]);
	const base = source && toRgb(valueOf(source, brand, mode) ?? "");
	if (!base) return null;

	const alpha = m[2].includes("%") ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
	return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${alpha})`;
}

/**
 * Reads either order — the colour is lifted out first, so whatever numbers
 * remain are offset-x, offset-y, blur, spread in that sequence.
 */
export function parseShadow(input: string | null | undefined): Shadow | null {
	if (!input) return null;
	const text = String(input).trim();
	if (!text || text === "none") return null;

	let color: string | null = null;
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
		inset: /\binset\b/i.test(text),
	};
}

export function shadowDistance(a: Shadow | null, b: Shadow | null): number {
	if (!a || !b) return Infinity;
	if (a.inset !== b.inset) return Infinity;
	const geometry =
		Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.blur - b.blur) + Math.abs(a.spread - b.spread);
	const rgb = Math.abs(a.color.r - b.color.r) + Math.abs(a.color.g - b.color.g) + Math.abs(a.color.b - b.color.b);
	return geometry + rgb / 8 + Math.abs(a.color.a - b.color.a) * 100;
}

/** A shadow is a hex plus at least two lengths; a bare hex is not. */
export function looksLikeShadow(input: string): boolean {
	const text = input.trim();
	if (normalizeHex(text)) return false;
	const hasColor = /rgba?\(|#[0-9a-f]{3,8}/i.test(text);
	const numbers = (text.replace(/rgba?\([^)]*\)/i, " ").match(/-?[\d.]+/g) ?? []).length;
	return (hasColor && numbers >= 2) || numbers >= 3;
}

const GROUP_RANK: Record<TokenGroup, number> = {
	text: 0,
	semantic: 1,
	surface: 2,
	shadow: 3,
	feature: 4,
	input: 5,
	button: 6,
	other: 7,
};

/**
 * A single hex maps to many tokens — `#FFFFFF` matches 17 of them — so ties are
 * broken towards what a developer should actually reach for: something with a
 * utility class, then a general token, and only last a component-scoped one.
 */
export function tokenRank(row: TokenRow): number {
	return (row.cls ? 0 : 10) + GROUP_RANK[row.group];
}

export function valueOf(row: TokenRow, brand: string, mode: Mode): string | null {
	return row.values[`${brand}-${mode}`] ?? null;
}

export function hasTheme(table: TokenTable, brand: string, mode: Mode): boolean {
	return table.themes.includes(`${brand}-${mode}`);
}

export function brandsOf(table: TokenTable): string[] {
	const seen: string[] = [];
	for (const theme of table.themes) {
		const brand = theme.replace(/-(light|dark)$/, "");
		if (!seen.includes(brand)) seen.push(brand);
	}
	const preferred = ["empeo", "venio"];
	return seen.sort((a, b) => {
		const ia = preferred.indexOf(a);
		const ib = preferred.indexOf(b);
		return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b);
	});
}

/**
 * The surfaces a translucent token can be sitting on.
 *
 * Only the two page-level backgrounds. Compositing over every opaque token in
 * the set would produce a hit for almost any input — the point of the lens is
 * that not finding something means something, so the candidate set has to stay
 * small enough that a match is still evidence. `card-bg-color` is deliberately
 * absent: it equals one of these two in every theme.
 */
function surfacesOf(table: TokenTable, brand: string, mode: Mode): string[] {
	const seen: string[] = [];
	for (const key of ["bg-primary", "bg-secondary"]) {
		const row = table.rows.find((r) => r.key === key);
		const hex = row && normalizeHex(valueOf(row, brand, mode));
		if (hex && !seen.includes(hex)) seen.push(hex);
	}
	return seen;
}

/**
 * Best hit per token, nearest first, shadows excluded.
 *
 * A token with alpha is compared as what it *renders* as, not as what it stores.
 * Before this, `#FDEEEA` — an eyedropper reading of an empeo tag on a white card
 * — matched nothing at all, because the lens was holding `#F05B2F1A` and
 * comparing its opaque half. That is not a near miss the ranking could rescue;
 * the two are 100 units apart. Roughly a quarter of the picks people bring here
 * are of translucent surfaces, so it read as the lens simply not working.
 */
export function findByHex(table: TokenTable, hex: string, brand: string): Hit[] {
	const target = normalizeHex(hex);
	if (!target) return [];

	const modes = ["light", "dark"] as Mode[];
	const surfaces = new Map(modes.map((mode) => [mode, surfacesOf(table, brand, mode)]));

	const best = new Map<string, Hit>();
	const consider = (row: TokenRow, value: string, blend?: Hit["blend"]) => {
		const distance = colorDistance(target, value);
		const current = best.get(row.key);
		if (!current || distance < current.distance) best.set(row.key, { row, distance, blend });
	};

	for (const row of table.rows) {
		if (row.group === "shadow") continue;

		for (const mode of modes) {
			const raw = valueOf(row, brand, mode);
			if (!raw) continue;

			const color = parseRgba(resolveRelative(table, raw, brand, mode) ?? raw);
			if (!color) continue; // `transparent`, and anything else that is not a colour

			if (color.a >= 1) {
				consider(row, toHex(color.r, color.g, color.b));
				continue;
			}

			for (const surface of surfaces.get(mode) ?? []) {
				const blended = composite(color, surface);
				if (blended) consider(row, blended, { over: surface, alpha: color.a });
			}
		}
	}

	return [...best.values()].sort(
		(a, b) => a.distance - b.distance || tokenRank(a.row) - tokenRank(b.row),
	);
}

export function findByShadow(table: TokenTable, value: string, brand: string): Hit[] {
	const target = parseShadow(value);
	if (!target) return [];

	return table.rows
		.filter((row) => row.group === "shadow")
		.map((row) => ({
			row,
			distance: Math.min(
				shadowDistance(target, parseShadow(valueOf(row, brand, "light"))),
				shadowDistance(target, parseShadow(valueOf(row, brand, "dark"))),
			),
		}))
		.filter((hit) => Number.isFinite(hit.distance))
		.sort((a, b) => a.distance - b.distance);
}

export function findByName(table: TokenTable, needle: string): TokenRow[] {
	const q = needle.trim().toLowerCase().replace(/^[.\-]+/, "");
	if (!q) return [];
	return table.rows
		.filter((row) => `${row.key} ${row.cls ?? ""} ${row.cssVar ?? ""}`.toLowerCase().includes(q))
		.sort((a, b) => tokenRank(a) - tokenRank(b));
}

/** What you paste into code: the class when one exists, otherwise the variable. */
export function usageOf(row: TokenRow): string {
	return row.cls ? `.${row.cls}` : `var(${row.cssVar})`;
}