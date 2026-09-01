/**
 * The Screens overlay, injected into the page on demand.
 *
 * Injected rather than declared: it covers the whole viewport and reloads the
 * app several times over, so it has no business existing on every page the user
 * visits. The popup calls `scripting.executeScript` when asked, and running it
 * a second time closes it — the same script is both the open and the close.
 *
 * Everything lives in a shadow root. The host page is a full design system with
 * global styles, `*` resets and its own z-index ladder; an overlay in the light
 * DOM would inherit all of it and lose. See `src/shared/screens.ts` for why the
 * frames are here in the page rather than in a viewer tab of our own.
 */

import {
	DEFAULT_SCREENS_STATE,
	enabledPresets,
	frameBox,
	PRESETS,
	SCREENS_STORAGE_KEY,
	scrollFor,
	scrollRatio,
	toggle,
	ZOOMS,
	type ScreensState,
} from "./shared/screens.ts";

const HOST_ID = "dev-inspectors-screens";

/**
 * Frames load this same page, and a frame is a window too. Without this the
 * overlay would build itself inside every frame it just created, each of which
 * would build more — `executeScript` targets the main frame only, so this is
 * belt and braces, but the failure mode is a browser that stops responding.
 */
if (window.top !== window) {
	throw new Error("Dev Inspectors: Screens runs in the top frame only");
}

/**
 * Everything bound outside the shadow root, parked on the host element rather
 * than in a module variable.
 *
 * Injecting the script a second time is how the overlay is closed, and that
 * second run is a **fresh module instance** — a module-level controller would
 * be `null` there, so the first run's Esc and resize listeners would survive
 * every close and stack up one pair per open. The host element is the only
 * thing both instances can see.
 */
interface OverlayHost extends HTMLElement {
	__devInspectorsAbort?: AbortController;
}

const existing = document.getElementById(HOST_ID) as OverlayHost | null;

if (existing) {
	close(existing);
} else {
	void open();
}

function close(host: OverlayHost): void {
	host.__devInspectorsAbort?.abort();
	host.remove();
	document.documentElement.style.overflow = host.dataset.overflow ?? "";
}

async function open(): Promise<void> {
	const state = await readState();

	const host = document.createElement("div") as OverlayHost;
	host.id = HOST_ID;
	// Stash what the page had, because the app sets this itself on some routes
	// and restoring a hardcoded "" would silently change the page behind us.
	host.dataset.overflow = document.documentElement.style.overflow;
	// `all: initial` first, to drop anything the host page's `*` selector or a
	// `div` rule would otherwise land on us; then the handful we actually want.
	// `display` is set explicitly because `all: initial` resets it to `inline`,
	// and an inline box gives `.stack`'s `height: 100%` nothing to resolve against.
	host.style.cssText = "all: initial; display: block; position: fixed; inset: 0; z-index: 2147483647;";

	const root = host.attachShadow({ mode: "open" });
	root.innerHTML = `<style>${CSS}</style>${shell()}`;

	document.documentElement.style.overflow = "hidden";
	document.body.appendChild(host);

	wire(root, host, state);
}

async function readState(): Promise<ScreensState> {
	try {
		const stored = await chrome.storage.local.get(SCREENS_STORAGE_KEY);
		return { ...DEFAULT_SCREENS_STATE, ...(stored[SCREENS_STORAGE_KEY] as Partial<ScreensState>) };
	} catch {
		return DEFAULT_SCREENS_STATE;
	}
}

function writeState(state: ScreensState): void {
	void chrome.storage.local.set({ [SCREENS_STORAGE_KEY]: state });
}

function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * A flex column, not a fixed toolbar height with an absolute rail. The toolbar
 * wraps to a second line on a narrow window or with every preset turned on, and
 * any hardcoded offset then hides half of it behind the frames.
 */
function shell(): string {
	return `
		<div class="stack">
			<div class="bar">
				<span class="brand"><i class="mark"></i>Screens</span>
				<span class="sep"></span>
				<span class="glabel">Sizes</span>
				<span class="group" id="presets"></span>
				<span class="sep"></span>
				<span class="glabel">Zoom</span>
				<span class="seg" id="zoom"></span>
				<span class="sep"></span>
				<button type="button" class="tool" id="sync" data-testid="button-screens-sync">Sync scroll</button>
				<button type="button" class="tool" id="reload" data-testid="button-screens-reload">Reload all</button>
				<span class="url" title="${escapeHtml(location.href)}">${escapeHtml(location.host + location.pathname)}</span>
				<button type="button" class="close" id="close" title="Close (Esc)" data-testid="button-screens-close">✕</button>
			</div>
			<div class="rail" id="rail"></div>
		</div>`;
}

function wire(root: ShadowRoot, host: OverlayHost, initial: ScreensState): void {
	let state = initial;

	const rail = root.getElementById("rail") as HTMLElement;
	const presetBar = root.getElementById("presets") as HTMLElement;
	const zoomBar = root.getElementById("zoom") as HTMLElement;
	const syncButton = root.getElementById("sync") as HTMLButtonElement;

	function renderControls(): void {
		presetBar.innerHTML = PRESETS.map(
			(p) =>
				`<button type="button" class="chip" data-id="${p.id}" data-testid="button-screens-preset-${p.id}" ` +
				`aria-pressed="${state.enabled.includes(p.id)}">${p.name}` +
				`<span class="dim">${p.w}×${p.h}</span></button>`,
		).join("");

		zoomBar.innerHTML = ZOOMS.map(
			(z) =>
				`<button type="button" data-zoom="${z}" data-testid="button-screens-zoom-${Math.round(z * 100)}" ` +
				`aria-pressed="${z === state.zoom}">${Math.round(z * 100)}%</button>`,
		).join("");

		syncButton.setAttribute("aria-pressed", String(state.sync));
	}

	function renderRail(): void {
		const presets = enabledPresets(state);

		if (!presets.length) {
			rail.innerHTML = `<p class="idle">Pick a size to start</p>`;
			return;
		}

		// The rail owns whatever vertical space the toolbar left, and no frame
		// exceeds it — a 1133-tall tablet at 75% would otherwise set the rail's
		// height and push the narrow frames' content off screen.
		const maxHeight = Math.max(160, rail.clientHeight - 46);

		rail.innerHTML = presets
			.map((preset) => {
				const box = frameBox(preset, state.zoom, maxHeight);

				return (
					`<div class="frame">` +
					`<div class="fhead">${preset.name}<span class="size">${preset.w}×${preset.h}</span></div>` +
					`<div class="port" style="width:${box.w}px;height:${box.h}px">` +
					`<iframe title="${escapeHtml(preset.name)}" src="${escapeHtml(location.href)}" ` +
					`style="width:${preset.w}px;height:${Math.round(box.h / state.zoom)}px;transform:scale(${state.zoom})"></iframe>` +
					`</div></div>`
				);
			})
			.join("");

		bindSync();
	}

	/**
	 * Scroll sync, and the reason it can exist at all: the frames are same-origin
	 * with the page, so `contentWindow.document` is reachable. In a viewer tab it
	 * would not be, and this feature would need `postMessage` and cooperation
	 * from the app itself.
	 *
	 * Still guarded — a frame that redirects to an identity provider becomes
	 * cross-origin mid-flight and every property access on it throws.
	 */
	function bindSync(): void {
		let echo = false;

		for (const frame of rail.querySelectorAll("iframe")) {
			frame.addEventListener("load", () => {
				const doc = safeDocument(frame);
				if (!doc) return;

				doc.defaultView?.addEventListener(
					"scroll",
					() => {
						if (!state.sync || echo) return;
						echo = true;

						const source = doc.documentElement;
						const ratio = scrollRatio(source.scrollTop, source.scrollHeight, source.clientHeight);

						for (const other of rail.querySelectorAll("iframe")) {
							if (other === frame) continue;
							const target = safeDocument(other)?.documentElement;
							if (!target) continue;
							target.scrollTop = scrollFor(ratio, target.scrollHeight, target.clientHeight);
						}

						requestAnimationFrame(() => {
							echo = false;
						});
					},
					{ passive: true },
				);
			});
		}
	}

	function safeDocument(frame: HTMLIFrameElement): Document | null {
		try {
			return frame.contentDocument;
		} catch {
			return null;
		}
	}

	function update(next: ScreensState, rebuildRail = true): void {
		state = next;
		writeState(state);
		renderControls();
		if (rebuildRail) renderRail();
	}

	presetBar.addEventListener("click", (event) => {
		const button = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
		if (button?.dataset.id) update(toggle(state, button.dataset.id));
	});

	zoomBar.addEventListener("click", (event) => {
		const button = (event.target as HTMLElement).closest<HTMLElement>("[data-zoom]");
		if (button?.dataset.zoom) update({ ...state, zoom: Number(button.dataset.zoom) });
	});

	// Sync is the one control that must not rebuild the rail: reloading five
	// copies of the app to change a boolean would throw away the scroll position
	// the setting is about.
	syncButton.addEventListener("click", () => update({ ...state, sync: !state.sync }, false));

	root.getElementById("reload")?.addEventListener("click", () => {
		for (const frame of rail.querySelectorAll("iframe")) {
			try {
				frame.contentWindow?.location.reload();
			} catch {
				// Cross-origin now — a login redirect, most likely. Re-navigating is
				// the only handle left, and it is the right one for that case.
				frame.setAttribute("src", frame.src);
			}
		}
	});

	root.getElementById("close")?.addEventListener("click", () => close(host));

	const listeners = new AbortController();
	host.__devInspectorsAbort = listeners;

	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key === "Escape") close(host);
		},
		{ capture: true, signal: listeners.signal },
	);

	// The frames are sized against the rail's height, so a resized window has to
	// re-measure. Rebuilding reloads every frame, hence the debounce.
	let resizeTimer: number | undefined;
	window.addEventListener(
		"resize",
		() => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(renderRail, 250);
		},
		{ signal: listeners.signal },
	);

	renderControls();
	renderRail();
}

/**
 * Scoped to the shadow root, so the page's own reset cannot reach it and this
 * cannot reach the page. Values are the extension's, from popup.css.
 */
const CSS = `
	:host { all: initial; }
	* { box-sizing: border-box; }

	:host {
		--bg: #ffffff;
		--panel: #fafafa;
		--ink: #18181b;
		--ink-2: #52525b;
		--ink-3: #8b8b93;
		--line: #e2e2e5;
		--line-2: #f1f1f3;
		--accent: #f05b2f;
		--accent-bg: #fdeeea;
		--violet: #7d2ef0;
		--mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
		--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
	}

	@media (prefers-color-scheme: dark) {
		:host {
			--bg: #1c1c1f;
			--panel: #232327;
			--ink: #fafafa;
			--ink-2: #a1a1aa;
			--ink-3: #6b6b73;
			--line: #2e2e33;
			--line-2: #26262a;
			--accent-bg: #32221c;
		}
	}

	.stack {
		display: flex;
		flex-direction: column;
		height: 100%;
		font-family: var(--sans);
		color: var(--ink);
	}

	.bar {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		padding: 8px 12px;
		background: var(--bg);
		border-bottom: 1px solid var(--line);
	}

	.brand { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 620; }
	.mark {
		width: 14px; height: 14px; border-radius: 4px; display: inline-block;
		background: linear-gradient(135deg, var(--accent), var(--violet));
	}

	.sep { width: 1px; align-self: stretch; background: var(--line); }
	.group, .seg { display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; }

	.glabel {
		font-family: var(--mono); font-size: 9px; letter-spacing: 0.08em;
		text-transform: uppercase; color: var(--ink-3);
	}

	button { font: inherit; color: inherit; cursor: pointer; }

	.chip, .tool {
		display: inline-flex; align-items: center; gap: 6px;
		padding: 3px 9px; border-radius: 6px;
		border: 1px solid var(--line); background: var(--bg); color: var(--ink-2);
		font-family: var(--mono); font-size: 10.5px; line-height: 1.7; white-space: nowrap;
	}

	.chip:hover, .tool:hover { border-color: var(--ink-3); }
	.chip .dim { color: var(--ink-3); font-size: 9.5px; }
	.chip[aria-pressed="true"], .tool[aria-pressed="true"] {
		border-color: var(--accent); background: var(--accent-bg); color: var(--accent);
	}
	.chip[aria-pressed="true"] .dim { color: var(--accent); opacity: 0.75; }

	.seg { gap: 0; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
	.seg button {
		border: 0; border-right: 1px solid var(--line); background: var(--bg);
		padding: 3px 9px; font-family: var(--mono); font-size: 10.5px; color: var(--ink-2);
	}
	.seg button:last-child { border-right: 0; }
	.seg button[aria-pressed="true"] { background: var(--accent); color: #fff; }

	.url {
		margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--ink-3);
		max-width: 34ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}

	.close {
		border: 1px solid var(--line); background: var(--bg); color: var(--ink-2);
		border-radius: 6px; padding: 2px 8px; font-size: 12px; line-height: 1.5;
	}
	.close:hover { border-color: var(--accent); color: var(--accent); }

	button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	.rail {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 14px 12px;
		overflow: auto;
		background:
			repeating-linear-gradient(45deg, var(--line-2) 0 1px, transparent 1px 9px),
			var(--panel);
	}

	.frame {
		flex: none; border: 1px solid var(--line); border-radius: 8px;
		background: var(--bg); overflow: hidden;
	}

	.fhead {
		display: flex; align-items: center; gap: 6px; padding: 5px 8px;
		border-bottom: 1px solid var(--line);
		font-family: var(--mono); font-size: 9.5px; color: var(--ink-2); white-space: nowrap;
	}
	.fhead .size { color: var(--ink-3); font-variant-numeric: tabular-nums; }

	.port { overflow: hidden; }
	.port iframe { border: 0; display: block; transform-origin: top left; }

	.idle {
		margin: auto; font-family: var(--mono); font-size: 12px; color: var(--ink-3);
	}
`;
