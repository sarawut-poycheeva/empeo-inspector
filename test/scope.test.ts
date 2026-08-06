import { equal } from "node:assert/strict";
import { test } from "node:test";

import { matchesScope, shortenUrl } from "../src/shared/scope.ts";

test("no scope means every response", () => {
	equal(matchesScope("https://api.empeo.com/api/praises/list", null), true);
});

test("a scope only matches the request it names", () => {
	const praises = "https://api.empeo.com/api/praises/list";
	const menu = "https://api.empeo.com/api/Component/MenuList";

	equal(matchesScope(praises, "praises/list"), true);
	equal(matchesScope(menu, "praises/list"), false);
});

test("matching ignores case", () => {
	equal(matchesScope("https://api.empeo.com/api/Component/MenuList", "component/menulist"), true);
});

test("the label keeps the last two path segments", () => {
	equal(shortenUrl("https://api.empeo.com/api/v1/notifications?page=1"), "v1/notifications");
	equal(shortenUrl("https://api.empeo.com/api/Component/MenuList"), "Component/MenuList");
});

test("a url with a single segment still produces a label", () => {
	equal(shortenUrl("https://api.empeo.com/health"), "health");
});