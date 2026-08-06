import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { bestMatch, collectSamples, normalise, scoreMatch, type Candidate } from "../src/shared/match.ts";

const praises = {
	data: [
		{ praiseId: 1, title: "Crazong Crazy", description: "Test another praise sort", coin: 0 },
		{ praiseId: 2, title: "Happily After", description: "Test praise sort", coin: 20 },
	],
};

const menu = {
	items: [
		{ menuId: 10, name: "ข้อมูลพนักงาน", url: "/employee" },
		{ menuId: 11, name: "รายชื่อพนักงาน", url: "/employee/list" },
	],
};

test("samples collect readable strings and drop duplicates", () => {
	const samples = collectSamples(praises);
	equal(samples.includes("crazong crazy"), true);
	equal(samples.includes("test another praise sort"), true);
	equal(new Set(samples).size, samples.length);
});

test("samples ignore numbers", () => {
	deepEqual(collectSamples({ total: 42, ok: true }), []);
});

test("samples respect the limit", () => {
	const many = { items: Array.from({ length: 500 }, (_, i) => ({ name: `name ${i}` })) };
	equal(collectSamples(many, 10).length, 10);
});

test("whitespace and case are normalised away", () => {
	equal(normalise("  Crazong   Crazy \n"), "crazong crazy");
});

test("score counts how many rendered strings the payload contains", () => {
	const samples = collectSamples(praises);
	equal(scoreMatch(["crazong crazy", "test praise sort"], samples), 2);
	equal(scoreMatch(["ข้อมูลพนักงาน"], samples), 0);
});

test("picking text from a table finds the request that fed it", () => {
	const candidates: Candidate[] = [
		{ name: "praises/list", samples: collectSamples(praises), rows: 2 },
		{ name: "Component/MenuList", samples: collectSamples(menu), rows: 2 },
	];

	equal(bestMatch(["crazong crazy", "happily after"], candidates)?.name, "praises/list");
	equal(bestMatch(["ข้อมูลพนักงาน", "รายชื่อพนักงาน"], candidates)?.name, "Component/MenuList");
});

test("text that matches nothing returns no candidate", () => {
	const candidates: Candidate[] = [{ name: "praises/list", samples: collectSamples(praises), rows: 2 }];
	equal(bestMatch(["ไม่มีอยู่จริง"], candidates), null);
});

test("on a tie the larger list wins", () => {
	const shared = ["ละไน ใจไว"];
	const candidates: Candidate[] = [
		{ name: "small", samples: shared, rows: 11 },
		{ name: "large", samples: shared, rows: 93 },
	];
	equal(bestMatch(["ละไน ใจไว"], candidates)?.name, "large");
});