import { MSG, OFF, PORT, type ChaosRules } from "../shared/types.ts";

interface Seen {
	url: string;
	rows: number | null;
}

const seen = new Map<string, Seen>();
let rules: ChaosRules = OFF;

chrome.runtime.sendMessage({ type: MSG.getRules }, (response?: { rules?: ChaosRules }) => {
	if (chrome.runtime.lastError) return;
	apply(response?.rules ?? OFF);
});

chrome.runtime.onMessage.addListener((message: { type?: string; rules?: ChaosRules }, _sender, sendResponse) => {
	if (message?.type === MSG.setRules && message.rules) {
		apply(message.rules);
		sendResponse({ ok: true });
		return;
	}
	if (message?.type === MSG.getRules) {
		sendResponse({ rules, seen: [...seen.values()] });
		return;
	}
});

window.addEventListener("message", (event) => {
	if (event.source !== window) return;
	const data = event.data as { port?: string; seen?: Seen } | null;
	if (data?.port !== PORT || !data.seen) return;
	const { url, rows } = data.seen;
	seen.set(url, { url, rows });
});

function apply(next: ChaosRules): void {
	rules = next;
	window.postMessage({ port: PORT, rules: next }, "*");
	paint();
}

function paint(): void {
	const on = rules.rowCount !== null;
	const run = () => {
		document.getElementById("empeo-inspector-banner")?.remove();
		if (!on) return;

		const banner = document.createElement("div");
		banner.id = "empeo-inspector-banner";
		banner.textContent = `CHAOS · ROWS = ${rules.rowCount?.toLocaleString("en-US")}`;
		banner.style.cssText = [
			"position:fixed",
			"inset:0 0 auto 0",
			"z-index:2147483647",
			"background:#c2610a",
			"color:#fff",
			"font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
			"letter-spacing:.08em",
			"padding:6px 12px",
			"pointer-events:none",
			"box-shadow:0 0 0 3px #c2610a inset,0 0 0 100vmax transparent",
		].join(";");

		const frame = document.createElement("div");
		frame.style.cssText = [
			"position:fixed",
			"inset:0",
			"z-index:2147483646",
			"border:3px solid #c2610a",
			"pointer-events:none",
		].join(";");
		banner.appendChild(frame);

		document.body.appendChild(banner);
	};

	if (document.body) run();
	else document.addEventListener("DOMContentLoaded", run, { once: true });
}