import { INSPECT_KEY, OFF, PORT, RULES_KEY, type ChaosRules } from "../shared/types.ts";

void send();

chrome.storage.onChanged.addListener((changes) => {
	if (changes[RULES_KEY] || changes[INSPECT_KEY]) void send();
});

window.addEventListener("message", (event) => {
	if (event.source !== window) return;
	const data = event.data as { port?: string; apply?: ChaosRules; inspect?: boolean } | null;
	if (data?.port !== PORT) return;

	if (data.apply) {
		void chrome.storage.local
			.set({ [RULES_KEY]: data.apply })
			.then(() => window.postMessage({ port: PORT, applied: true }, "*"));
	}

	if (typeof data.inspect === "boolean") {
		void chrome.storage.local.set({ [INSPECT_KEY]: data.inspect });
	}
});

async function send(): Promise<void> {
	try {
		const stored = await chrome.storage.local.get([RULES_KEY, INSPECT_KEY]);
		window.postMessage(
			{
				port: PORT,
				rules: (stored[RULES_KEY] as ChaosRules) ?? OFF,
				inspect: stored[INSPECT_KEY] === true,
			},
			"*",
		);
	} catch {
		window.postMessage({ port: PORT, rules: OFF, inspect: false }, "*");
	}
}
