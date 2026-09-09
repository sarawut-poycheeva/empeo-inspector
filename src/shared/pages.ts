/**
 * Pages no extension may touch, whatever it was granted.
 *
 * `Scan page` is the only caller today, but this is a fact about Chrome rather
 * than about the redirect lens, and the reason to guard on it is the same for
 * anything that reaches into a tab: Chrome refuses, and the refusal arrives as
 * an opaque error rather than as a "no". Checking first is what lets the popup
 * name the page it is looking at instead of printing a stack trace at someone.
 *
 * Kept as its own module because the list grows — Chrome adds restricted
 * schemes — and because the anchoring is easy to get wrong and worth a test:
 * a URL merely *containing* "chrome://" in a path must still pass.
 */
export const UNSUPPORTED_PAGE =
	/^(chrome|chrome-extension|edge|about|devtools|view-source|file):|^https:\/\/chromewebstore\.google\.com/;
