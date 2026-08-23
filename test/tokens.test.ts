import assert from "node:assert/strict";
import { test } from "node:test";

import { TOKENS } from "../src/shared/tokens.generated.ts";
import {
	findByHex,
	findByName,
	findByShadow,
	hasTheme,
	looksLikeShadow,
	normalizeHex,
	parseShadow,
	shadowDistance,
	usageOf,
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