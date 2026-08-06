import { deepEqual, equal, notEqual } from "node:assert/strict";
import { test } from "node:test";

import { applyRowCount, findPrimaryArray, transformJsonText } from "../src/shared/transform.ts";

const employees = (n: number) =>
	Array.from({ length: n }, (_, i) => ({ employeeId: 100 + i, name: `พนักงาน ${i}`, employeeNo: `EMP-${i}` }));

test("picks the longest array of objects, not the first one found", () => {
	const payload = {
		data: {
			departments: employees(18),
			items: employees(342),
		},
	};
	const hit = findPrimaryArray(payload);
	equal(hit?.key, "items");
	equal(hit?.length, 342);
});

test("prefers the shallower array when lengths tie", () => {
	const payload = {
		items: employees(5),
		data: { nested: { deeper: employees(5) } },
	};
	equal(findPrimaryArray(payload)?.key, "items");
});

test("ignores arrays of primitives", () => {
	const payload = { tags: ["a", "b", "c", "d"], items: employees(2) };
	equal(findPrimaryArray(payload)?.key, "items");
});

test("count 0 empties the list and zeroes every total", () => {
	const payload = { data: { items: employees(20) }, total: 5842, totalRecords: 5842 };
	const result = applyRowCount(payload, 0) as typeof payload;

	deepEqual(result.data.items, []);
	equal(result.total, 0);
	equal(result.totalRecords, 0);
});

test("a total that matched the row count follows it; a paginated total does not", () => {
	const payload = { items: employees(20), count: 20, total: 5842 };
	const result = applyRowCount(payload, 100) as typeof payload;

	equal(result.count, 100);
	equal(result.total, 5842);
});

test("growing the list repeats rows and keeps identities unique", () => {
	const payload = { items: employees(5) };
	const result = applyRowCount(payload, 100) as typeof payload;

	equal(result.items.length, 100);

	const ids = new Set(result.items.map((row) => row.employeeId));
	const nos = new Set(result.items.map((row) => row.employeeNo));
	equal(ids.size, 100);
	equal(nos.size, 100);
});

test("the first copy keeps the real values", () => {
	const payload = { items: employees(5) };
	const result = applyRowCount(payload, 100) as typeof payload;

	deepEqual(result.items.slice(0, 5), employees(5));
});

test("non-identity fields are never rewritten", () => {
	const payload = { items: employees(2) };
	const result = applyRowCount(payload, 6) as typeof payload;

	equal(result.items[4].name, "พนักงาน 0");
});

test("the input payload is left untouched", () => {
	const payload = { items: employees(5) };
	applyRowCount(payload, 0);
	equal(payload.items.length, 5);
});

test("payloads with no list of objects pass through unchanged", () => {
	const payload = { result: true, message: "ok" };
	deepEqual(applyRowCount(payload, 100), payload);
});

test("text that is not JSON is returned as-is", () => {
	equal(transformJsonText("<!doctype html>", 0), "<!doctype html>");
});

test("transformJsonText round-trips through JSON", () => {
	const text = JSON.stringify({ items: employees(3) });
	const next = transformJsonText(text, 0);

	notEqual(next, text);
	deepEqual(JSON.parse(next), { items: [] });
});