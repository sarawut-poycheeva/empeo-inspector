import { isAllowedOrigin } from "../shared/allowlist.ts";
import { bestMatch, collectSamples } from "../shared/match.ts";
import { matchesScope, shortenUrl } from "../shared/scope.ts";
import { findPrimaryArray, transformJsonText } from "../shared/transform.ts";
import { OFF, PORT, type ChaosRules, type Seen } from "../shared/types.ts";
import * as overlay from "./overlay.ts";

const SKIP_EXTENSION = /\.(js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)(\?|$)/i;
const RULES_TIMEOUT_MS = 1000;
const ACCENT = "#c2610a";

if (isAllowedOrigin(location.href)) {
	install();
}

function install(): void {
	const seen = new Map<string, Seen>();
	let rules: ChaosRules = OFF;
	let ready = false;
	let release: () => void;
	const rulesReady = new Promise<void>((resolve) => {
		release = () => {
			ready = true;
			resolve();
		};
	});
	setTimeout(() => release(), RULES_TIMEOUT_MS);

	window.addEventListener("message", (event) => {
		if (event.source !== window) return;
		const data = event.data as { port?: string; rules?: ChaosRules; inspect?: boolean; applied?: boolean } | null;
		if (data?.port !== PORT) return;

		if (data.rules) {
			rules = data.rules;
			paint();
			release();
		}

		if (typeof data.inspect === "boolean") {
			if (data.inspect) openOverlay();
			else overlay.close();
		}

		if (data.applied) location.reload();
	});

	patchFetch();
	patchXhr();

	function openOverlay(): void {
		if (overlay.isOpen()) return;
		overlay.open({
			match: (tokens) => {
				const candidates = [...seen.values()].map(({ name, samples, rows }) => ({ name, samples, rows }));
				const hit = bestMatch(tokens, candidates);
				return hit ? (seen.get(hit.name) ?? null) : null;
			},
			rowsFor: (scope) => (rules.urlContains === scope ? rules.rowCount : null),
			apply: (scope, rowCount) => {
				window.postMessage({ port: PORT, apply: { urlContains: rowCount === null ? null : scope, rowCount } }, "*");
			},
			close: () => {
				overlay.close();
				window.postMessage({ port: PORT, inspect: false }, "*");
			},
		});
	}

	function activeFor(url: string): boolean {
		return rules.rowCount !== null && matchesScope(url, rules.urlContains);
	}

	function record(url: string, text: string, durationMs: number): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			return;
		}

		const entry: Seen = {
			url,
			name: shortenUrl(url),
			rows: findPrimaryArray(parsed)?.length ?? null,
			durationMs,
			samples: collectSamples(parsed),
		};

		const previous = seen.get(entry.name);
		if (previous && (previous.rows ?? -1) > (entry.rows ?? -1)) return;
		seen.set(entry.name, entry);
	}

	function patchFetch(): void {
		const original = window.fetch;
		window.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
			const started = performance.now();
			const response = await original.apply(this, args);
			const url = response.url || String(args[0]);
			if (SKIP_EXTENSION.test(url)) return response;

			if (!ready) await rulesReady;
			if (!isJsonResponse(response.headers.get("content-type"))) return response;

			const text = await response.clone().text();
			record(url, text, performance.now() - started);
			if (!activeFor(url)) return response;

			const next = transformJsonText(text, rules.rowCount as number);
			if (next === text) return response;

			return new Response(next, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			});
		} as typeof fetch;
	}

	function patchXhr(): void {
		const open = XMLHttpRequest.prototype.open;

		XMLHttpRequest.prototype.open = function (
			this: XMLHttpRequest,
			method: string,
			url: string | URL,
			...rest: unknown[]
		) {
			const href = String(url);
			if (!SKIP_EXTENSION.test(href)) {
				const started = performance.now();
				this.addEventListener("readystatechange", () => {
					if (this.readyState !== XMLHttpRequest.DONE) return;
					if (this.responseType !== "" && this.responseType !== "text") return;

					let text: string;
					try {
						text = this.responseText;
					} catch {
						return;
					}
					if (!text || !isJsonResponse(this.getResponseHeader("content-type"))) return;

					record(href, text, performance.now() - started);
					if (!activeFor(href)) return;

					const next = transformJsonText(text, rules.rowCount as number);
					if (next === text) return;

					Object.defineProperty(this, "responseText", { value: next, configurable: true });
					Object.defineProperty(this, "response", { value: next, configurable: true });
				});
			}
			return (open as (...a: unknown[]) => void).call(this, method, url, ...rest);
		} as typeof XMLHttpRequest.prototype.open;
	}

	function paint(): void {
		const run = () => {
			document.getElementById("empeo-inspector-banner")?.remove();
			if (rules.rowCount === null) return;

			const banner = document.createElement("div");
			banner.id = "empeo-inspector-banner";
			banner.textContent = `CHAOS · ${rules.urlContains} · ${rules.rowCount === 0 ? "ว่าง" : `${rules.rowCount.toLocaleString("en-US")} แถว`}`;
			banner.style.cssText = [
				"position:fixed",
				"inset:0 0 auto 0",
				"z-index:2147483645",
				`background:${ACCENT}`,
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
				`border:3px solid ${ACCENT}`,
				"pointer-events:none",
			].join(";");
			banner.appendChild(frame);

			document.body.appendChild(banner);
		};

		if (document.body) run();
		else document.addEventListener("DOMContentLoaded", run, { once: true });
	}
}

function isJsonResponse(contentType: string | null): boolean {
	return !!contentType && contentType.toLowerCase().includes("json");
}
