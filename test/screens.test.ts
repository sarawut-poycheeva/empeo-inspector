import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEFAULT_SCREENS_STATE,
	enabledPresets,
	frameBox,
	PRESETS,
	scrollFor,
	scrollRatio,
	toggle,
	ZOOMS,
	type ScreensState,
} from "../src/shared/screens.ts";

test("the rail reads narrow to wide, whatever order the ids were stored in", () => {
	// Order comes from PRESETS, not from the stored array — otherwise turning a
	// size off and on again moves it to the end of the rail, and the comparison
	// people are making is between neighbours.
	const state: ScreensState = { ...DEFAULT_SCREENS_STATE, enabled: ["desktop", "webview", "ipad"] };

	assert.deepEqual(
		enabledPresets(state).map((p) => p.id),
		["webview", "ipad", "desktop"],
	);
});

test("a stored id that no longer exists is dropped, not rendered as a hole", () => {
	const state: ScreensState = { ...DEFAULT_SCREENS_STATE, enabled: ["laptop", "pixel-2-xl"] };

	assert.deepEqual(
		enabledPresets(state).map((p) => p.id),
		["laptop"],
	);
});

test("toggle adds and removes without disturbing the rest", () => {
	const start: ScreensState = { ...DEFAULT_SCREENS_STATE, enabled: ["webview", "laptop"] };

	assert.deepEqual(toggle(start, "ipad").enabled, ["webview", "laptop", "ipad"]);
	assert.deepEqual(toggle(start, "webview").enabled, ["laptop"]);
	assert.deepEqual(start.enabled, ["webview", "laptop"], "the input is not mutated");
});

test("every default is a real preset", () => {
	const ids = PRESETS.map((p) => p.id);
	for (const id of DEFAULT_SCREENS_STATE.enabled) assert.ok(ids.includes(id), `${id} is not a preset`);
	assert.ok(ZOOMS.includes(DEFAULT_SCREENS_STATE.zoom as (typeof ZOOMS)[number]));
});

test("scroll syncs by fraction, because the frames are different lengths", () => {
	// A 390px column of the same content is far taller than a 1440px grid of it.
	// Matching scrollTop would put the narrow frame near the top while the wide
	// one is at the end — and layouts diverging is the only reason to look.
	const narrow = { scrollHeight: 4000, clientHeight: 800 };
	const wide = { scrollHeight: 1600, clientHeight: 800 };

	const ratio = scrollRatio(1600, narrow.scrollHeight, narrow.clientHeight);
	assert.equal(ratio, 0.5);
	assert.equal(scrollFor(ratio, wide.scrollHeight, wide.clientHeight), 400);
});

test("a frame with nothing to scroll reports zero rather than dragging the others", () => {
	assert.equal(scrollRatio(0, 800, 800), 0);
	assert.equal(scrollRatio(120, 600, 800), 0, "content shorter than the viewport");
	assert.equal(scrollFor(0.5, 800, 800), 0);
});

test("scrollRatio clamps, so rubber-band overscroll cannot push the others past the end", () => {
	assert.equal(scrollRatio(-40, 2000, 500), 0);
	assert.equal(scrollRatio(99999, 2000, 500), 1);
});

test("a frame never grows past the rail", () => {
	const ipad = PRESETS.find((p) => p.id === "ipad");
	assert.ok(ipad);

	// 1133 × 0.75 is 850, which would set the rail height and push every other
	// frame's content out of view.
	assert.deepEqual(frameBox(ipad, 0.75, 600), { w: 558, h: 600 });
	assert.deepEqual(frameBox(ipad, 0.25, 600), { w: 186, h: 283 });
});
