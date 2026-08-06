import { MSG, OFF, PORT, RULES_KEY, pickKey, seenKey, type ChaosRules, type Seen } from "../shared/types.ts";

const FLUSH_MS = 400;

const origin = location.origin;
const seen = new Map<string, Seen>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

void pushRules();

chrome.storage.onChanged.addListener((changes) => {
	if (changes[RULES_KEY]) sendRules((changes[RULES_KEY].newValue as ChaosRules) ?? OFF);
	if (changes[pickKey(origin)]?.newValue) window.postMessage({ port: PORT, action: "pick" }, "*");
});

window.addEventListener("message", (event) => {
	if (event.source !== window) return;
	const data = event.data as { port?: string; seen?: Seen; picked?: string } | null;
	if (data?.port !== PORT) return;

	if (data.seen) {
		seen.set(data.seen.name, data.seen);
		scheduleFlush();
	}

	if (typeof data.picked === "string") {
		void savePicked(data.picked);
	}
});

async function pushRules(): Promise<void> {
	try {
		const stored = await chrome.storage.local.get(RULES_KEY);
		sendRules((stored[RULES_KEY] as ChaosRules) ?? OFF);
	} catch {
		sendRules(OFF);
	}
}

function sendRules(rules: ChaosRules): void {
	window.postMessage({ port: PORT, rules }, "*");
}

function scheduleFlush(): void {
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = undefined;
		void chrome.storage.local.set({ [seenKey(origin)]: [...seen.values()] }).catch(() => undefined);
	}, FLUSH_MS);
}

async function savePicked(name: string): Promise<void> {
	const stored = await chrome.storage.local.get(RULES_KEY);
	const current = (stored[RULES_KEY] as ChaosRules) ?? OFF;
	await chrome.storage.local.set({ [RULES_KEY]: { ...current, urlContains: name } });
	chrome.runtime.sendMessage({ type: MSG.openPopup }, () => void chrome.runtime.lastError);
}