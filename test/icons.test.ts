import assert from "node:assert/strict";
import { test } from "node:test";

import {
	classOf,
	codeLabelOf,
	glyphOf,
	ICON_ENVS,
	ICON_PREFIX,
	iconCssUrl,
	isPartial,
	mergeByName,
	newSince,
	parseIconCss,
	searchIcons,
	type ParsedIcon,
} from "../src/shared/icons.ts";

/** Shaped like the real stylesheet, including the @font-face block it opens with. */
const CSS = `
@font-face {
  font-family: 'gofive';
  src: url('fonts/gofive.woff') format('woff');
}
.gf-icon-asset-menu-filled:before { content: "\\e900"; }
.gf-icon-cx:before {
  content: "\\e901";
}
.gf-icon-box-rising-star:before { content: "\\e907"; }
.gf-icon-box-star:before { content: "\\e908"; }
.gf-icon-upload:before { content: "\\ea1f"; }
`;

test("parseIconCss reads class and codepoint, ignoring @font-face", () => {
	const icons = parseIconCss(CSS);

	assert.equal(icons.length, 5);
	assert.deepEqual(icons[0], { cls: "gf-icon-asset-menu-filled", short: "asset-menu-filled", code: "e900" });
	assert.ok(!icons.some((i) => i.cls.includes("font-face")));
});

test("the family prefix is stripped, because that is what people type", () => {
	const icons = parseIconCss(CSS);
	assert.equal(icons.find((i) => i.short === "box-star")?.cls, "gf-icon-box-star");
	assert.equal(classOf({ short: "box-star", codes: {}, envs: [] }), "gf-icon-box-star");
	assert.equal(ICON_PREFIX, "gf-icon-");
});

test("multi-line rules and 4-digit codepoints both parse", () => {
	const icons = parseIconCss(CSS);
	assert.equal(icons.find((i) => i.short === "cx")?.code, "e901");
	assert.equal(icons.find((i) => i.short === "upload")?.code, "ea1f");
});

test("glyphOf turns a codepoint into the character the font draws", () => {
	const icon = { short: "box-star", codes: { uat: "e908" }, envs: ["uat"] };
	assert.equal(glyphOf(icon, "uat"), String.fromCodePoint(0xe908));
	// falls back to any environment rather than rendering nothing
	assert.equal(glyphOf(icon, "prod"), String.fromCodePoint(0xe908));
});

test("merging happens by name, never by codepoint", () => {
	// The real drift: uat inserted a glyph, so every later slot shifted by one.
	const perEnv: Record<string, ParsedIcon[]> = {
		dev: [
			{ cls: "gf-icon-cx", short: "cx", code: "e901" },
			{ cls: "gf-icon-box-star", short: "box-star", code: "e908" },
		],
		uat: [
			{ cls: "gf-icon-asset-menu-filled", short: "asset-menu-filled", code: "e900" },
			{ cls: "gf-icon-cx", short: "cx", code: "e900" },
			{ cls: "gf-icon-box-star", short: "box-star", code: "e907" },
		],
		prod: [
			{ cls: "gf-icon-cx", short: "cx", code: "e901" },
			{ cls: "gf-icon-box-star", short: "box-star", code: "e908" },
		],
	};

	const merged = mergeByName(perEnv);

	assert.equal(merged.length, 3, "three distinct names across all environments");

	const cx = merged.find((i) => i.short === "cx");
	assert.ok(cx);
	assert.deepEqual(cx.envs.sort(), ["dev", "prod", "uat"]);
	assert.equal(isPartial(cx), false, "shifted codepoints must not read as missing");
	assert.equal(codeLabelOf(cx), "e901 / e900", "both slots shown when they disagree");
});

test("an icon on one environment only is reported as partial", () => {
	const merged = mergeByName({
		dev: [],
		uat: [{ cls: "gf-icon-achievement-shareback-noti", short: "achievement-shareback-noti", code: "e910" }],
		prod: [],
	});

	const only = merged[0];
	assert.deepEqual(only.envs, ["uat"]);
	assert.equal(isPartial(only), true);
	assert.equal(codeLabelOf(only), "e910");
});

test("codeLabelOf collapses to one value when every environment agrees", () => {
	const icon = { short: "x", codes: { dev: "e901", uat: "e901", prod: "e901" }, envs: ["dev", "uat", "prod"] };
	assert.equal(codeLabelOf(icon), "e901");
});

test("search puts the exact name above longer names containing it", () => {
	const icons = mergeByName({ uat: parseIconCss(CSS) });
	const hits = searchIcons(icons, "star");

	assert.equal(hits[0].short, "box-star", "exact-ish short name first");
	assert.ok(hits.some((i) => i.short === "box-rising-star"));
});

test("search accepts a pasted class name or a codepoint", () => {
	const icons = mergeByName({ uat: parseIconCss(CSS) });

	assert.equal(searchIcons(icons, ".gf-icon-upload")[0].short, "upload");
	assert.equal(searchIcons(icons, "gf-icon-upload")[0].short, "upload");
	assert.equal(searchIcons(icons, "ea1f")[0].short, "upload");
	assert.equal(searchIcons(icons, "definitely-not-an-icon").length, 0);
});

test("an empty query returns everything untouched", () => {
	const icons = mergeByName({ uat: parseIconCss(CSS) });
	assert.equal(searchIcons(icons, "").length, icons.length);
	assert.equal(searchIcons(icons, "   ").length, icons.length);
});

test("every environment resolves to the same asset path", () => {
	assert.equal(ICON_ENVS.length, 3);
	for (const env of ICON_ENVS) {
		assert.match(iconCssUrl(env), /^https:\/\/.+\/assets\/icons\/go5-icon\/style\.css$/);
	}
	assert.deepEqual(
		ICON_ENVS.map((e) => e.id),
		["dev", "uat", "prod"],
	);
});

test("newSince reports only additions, never removals", () => {
	const known = ["clock", "star", "upload"];

	assert.deepEqual(newSince(["clock", "star", "upload", "wallet"], known), ["wallet"]);
	// `star` is gone, but a removal is not an addition and must not surface here
	assert.deepEqual(newSince(["clock", "upload"], known), []);
	assert.deepEqual(newSince(known, known), []);
});

test("a codepoint shift is not an addition", () => {
	// The same names moved slots; nothing was added, so nothing is new.
	const merged = mergeByName({
		dev: [{ cls: "gf-icon-cx", short: "cx", code: "e901" }],
		uat: [{ cls: "gf-icon-cx", short: "cx", code: "e902" }],
	});

	assert.deepEqual(
		newSince(
			merged.map((i) => i.short),
			["cx"],
		),
		[],
	);
});
