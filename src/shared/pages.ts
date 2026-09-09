/**
 * Pages no extension may touch, whatever it was granted.
 *
 * Shared because two unrelated lenses need the same answer — `Scan page` reads
 * the resource list out of a tab, `Screens` injects an overlay into one — and
 * they need it for the same reason: Chrome refuses both on these URLs, and the
 * refusal arrives as an opaque error rather than as a "no". Guarding first is
 * what lets the popup say which page it is looking at instead of printing a
 * stack trace at someone.
 *
 * It lives here rather than beside either caller so that removing one feature
 * cannot take the other's guard with it.
 */
export const UNSUPPORTED_PAGE =
	/^(chrome|chrome-extension|edge|about|devtools|view-source|file):|^https:\/\/chromewebstore\.google\.com/;
