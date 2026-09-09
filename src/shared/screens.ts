/**
 * The Screens lens: the page you are on, at several widths at once.
 *
 * The whole design turns on one decision — **the frames render inside the tab
 * you are already in**, not in a viewer tab of our own. A viewer tab would be
 * `chrome-extension://` at the top level, which costs three things at once:
 *
 *  - `X-Frame-Options: SAMEORIGIN` starts rejecting the frames, so the headers
 *    have to be stripped with a `declarativeNetRequest` rule;
 *  - cookies stop being sent, because the request is suddenly cross-site;
 *  - and `sessionStorage` — where both empeo and core-web keep `access_token`
 *    — is scoped to the tab, so every frame boots logged out.
 *
 * Staying in the tab makes all three go away without a line of code: the frames
 * are same-origin with the page, so framing is allowed, cookies flow, and the
 * token the app already put in `sessionStorage` is the same one the frames read.
 *
 * That last claim is the one to watch. It is what the spec says and it is why
 * this is built this way, but it has not been observed against a real portal
 * yet — if a frame lands on the login screen, this is the reason.
 */

export interface DevicePreset {
	id: string;
	name: string;
	w: number;
	h: number;
}

/**
 * Sizes that correspond to something real in this product rather than to a
 * catalogue of handsets: the mobile webview routes, the smallest phone still
 * in the support matrix, a tablet, and the two desktop widths the layouts
 * actually branch on.
 */
export const PRESETS: DevicePreset[] = [
	{ id: "webview", name: "Webview", w: 390, h: 844 },
	{ id: "se", name: "iPhone SE", w: 375, h: 667 },
	{ id: "ipad", name: "iPad mini", w: 744, h: 1133 },
	{ id: "laptop", name: "Laptop", w: 1280, h: 800 },
	{ id: "desktop", name: "Desktop", w: 1440, h: 900 },
	{ id: "wide", name: "Wide", w: 1920, h: 1080 },
];

export const ZOOMS = [0.25, 0.35, 0.5, 0.75] as const;

export const SCREENS_STORAGE_KEY = "screens";

export interface ScreensState {
	/** Preset ids, in preset order. */
	enabled: string[];
	zoom: number;
	sync: boolean;
}

export const DEFAULT_SCREENS_STATE: ScreensState = {
	enabled: ["webview", "ipad", "laptop", "desktop"],
	zoom: 0.35,
	sync: true,
};

/**
 * Resolves stored ids against the current preset list, in preset order.
 *
 * Order comes from `PRESETS` rather than from the stored array so the rail
 * always reads narrow-to-wide; an id that no longer exists is dropped instead
 * of leaving a hole.
 */
export function enabledPresets(state: ScreensState): DevicePreset[] {
	return PRESETS.filter((preset) => state.enabled.includes(preset.id));
}

export function toggle(state: ScreensState, id: string): ScreensState {
	const enabled = state.enabled.includes(id)
		? state.enabled.filter((other) => other !== id)
		: [...state.enabled, id];

	return { ...state, enabled };
}

/**
 * Where a frame's scroll sits, as a fraction of how far it can go.
 *
 * Syncing by `scrollTop` looks right until the layouts diverge — which is the
 * only moment anyone is looking at this. A 390px column and a 1440px grid of
 * the same content are different lengths, so the same pixel offset is a
 * different place in the page.
 */
export function scrollRatio(scrollTop: number, scrollHeight: number, clientHeight: number): number {
	const span = scrollHeight - clientHeight;
	if (span <= 0) return 0;
	return Math.min(1, Math.max(0, scrollTop / span));
}

export function scrollFor(ratio: number, scrollHeight: number, clientHeight: number): number {
	return Math.max(0, scrollHeight - clientHeight) * ratio;
}

/** The on-screen box for a frame, after scaling. */
export function frameBox(preset: DevicePreset, zoom: number, maxHeight: number): { w: number; h: number } {
	return {
		w: Math.round(preset.w * zoom),
		h: Math.round(Math.min(preset.h * zoom, maxHeight)),
	};
}
