import { MSG, OFF, PORT, STORAGE_KEY, type ChaosRules } from "../shared/types.ts";

push();

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "session" || !changes[STORAGE_KEY]) return;
	send((changes[STORAGE_KEY].newValue as ChaosRules) ?? OFF);
});

window.addEventListener("message", (event) => {
	if (event.source !== window) return;
	const data = event.data as { port?: string; picked?: string } | null;
	if (data?.port !== PORT || typeof data.picked !== "string") return;

	void chrome.storage.session.get(STORAGE_KEY).then((stored) => {
		const current = (stored[STORAGE_KEY] as ChaosRules) ?? OFF;
		void chrome.storage.session.set({ [STORAGE_KEY]: { ...current, urlContains: data.picked as string } });
		chrome.runtime.sendMessage({ type: MSG.openPopup }, () => void chrome.runtime.lastError);
	});
});

function push(): void {
	chrome.storage.session
		.get(STORAGE_KEY)
		.then((stored) => send((stored[STORAGE_KEY] as ChaosRules) ?? OFF))
		.catch(() => send(OFF));
}

function send(rules: ChaosRules): void {
	window.postMessage({ port: PORT, rules }, "*");
}