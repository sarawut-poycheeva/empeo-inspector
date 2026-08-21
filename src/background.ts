/**
 * Service worker for the redirect lens — the single place that turns stored
 * state into declarativeNetRequest rules.
 *
 * The popup stays deliberately dumb: it writes `chrome.storage.local` and
 * nothing else. Rule logic living in exactly one place is what stops the live
 * rule set from drifting away from what the UI shows, and it is also why a
 * popup that is closed (or crashed mid-edit) cannot leave a stale redirect
 * running.
 */

import { activeCount, REDIRECT_STORAGE_KEYS, rulesFor, type RedirectState } from "./shared/redirect.ts";

async function getState(): Promise<RedirectState> {
	const stored = (await chrome.storage.local.get(REDIRECT_STORAGE_KEYS)) as Partial<RedirectState>;
	return { globalEnabled: stored.globalEnabled !== false, entries: stored.entries ?? [] };
}

/**
 * A forgotten redirect is the expensive failure here: the page is quietly served
 * from a stale local build and the time goes into debugging a ghost. The badge
 * makes an armed rule visible from the toolbar, without opening anything.
 */
async function paintBadge(state: RedirectState): Promise<void> {
	const count = activeCount(state);
	await chrome.action.setBadgeText({ text: count ? String(count) : "" });
	await chrome.action.setBadgeBackgroundColor({ color: "#e04a1e" });

	// Left to itself Chrome picks the text colour from the background's contrast,
	// and on this orange it chooses black. Only the colour is ours to set — the
	// badge's size and font are the browser's, with nothing exposed to change them.
	if (chrome.action.setBadgeTextColor) {
		await chrome.action.setBadgeTextColor({ color: "#ffffff" });
	}
}

/**
 * Rebuild the whole set rather than diffing it. `updateDynamicRules` applies the
 * removals and additions in one atomic call, so there is no window in which a
 * half-applied edit is redirecting traffic.
 */
/**
 * Chrome hands the worker the new code but the old permission set when an
 * unpacked extension is *reloaded* after `permissions` changed — the API object
 * is simply absent, and touching it throws a TypeError that kills the worker
 * before the badge is ever painted. Reading as "the extension is broken" when
 * the real answer is "remove and load unpacked again" costs far more time than
 * the check does.
 */
function dnrAvailable(): boolean {
	if (chrome.declarativeNetRequest) return true;

	console.warn(
		"[Dev Inspectors] declarativeNetRequest is not available. Chrome kept an older permission set — " +
			"remove the extension and Load unpacked again; Reload does not grant new permissions.",
	);
	return false;
}

async function syncRules(): Promise<void> {
	const state = await getState();
	await paintBadge(state); // useful even when the rules cannot be applied

	if (!dnrAvailable()) return;

	const existing = await chrome.declarativeNetRequest.getDynamicRules();

	try {
		await chrome.declarativeNetRequest.updateDynamicRules({
			removeRuleIds: existing.map((rule) => rule.id),
			addRules: rulesFor(state) as unknown as chrome.declarativeNetRequest.Rule[],
		});
	} catch (error) {
		// One invalid urlFilter rejects the entire batch. Storage is untouched, so
		// the offending entry can still be corrected — but the previous rules are
		// gone, and saying so beats silently redirecting nothing.
		console.error("[Dev Inspectors] could not update redirect rules:", error);
	}
}

chrome.runtime.onInstalled.addListener(() => void syncRules());
chrome.runtime.onStartup.addListener(() => void syncRules());

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "local") return;
	if ("entries" in changes || "globalEnabled" in changes) void syncRules();
});
