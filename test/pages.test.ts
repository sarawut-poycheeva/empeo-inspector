import assert from "node:assert/strict";
import { test } from "node:test";

import { UNSUPPORTED_PAGE } from "../src/shared/pages.ts";

test("browser pages are refused, and real ones are not", () => {
	assert.equal(UNSUPPORTED_PAGE.test("chrome://extensions"), true);
	assert.equal(UNSUPPORTED_PAGE.test("chrome-extension://abc/popup/index.html"), true);
	assert.equal(UNSUPPORTED_PAGE.test("https://chromewebstore.google.com/detail/x"), true);
	assert.equal(UNSUPPORTED_PAGE.test("about:blank"), true);
	assert.equal(UNSUPPORTED_PAGE.test("view-source:https://example.com"), true);

	assert.equal(UNSUPPORTED_PAGE.test("https://portal.uat.empeo.com/employee"), false);
	assert.equal(UNSUPPORTED_PAGE.test("http://localhost:4200/"), false);
});

test("the match is anchored, so a real URL mentioning a scheme still passes", () => {
	// Without the leading anchors a perfectly good page would be refused for
	// having one of these words in its path or query.
	assert.equal(UNSUPPORTED_PAGE.test("https://portal.uat.empeo.com/docs/chrome://extensions"), false);
	assert.equal(UNSUPPORTED_PAGE.test("https://example.com/?next=https://chromewebstore.google.com"), false);
});
