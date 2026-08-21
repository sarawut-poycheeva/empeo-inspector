import assert from "node:assert/strict";
import { test } from "node:test";

import {
	activeCount,
	addEntry,
	buildDnrRule,
	deriveName,
	labelOf,
	moduleCandidates,
	nextId,
	normalizePath,
	parsePort,
	rulesFor,
	targetUrl,
	type RedirectEntry,
} from "../src/shared/redirect.ts";

test("normalizePath accepts the substring people mean to type", () => {
	assert.equal(normalizePath("empeo-learn/main.js"), "empeo-learn/main.js");
	assert.equal(normalizePath("  empeo-learn/main.js  "), "empeo-learn/main.js");
	assert.equal(normalizePath("/empeo-learn/main.js"), "empeo-learn/main.js");
});

test("a URL pasted from the Network panel is reduced to the same thing", () => {
	assert.equal(normalizePath("https://apps-uat.gofive.co.th/empeo-learn/main.js"), "empeo-learn/main.js");
	assert.equal(normalizePath("http://localhost:3000/empeo-learn/main.js"), "empeo-learn/main.js");
});

test("the cache buster is stripped, because leaving it pins the rule to one build", () => {
	assert.equal(normalizePath("https://apps-uat.gofive.co.th/empeo-learn/main.js?v=1787129467853"), "empeo-learn/main.js");
	assert.equal(normalizePath("empeo-learn/main.js?v=2026081900"), "empeo-learn/main.js");
	assert.equal(normalizePath("empeo-learn/main.js#frag"), "empeo-learn/main.js");
});

test("nothing usable returns null rather than an entry that matches everything", () => {
	assert.equal(normalizePath(""), null);
	assert.equal(normalizePath("   "), null);
	assert.equal(normalizePath("https://apps-uat.gofive.co.th/"), null);
});

test("parsePort rejects what a port cannot be", () => {
	assert.equal(parsePort("3000"), 3000);
	assert.equal(parsePort(" 4200 "), 4200);
	assert.equal(parsePort("0"), null);
	assert.equal(parsePort("70000"), null);
	assert.equal(parsePort(""), null);
	assert.equal(parsePort("30a0"), null);
});

test("ids only ever go up, so a new rule cannot collide with a live one", () => {
	assert.equal(nextId([]), 1);
	assert.equal(nextId([{ id: 4, path: "a", port: 3000, enabled: true }]), 5);
	// id 3 was deleted; reusing it could collide with a rule still in flight
	assert.equal(
		nextId([
			{ id: 1, path: "a", port: 3000, enabled: true },
			{ id: 7, path: "b", port: 3000, enabled: true },
		]),
		8,
	);
});

test("adding the same path again updates the port instead of racing itself", () => {
	const first = addEntry([], "empeo-learn/main.js", 3000);
	assert.equal(first.length, 1);

	const second = addEntry(first, "empeo-learn/main.js", 4200);
	assert.equal(second.length, 1, "two rules on one path would fight over the request");
	assert.equal(second[0].port, 4200);
	assert.equal(second[0].id, first[0].id, "the live rule id is kept");
});

test("re-adding a disabled path switches it back on", () => {
	const entries: RedirectEntry[] = [{ id: 1, path: "empeo-learn/main.js", port: 3000, enabled: false }];
	assert.equal(addEntry(entries, "empeo-learn/main.js", 3000)[0].enabled, true);
});

test("a rule rewrites only scheme, host and port", () => {
	const rule = buildDnrRule({ id: 2, path: "empeo-learn/main.js", port: 4200, enabled: true });

	assert.deepEqual(rule.action.redirect.transform, { scheme: "http", host: "localhost", port: "4200" });
	assert.equal(rule.condition.urlFilter, "empeo-learn/main.js");
	assert.equal(rule.id, 2, "the rule id is the entry id");
	// no `url`, no `regexSubstitution` — the path must survive untouched
	assert.ok(!("url" in rule.action.redirect));
});

test("global off produces no rules but keeps the list", () => {
	const entries: RedirectEntry[] = [
		{ id: 1, path: "a/main.js", port: 3000, enabled: true },
		{ id: 2, path: "b/main.js", port: 3001, enabled: true },
	];

	assert.equal(rulesFor({ globalEnabled: true, entries }).length, 2);
	assert.equal(rulesFor({ globalEnabled: false, entries }).length, 0);
	assert.equal(entries.length, 2, "the list itself is untouched");
});

test("a disabled or empty entry never becomes a rule", () => {
	const entries: RedirectEntry[] = [
		{ id: 1, path: "a/main.js", port: 3000, enabled: false },
		{ id: 2, path: "", port: 3000, enabled: true },
		{ id: 3, path: "c/main.js", port: 3000, enabled: true },
	];

	const rules = rulesFor({ globalEnabled: true, entries });
	assert.deepEqual(
		rules.map((rule) => rule.id),
		[3],
	);
	assert.equal(activeCount({ globalEnabled: true, entries }), 1);
});

test("targetUrl is where the request really lands", () => {
	assert.equal(targetUrl({ id: 1, path: "empeo-learn/main.js", port: 3000, enabled: true }), "http://localhost:3000/empeo-learn/main.js");
});

test("a name is derived from the module, not the file", () => {
	// every module's bundle is main.js, so the file name identifies nothing
	assert.equal(deriveName("empeo-learn/main.js"), "empeo-learn");
	assert.equal(deriveName("emconnect/main.js"), "emconnect");
	assert.equal(deriveName("empeo-learn/sub/chunk.js"), "empeo-learn");
});

test("a path with no folder falls back to the file without its extension", () => {
	assert.equal(deriveName("main.js"), "main");
	assert.equal(deriveName("polyfills.js"), "polyfills");
});

test("labelOf prefers what was typed, and never returns nothing", () => {
	const base = { id: 1, path: "empeo-learn/main.js", port: 3000, enabled: true };

	assert.equal(labelOf(base), "empeo-learn", "entries stored before naming existed still read");
	assert.equal(labelOf({ ...base, label: "Learn — my branch" }), "Learn — my branch");
	assert.equal(labelOf({ ...base, label: "   " }), "empeo-learn", "blanking the field restores the derived name");
});

test("moduleCandidates keeps federation entry points and drops hashed chunks", () => {
	const loaded = [
		"https://apps-uat.gofive.co.th/empeo-learn/main.js?v=2026082100",
		"https://apps-uat.gofive.co.th/emconnect/main.js",
		"https://apps-uat.gofive.co.th/empeo-learn/polyfills.js",
		"https://apps-uat.gofive.co.th/empeo-learn/764.3f9a1c2b.js", // rebuilt every time
		"https://portal.uat.veniocrm.com/runtime.8d2e.js",
		"https://www.googletagmanager.com/gtag/js?id=G-XYZ",
	];

	assert.deepEqual(moduleCandidates(loaded), [
		"emconnect/main.js",
		"empeo-learn/main.js",
		"empeo-learn/polyfills.js",
	]);
});

test("the same module loaded twice is offered once", () => {
	const paths = moduleCandidates([
		"https://apps-uat.gofive.co.th/empeo-learn/main.js?v=1",
		"https://apps-dev.gofive.co.th/empeo-learn/main.js?v=2",
	]);

	assert.deepEqual(paths, ["empeo-learn/main.js"], "the rule is host-agnostic, so one entry covers both");
});

test("a bare main.js at the root is not offered", () => {
	// It would match every module on every host and point them all at one port.
	assert.deepEqual(moduleCandidates(["https://apps-uat.gofive.co.th/main.js"]), []);
});

test("a versioned remote URL as the app really builds it is recognised", () => {
	// base-micro.ts: baseUrl + module + "/main.js" + "?v=" + YYYYMMDDHH
	assert.deepEqual(moduleCandidates(["https://apps-uat.gofive.co.th/empeo-learn/main.js?v=2026082111"]), [
		"empeo-learn/main.js",
	]);
	// m-okr.component.ts uses Math.random() as the buster
	assert.deepEqual(moduleCandidates(["https://apps-uat.gofive.co.th/okr/main.js?v=0.8231947284"]), ["okr/main.js"]);
});
