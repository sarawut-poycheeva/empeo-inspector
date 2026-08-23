/**
 * The Gofive icon set, read from the stylesheet that ships it.
 *
 * There is no local copy to generate from — the icon assets live only on the
 * asset CDN — so this fetches at runtime. The CDN answers with
 * `access-control-allow-origin: *`, which is why no host permission is needed,
 * and the font is served `immutable` with a one-year max-age, so the browser
 * cache carries it after the first open.
 *
 * A name tells you nothing about what an icon looks like: `gf-icon-box-rising-star`
 * and `gf-icon-box-strong-performer` are indistinguishable until rendered. That is
 * the reason this exists rather than a grep.
 */

export interface IconEnv {
	id: string;
	label: string;
	base: string;
}

/** Taken from `environment.*.ts` → `gofiveCoreWeb.baseUrl` in the consuming apps. */
export const ICON_ENVS: IconEnv[] = [
	{ id: "dev", label: "dev", base: "https://apps-dev.gofive.co.th/" },
	{ id: "uat", label: "uat", base: "https://apps-uat.gofive.co.th/" },
	{ id: "prod", label: "prod", base: "https://app.gofive.co.th/modules/" },
];

const CSS_PATH = "assets/icons/go5-icon/style.css";
const FONT_PATH = "assets/icons/go5-icon/fonts/gofive.woff";

/** The folder is named go5-icon but every class is `gf-icon-*`. */
export const ICON_PREFIX = "gf-icon-";
export const ICON_FONT_FAMILY = "gofive";

/**
 * The stylesheet, with a cache buster — which is not optional.
 *
 * `cache: "no-cache"` only bypasses the *browser* cache. The file is served
 * `cache-control: public, max-age=31536000, immutable` from behind Cloudflare,
 * so the edge answers a bare URL out of its own copy: measured `cf-cache-status:
 * HIT` with `age: 337162` — **3.9 days stale**, reporting 1203 icons on dev when
 * the origin had 1205. The lens looked like it was refusing to see a deployment;
 * it was being told the wrong thing by a machine in between.
 *
 * A unique query is a distinct cache key, which is exactly what the app does
 * when it loads this same file (`style.css?v=<version>`) — and the reason the
 * page showed a new icon while this did not.
 */
export function iconCssUrl(env: IconEnv, buster: string | number = Date.now()): string {
	return `${env.base}${CSS_PATH}?v=${buster}`;
}

/** Same buster, same reason — and the font goes stale in the *browser* cache too. */
export function iconFontUrl(env: IconEnv, buster: string | number = Date.now()): string {
	return `${env.base}${FONT_PATH}?v=${buster}`;
}

export interface ParsedIcon {
	cls: string;
	/** Name without the family prefix — what a person actually searches for. */
	short: string;
	/** Codepoint as written in the CSS, e.g. `e907`. */
	code: string;
}

/**
 * Pulls `.gf-icon-x:before { content: "\e907" }` out of an icon-font stylesheet.
 * The prefix is taken from the CSS rather than assumed.
 */
export function parseIconCss(css: string): ParsedIcon[] {
	const found = new Map<string, ParsedIcon>();
	const rule = /\.([a-zA-Z0-9_-]+):before\s*\{[^}]*?content:\s*["']\\?([0-9a-fA-F]{2,6})["']/g;

	for (const match of css.matchAll(rule)) {
		const cls = match[1];
		if (found.has(cls)) continue;

		found.set(cls, {
			cls,
			short: cls.replace(/^[a-z0-9]+-icon-/i, ""),
			code: match[2].toLowerCase(),
		});
	}

	return [...found.values()];
}

export interface Icon {
	/** Name without prefix. This is the identity — see the note on codepoints below. */
	short: string;
	/** Codepoint per environment. */
	codes: Record<string, string>;
	/** Environments that ship this icon. */
	envs: string[];
}

/**
 * Merges the per-environment sets **by name**.
 *
 * Codepoints must not be used as identity. Inserting one new glyph shifts the
 * slot of every icon after it, so a single addition on uat made 1,128 of 1,204
 * icons look "different" from dev when compared by codepoint — all false. The
 * same reason means code must never reference `content: "\e907"` directly; only
 * the class name is stable.
 */
export function mergeByName(perEnv: Record<string, ParsedIcon[]>): Icon[] {
	const merged = new Map<string, Icon>();

	for (const [envId, icons] of Object.entries(perEnv)) {
		for (const icon of icons) {
			const row = merged.get(icon.short) ?? { short: icon.short, codes: {}, envs: [] };
			row.codes[envId] = icon.code;
			if (!row.envs.includes(envId)) row.envs.push(envId);
			merged.set(icon.short, row);
		}
	}

	return [...merged.values()].sort((a, b) => a.short.localeCompare(b.short, "en"));
}

export function classOf(icon: Icon): string {
	return ICON_PREFIX + icon.short;
}

/** The glyph to render. Any environment's codepoint works as long as it matches the loaded font. */
export function glyphOf(icon: Icon, fontEnv: string): string {
	const code = icon.codes[fontEnv] ?? Object.values(icon.codes)[0];
	return code ? String.fromCodePoint(parseInt(code, 16)) : "";
}

/**
 * The codepoint AND the font it has to be drawn with.
 *
 * These cannot be chosen separately. Codepoints drift between environments —
 * `empeo-magic-wand` is `eab9` on one and `eab7` on another — so rendering one
 * environment's slot number with another environment's font file draws whatever
 * happens to sit at that slot: a person instead of a wand. The glyph is the whole
 * payload of this lens, so a wrong one is worse than none.
 *
 * Preference order is dev → uat → prod, because a just-added icon exists there
 * first and that is the case people are looking at.
 */
export function glyphSourceOf(icon: Icon): { env: string; char: string } | null {
	for (const env of ICON_ENVS) {
		const code = icon.codes[env.id];
		if (code) return { env: env.id, char: String.fromCodePoint(parseInt(code, 16)) };
	}
	return null;
}

/** The family name registered per environment, so a card can pick the right one. */
export function fontFamilyOf(envId: string): string {
	return `${ICON_FONT_FAMILY}-${envId}`;
}

/** Shows one codepoint when every environment agrees, otherwise all of them. */
export function codeLabelOf(icon: Icon): string {
	const seen: string[] = [];
	for (const env of ICON_ENVS) {
		const code = icon.codes[env.id];
		if (code && !seen.includes(code)) seen.push(code);
	}
	return seen.join(" / ");
}

export function isPartial(icon: Icon): boolean {
	return icon.envs.length < ICON_ENVS.length;
}

/**
 * Ranks so that what you typed lands on top: exact name, then prefix, then
 * substring, then codepoint. Searching "star" should not bury `box-star`
 * underneath `box-rising-star`.
 */
export function searchIcons(icons: Icon[], query: string): Icon[] {
	const q = query.trim().toLowerCase().replace(/^\.?(?:[a-z0-9]+-icon-)?/, "");
	if (!q) return icons;

	const scored: { icon: Icon; rank: number }[] = [];

	for (const icon of icons) {
		const name = icon.short.toLowerCase();
		let rank: number;

		if (name === q) rank = 0;
		else if (name.startsWith(q)) rank = 1;
		else if (name.includes(q)) rank = 2;
		else if (Object.values(icon.codes).includes(q)) rank = 3;
		else continue;

		scored.push({ icon, rank });
	}

	return scored
		.sort((a, b) => a.rank - b.rank || a.icon.short.length - b.icon.short.length)
		.map((s) => s.icon);
}

/**
 * Names present now that the baseline had never seen.
 *
 * Deliberately one-directional: a name that disappears is not reported here.
 * Removals matter — they break code that still references the class — but they
 * cannot be shown as a card, since there is no longer a glyph to draw, so they
 * belong to a different feature rather than a silent half of this one.
 */
export function newSince(names: string[], known: string[]): string[] {
	const seen = new Set(known);
	return names.filter((name) => !seen.has(name));
}
