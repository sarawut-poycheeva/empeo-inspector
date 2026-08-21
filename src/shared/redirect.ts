/**
 * Redirect lens — pure logic.
 *
 * Ported from the `empeo-requestly` extension: point a deployed Module
 * Federation bundle at a local dev server so a change can be checked against
 * real data without deploying. The mechanism is unchanged (declarativeNetRequest
 * dynamic rules with `redirect.transform`, so only scheme/host/port are
 * rewritten and the path survives); the model gained a per-entry port and
 * accepts a pasted URL.
 */

export interface RedirectEntry {
	/** Doubles as the DNR rule id, which is why it must be a positive integer. */
	id: number;
	/** Substring matched against the request URL, e.g. `empeo-learn/main.js`. */
	path: string;
	port: number;
	enabled: boolean;
	/**
	 * Optional, and absent on entries stored before naming existed — never read
	 * directly, always through `labelOf`, so old data keeps working with no
	 * migration step.
	 */
	label?: string;
}

/**
 * A name nobody had to type.
 *
 * Asking for one up front would put a third field in the add row and get
 * skipped; deriving it means every entry is named from the moment it exists and
 * renaming is only for when the guess is not good enough. `empeo-learn/main.js`
 * is `empeo-learn` — the module is what people call these, not the file, which
 * is `main.js` for every single one of them.
 */
export function deriveName(path: string): string {
	const segments = path.split("/").filter(Boolean);
	if (!segments.length) return path;
	if (segments.length === 1) return segments[0].replace(/\.[a-z0-9]+$/i, "");
	return segments[0];
}

export function labelOf(entry: RedirectEntry): string {
	return entry.label?.trim() || deriveName(entry.path);
}

export interface RedirectState {
	globalEnabled: boolean;
	entries: RedirectEntry[];
}

export const DEFAULT_PORT = 3000;

export const REDIRECT_STORAGE_KEYS = { globalEnabled: true, entries: [] as RedirectEntry[] };

/**
 * What people have to hand is rarely the bare substring — it is the URL copied
 * out of the Network panel. Accept both, and throw away everything that would
 * stop the match: origin, leading slash, and the `?v=…` cache buster the host
 * appends to every module (leaving it in makes the filter match one build only).
 */
export function normalizePath(input: string): string | null {
	let value = input.trim();
	if (!value) return null;

	const scheme = /^[a-z][a-z0-9+.-]*:\/\//i;
	if (scheme.test(value)) {
		// Everything up to the first slash is the authority, whatever it looks like.
		value = value.replace(scheme, "").replace(/^[^/]*\/?/, "");
	} else if (/^(?:[^/]*\.[^/]*|localhost)(?::\d+)?\//.test(value)) {
		// A bare host with no scheme: `apps-uat.gofive.co.th/…` or `localhost:3000/…`
		value = value.replace(/^[^/]*\//, "");
	}

	value = value.split(/[?#]/)[0];
	value = value.replace(/^\/+/, "");

	return value || null;
}

/** Rule ids must never collide with a live rule, so they only ever go up. */
export function nextId(entries: RedirectEntry[]): number {
	return entries.reduce((max, entry) => Math.max(max, entry.id), 0) + 1;
}

export function parsePort(input: string): number | null {
	if (!/^\d{1,5}$/.test(input.trim())) return null;
	const port = Number(input.trim());
	return port >= 1 && port <= 65535 ? port : null;
}

export function addEntry(entries: RedirectEntry[], path: string, port: number): RedirectEntry[] {
	// Same path twice would mean two rules racing over one request; the newer
	// port silently loses, so the existing entry is updated instead.
	const existing = entries.find((entry) => entry.path === path);
	if (existing) return entries.map((entry) => (entry === existing ? { ...entry, port, enabled: true } : entry));

	return [...entries, { id: nextId(entries), path, port, enabled: true }];
}

export interface DnrRule {
	id: number;
	priority: number;
	action: { type: "redirect"; redirect: { transform: { scheme: string; host: string; port: string } } };
	condition: { urlFilter: string; resourceTypes: string[] };
}

const RESOURCE_TYPES = ["script", "stylesheet", "sub_frame", "xmlhttprequest"];

export function buildDnrRule(entry: RedirectEntry): DnrRule {
	return {
		id: entry.id,
		priority: 1,
		action: {
			type: "redirect",
			redirect: { transform: { scheme: "http", host: "localhost", port: String(entry.port) } },
		},
		condition: { urlFilter: entry.path, resourceTypes: RESOURCE_TYPES },
	};
}

/** Global off empties the rule set without touching the list. */
export function rulesFor(state: RedirectState): DnrRule[] {
	if (!state.globalEnabled) return [];
	return state.entries.filter((entry) => entry.enabled && entry.path).map(buildDnrRule);
}

export function activeCount(state: RedirectState): number {
	return rulesFor(state).length;
}

/** Where the request actually ends up — also the URL worth probing. */
export function targetUrl(entry: RedirectEntry): string {
	return `http://localhost:${entry.port}/${entry.path}`;
}

/**
 * Module Federation entry points, picked out of every resource a page loaded.
 *
 * Typing the path by hand is where this lens goes wrong: one wrong character and
 * nothing matches, with no error anywhere. Reading what the page actually
 * fetched removes the guess entirely — and answers the question that comes
 * first anyway, which is *what does this page even load*.
 *
 * A page pulls in hundreds of scripts, so the filter keeps the ones that are
 * remotes: `main.js`, `remoteEntry.js`, `polyfills.js`. Anything else is a
 * webpack chunk with a hash in its name, which is worthless as a rule — it
 * changes every build.
 */
const ENTRY_POINT = /\/(main|remoteEntry|polyfills)\.js$/;

export function moduleCandidates(urls: string[]): string[] {
	const paths = new Set<string>();

	for (const url of urls) {
		const path = normalizePath(url);

		// The folder is required, not decoration: a bare `main.js` would match every
		// module on every host and point them all at one port, breaking the page in
		// a way that looks nothing like a redirect problem.
		if (path?.includes("/") && ENTRY_POINT.test(`/${path}`)) paths.add(path);
	}

	// Deepest-named first is useless; alphabetical is what people scan.
	return [...paths].sort((a, b) => a.localeCompare(b));
}
