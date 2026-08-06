import type { Candidate } from "../shared/match.ts";
import { MSG, OFF, PORT, type ChaosRules, type Seen } from "../shared/types.ts";
import { startPick } from "./pick.ts";

declare global {
	interface Window {
		__empeoInspectorBridge?: true;
	}
}

if (!window.__empeoInspectorBridge) {
	window.__empeoInspectorBridge = true;
	start();
}

function start(): void {
	const seen = new Map<string, Seen>();
	let rules: ChaosRules = OFF;

	window.addEventListener("message", (event) => {
		if (event.source !== window) return;
		const data = event.data as { port?: string; seen?: Seen; dump?: Seen[] } | null;
		if (data?.port !== PORT) return;

		for (const entry of data.dump ?? (data.seen ? [data.seen] : [])) {
			const previous = seen.get(entry.name);
			if (previous && (previous.rows ?? -1) > (entry.rows ?? -1)) continue;
			seen.set(entry.name, entry);
		}
	});

	window.postMessage({ port: PORT, want: "dump" }, "*");

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
		if (message?.type === MSG.startPick) {
			sendResponse({ ok: true });
			startPick(candidates, (candidate) => {
				const next: ChaosRules = { ...rules, urlContains: candidate.name };
				apply(next);
				chrome.runtime.sendMessage({ type: MSG.setRules, rules: next }, () => void chrome.runtime.lastError);
				chrome.runtime.sendMessage({ type: MSG.openPopup }, () => void chrome.runtime.lastError);
			});
		}
	});

	function candidates(): Candidate[] {
		return [...seen.values()].map(({ name, samples, rows }) => ({ name, samples, rows }));
	}

	function apply(next: ChaosRules): void {
		rules = next;
		window.postMessage({ port: PORT, rules: next }, "*");
		paint();
	}

	function paint(): void {
		const run = () => {
			document.getElementById("empeo-inspector-banner")?.remove();
			if (rules.rowCount === null) return;

			const banner = document.createElement("div");
			banner.id = "empeo-inspector-banner";
			banner.textContent =
				`CHAOS · ROWS = ${rules.rowCount.toLocaleString("en-US")}` + ` · ${rules.urlContains ?? "ทั้งหน้า"}`;
			banner.style.cssText = [
				"position:fixed",
				"inset:0 0 auto 0",
				"z-index:2147483645",
				"background:#c2610a",
				"color:#fff",
				"font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
				"letter-spacing:.08em",
				"padding:6px 12px",
				"pointer-events:none",
			].join(";");

			const frame = document.createElement("div");
			frame.style.cssText = [
				"position:fixed",
				"inset:0",
				"z-index:2147483644",
				"border:3px solid #c2610a",
				"pointer-events:none",
			].join(";");
			banner.appendChild(frame);

			document.body.appendChild(banner);
		};

		if (document.body) run();
		else document.addEventListener("DOMContentLoaded", run, { once: true });
	}
}