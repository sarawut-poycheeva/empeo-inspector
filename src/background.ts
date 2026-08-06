import { MSG } from "./shared/types.ts";

function openSessionStorageToContentScripts(): void {
	chrome.storage.session
		.setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
		.catch(() => undefined);
}

openSessionStorageToContentScripts();
chrome.runtime.onInstalled.addListener(openSessionStorageToContentScripts);
chrome.runtime.onStartup.addListener(openSessionStorageToContentScripts);

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
	if (message?.type === MSG.openPopup) chrome.action.openPopup().catch(() => undefined);
});