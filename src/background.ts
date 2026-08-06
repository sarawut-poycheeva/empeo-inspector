import { MSG, OFF, STORAGE_KEY, type ChaosRules } from "./shared/types.ts";

chrome.runtime.onMessage.addListener((message: { type?: string; rules?: ChaosRules }, _sender, sendResponse) => {
	if (message?.type === MSG.getRules) {
		chrome.storage.session.get(STORAGE_KEY, (stored: Record<string, ChaosRules | undefined>) => {
			sendResponse({ rules: stored[STORAGE_KEY] ?? OFF });
		});
		return true;
	}

	if (message?.type === MSG.setRules && message.rules) {
		void chrome.storage.session.set({ [STORAGE_KEY]: message.rules });
		return;
	}

	if (message?.type === MSG.openPopup) {
		chrome.action.openPopup().catch(() => undefined);
		return;
	}
});