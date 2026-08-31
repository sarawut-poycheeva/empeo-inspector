import assert from "node:assert/strict";
import { test } from "node:test";

import { TOKENS } from "../src/shared/tokens.generated.ts";
import {
	composite,
	findByHex,
	findByName,
	findByShadow,
	hasTheme,
	looksLikeShadow,
	normalizeHex,
	parseRgba,
	parseShadow,
	shadowDistance,
	usageOf,
	valueOf,
} from "../src/shared/tokens.ts";

test("normalizeHex accepts the shapes people actually paste", () => {
	assert.equal(normalizeHex("#838395"), "#838395");
	assert.equal(normalizeHex("838395"), "#838395");
	assert.equal(normalizeHex("fff"), "#FFFFFF");
	assert.equal(normalizeHex("#F05B2F1A"), "#F05B2F", "alpha is dropped, not rejected");
	assert.equal(normalizeHex("rgb(1,2,3)"), null);
	assert.equal(normalizeHex(""), null);
});

test("a text-ramp hex resolves to its utility class first", () => {
	const hits = findByHex(TOKENS, "#838395", "empeo");
	const exact = hits.filter((h) => h.distance === 0);

	assert.ok(exact.length > 1, "one grey is shared by several tokens");
	assert.ok(
		exact[0].row.cls?.startsWith("go5-text-color-"),
		`expected a text-color class first, got ${exact[0].row.cls ?? exact[0].row.cssVar}`,
	);
});

test("a hex that is off by one digit ranks near the brand colour, and is not an answer", () => {
	const hits = findByHex(TOKENS, "#F05B30", "empeo");

	// The matcher still measures distance — the shadow lens and the token list use
	// the ordering — but the colours lens shows exact hits only. A near miss
	// rendered in the answer card reads as "use this", and a developer acting on
	// it writes a token that is not the colour they were handed.
	assert.equal(hits.filter((h) => h.distance === 0).length, 0, "nothing matches exactly, so nothing is shown");
	assert.equal(hits[0].row.key, "color-primary");
	assert.ok(hits[0].distance > 0 && hits[0].distance < 5, `expected a tiny delta, got ${hits[0].distance}`);
});

test("parseRgba keeps the alpha of an 8-digit hex, which normalizeHex drops", () => {
	// The two disagree on purpose: `#F05B2F1A` pasted by a person means the brand
	// orange, but the same string as a token value is a 10% wash, and the whole
	// difference between `color-primary` and `tag-default-bg` lives in that byte.
	assert.equal(normalizeHex("#F05B2F1A"), "#F05B2F");
	assert.deepEqual(parseRgba("#F05B2F1A"), { r: 240, g: 91, b: 47, a: 0x1a / 255 });
	assert.deepEqual(parseRgba("#F05B2F"), { r: 240, g: 91, b: 47, a: 1 });
});

test("composite reproduces what the browser paints", () => {
	// The real token alpha, `0x1A/255 = 0.1019…`, not a rounded 0.1 — at 0.1 the
	// red channel lands on 253.5 and the answer changes with the rounding rule.
	assert.equal(composite({ r: 240, g: 91, b: 47, a: 0x1a / 255 }, "#FFFFFF"), "#FDEEEA");
	assert.equal(composite({ r: 0, g: 0, b: 0, a: 0.16 }, "#FFFFFF"), "#D6D6D6");
	assert.equal(composite({ r: 1, g: 2, b: 3, a: 0 }, "#FFFFFF"), "#FFFFFF", "fully transparent is the surface");
	assert.equal(composite({ r: 1, g: 2, b: 3, a: 1 }, "#FFFFFF"), "#010203", "fully opaque ignores the surface");
	assert.equal(composite({ r: 0, g: 0, b: 0, a: 0.5 }, "not a colour"), null);
});

test("an eyedropper reading of a translucent token resolves to that token", () => {
	// The reported symptom: pick the colour off a screen and the lens finds
	// nothing, because it was comparing the stored `#F05B2F1A` against the pixel.
	const tag = TOKENS.rows.find((r) => r.key === "tag-default-bg");
	assert.equal(valueOf(tag!, "empeo", "dark"), "#F05B2F1A", "the premise of this test");

	const picked = composite(parseRgba("#F05B2F1A")!, "#1C1C22"); // empeo-dark bg-primary
	assert.equal(picked, "#322223");

	const hit = findByHex(TOKENS, picked!, "empeo").find((h) => h.row.key === "tag-default-bg");
	assert.ok(hit, "the picked pixel must reach the token it came from");
	assert.equal(hit.distance, 0, "and as an exact match, not a near one");
	assert.equal(hit.blend?.over, "#1C1C22");
	assert.equal(Math.round((hit.blend?.alpha ?? 0) * 100), 10);
});

test("rgba() and rgb(… / %) token values are reachable by hex", () => {
	// 24 token values are authored in these shapes. Every one of them was
	// invisible to a hex search, because the matcher ran them through a hex-only
	// parser and skipped whatever came back null.
	const hover = findByHex(TOKENS, "#D6D6D6", "empeo").find((h) => h.row.key === "card-hover");
	assert.ok(hover && hover.distance === 0, "rgba(0, 0, 0, 0.16) over white");
	assert.equal(hover.blend?.over, "#FFFFFF");

	const nav = TOKENS.rows.find((r) => r.key === "nav-bg-icon-active");
	assert.equal(valueOf(nav!, "empeo", "light"), "rgb(255 255 255 / 30%)", "the space-separated form with a percent");
	assert.deepEqual(parseRgba(valueOf(nav!, "empeo", "light")), { r: 255, g: 255, b: 255, a: 0.3 });
});

test("a relative colour resolves through the variable it is derived from", () => {
	// `rgba(from var(--go5-text-color-2) r g b / 0.6)` — one token uses it today,
	// and an unparsed value is silently unfindable rather than visibly broken.
	const row = TOKENS.rows.find((r) => r.key === "button-outline-hover-bg");
	assert.match(valueOf(row!, "venio", "dark") ?? "", /^rgba\(from var\(/, "the premise of this test");

	// text-color-2 on venio-dark is #383842, at 60% over the #1C1C22 page.
	const hit = findByHex(TOKENS, "#2D2D35", "venio").find((h) => h.row.key === "button-outline-hover-bg");
	assert.ok(hit && hit.distance === 0);
	assert.equal(Math.round((hit.blend?.alpha ?? 0) * 100), 60);
});

test("an opaque token outranks a blended one at the same colour", () => {
	// Both are exact, but only one of them needs the reader to reason about what
	// it was sitting on, so `renderHex` puts the plain answer first.
	const hits = findByHex(TOKENS, "#FFFFFF", "empeo").filter((h) => h.distance === 0);
	assert.ok(hits.length > 1);
	assert.equal(hits.some((h) => !h.blend), true, "at least one plain white token");
});

test("transparent is not a colour and must not match anything", () => {
	const text = TOKENS.rows.find((r) => r.key === "button-text-default-bg");
	assert.equal(valueOf(text!, "empeo", "light"), "transparent");

	const hit = findByHex(TOKENS, "#FFFFFF", "empeo").find((h) => h.row.key === "button-text-default-bg");
	assert.ok(!hit || hit.distance > 0, "a transparent value must not resolve to the surface behind it");
});

test("brand colour differs between empeo and venio", () => {
	const empeo = findByHex(TOKENS, "#F05B2F", "empeo")[0];
	const venio = findByHex(TOKENS, "#116DFC", "venio")[0];

	assert.equal(empeo.row.key, "color-primary");
	assert.equal(empeo.distance, 0);
	assert.equal(venio.row.key, "color-primary");
	assert.equal(venio.distance, 0);
});

test("the text ramp mirrors between light and dark", () => {
	const first = TOKENS.rows.find((r) => r.key === "text-color-1");
	const last = TOKENS.rows.find((r) => r.key === "text-color-12");

	assert.ok(first && last);
	assert.equal(first.values["empeo-light"], last.values["empeo-dark"]);
	assert.equal(first.values["empeo-dark"], last.values["empeo-light"]);
});

test("parseShadow reads CSS order and Chrome's normalised order alike", () => {
	const authored = parseShadow("0 0 8px 0 rgba(0, 0, 0, 0.08)");
	const computed = parseShadow("rgba(0, 0, 0, 0.08) 0px 0px 8px 0px");

	assert.deepEqual(authored, computed);
	assert.equal(shadowDistance(authored, computed), 0);
});

test("the value from the design file maps onto shadow-soft", () => {
	const hits = findByShadow(TOKENS, "0 0 8px 0 rgba(0, 0, 0, 0.08)", "empeo");

	assert.equal(hits[0].row.key, "shadow-soft");
	assert.equal(hits[0].distance, 0);
	assert.equal(usageOf(hits[0].row), "var(--go5-shadow-soft)");
});

test("a shadow with the wrong alpha is near, not exact", () => {
	const hits = findByShadow(TOKENS, "0 0 8px 0 rgba(0, 0, 0, 0.12)", "empeo");

	assert.equal(hits[0].row.key, "shadow-soft");
	assert.ok(hits[0].distance > 0, "0.12 is not 0.08");
});

test("shadows flip colour in dark mode, which is why hardcoding breaks", () => {
	const soft = TOKENS.rows.find((r) => r.key === "shadow-soft");

	assert.ok(soft);
	assert.match(soft.values["empeo-light"], /rgba\(0, 0, 0/);
	assert.match(soft.values["empeo-dark"], /rgba\(255, 255, 255/);
});

test("looksLikeShadow separates a shadow from a bare colour", () => {
	assert.equal(looksLikeShadow("0 0 8px 0 rgba(0,0,0,0.08)"), true);
	assert.equal(looksLikeShadow("rgba(0, 0, 0, 0.08) 0px 0px 8px 0px"), true);
	assert.equal(looksLikeShadow("#838395"), false);
	assert.equal(looksLikeShadow("838395"), false);
	assert.equal(looksLikeShadow("primary"), false);
});

test("usageOf gives a class when one exists and a variable otherwise", () => {
	const withClass = TOKENS.rows.find((r) => r.cls === "go5-text-color-8");
	const varOnly = TOKENS.rows.find((r) => r.key === "bg-secondary");

	assert.ok(withClass && varOnly);
	assert.equal(usageOf(withClass), ".go5-text-color-8");
	assert.equal(usageOf(varOnly), "var(--go5-bg-secondary)");
});

test("only a minority of tokens ship a utility class", () => {
	const withClass = TOKENS.rows.filter((r) => r.cls).length;

	assert.ok(withClass > 0 && withClass < TOKENS.rows.length / 2, `${withClass} of ${TOKENS.rows.length}`);
});

test("findByName matches class, variable and key", () => {
	assert.ok(findByName(TOKENS, "text-color-8").some((r) => r.cls === "go5-text-color-8"));
	assert.ok(findByName(TOKENS, ".go5-color-primary").some((r) => r.key === "color-primary"));
	assert.ok(findByName(TOKENS, "--go5-bg-secondary").some((r) => r.key === "bg-secondary"));
	assert.equal(findByName(TOKENS, "definitely-not-a-token").length, 0);
});

test("three brands ship no dark theme", () => {
	assert.equal(hasTheme(TOKENS, "empeo", "dark"), true);
	assert.equal(hasTheme(TOKENS, "venio", "dark"), true);
	assert.equal(hasTheme(TOKENS, "etaxgo", "dark"), false);
	assert.equal(hasTheme(TOKENS, "salesbear", "dark"), false);
	assert.equal(hasTheme(TOKENS, "custom", "dark"), false);
});

test("the malformed feature hexes in DS are flagged", () => {
	const broken = TOKENS.rows.filter((r) => r.invalidHex);

	assert.equal(broken.length, 3);
	assert.deepEqual(
		broken.map((r) => r.cls).sort(),
		["go5-color-feature-conversation", "go5-color-feature-customer", "go5-color-feature-salesorder"],
	);
});