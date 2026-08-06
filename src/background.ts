import { INSPECT_KEY, RULES_KEY } from "./shared/types.ts";

function clearEverything(): void {
	void chrome.storage.local.remove([RULES_KEY, INSPECT_KEY]);
}

chrome.runtime.onStartup.addListener(clearEverything);
chrome.runtime.onInstalled.addListener(clearEverything);
