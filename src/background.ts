import { MSG, OFF, STORAGE_KEY, type ChaosRules } from "./shared/types.ts";

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
	if (message?.type !== MSG.getRules) return;
	chrome.storage.session.get(STORAGE_KEY, (stored: Record<string, ChaosRules | undefined>) => {
		sendResponse({ rules: stored[STORAGE_KEY] ?? OFF });
	});
	return true;
});