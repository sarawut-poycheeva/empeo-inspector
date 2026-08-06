import { isAllowedOrigin } from "../shared/allowlist.ts";
import { collectSamples } from "../shared/match.ts";
import { matchesScope, shortenUrl } from "../shared/scope.ts";
import { findPrimaryArray, transformJsonText } from "../shared/transform.ts";
import { OFF, PORT, type ChaosRules, type Seen } from "../shared/types.ts";

const SKIP_EXTENSION = /\.(js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)(\?|$)/i;
const RULES_TIMEOUT_MS = 1000;

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
		const data = event.data as { port?: string; rules?: ChaosRules; want?: string } | null;
		if (data?.port !== PORT) return;

		if (data.rules) {
			rules = data.rules;
			release();
		}
		if (data.want === "dump") {
			window.postMessage({ port: PORT, dump: [...seen.values()] }, "*");
		}
	});

	const activeFor = (url: string) => rules.rowCount !== null && matchesScope(url, rules.urlContains);

	const shouldSkip = (url: string) => SKIP_EXTENSION.test(url);

	const announce = (url: string, text: string) => {
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
			samples: collectSamples(parsed),
		};

		const previous = seen.get(entry.name);
		if (previous && (previous.rows ?? -1) > (entry.rows ?? -1)) return;

		seen.set(entry.name, entry);
		window.postMessage({ port: PORT, seen: entry }, "*");
	};

	patchFetch();
	patchXhr();

	function patchFetch(): void {
		const original = window.fetch;
		window.fetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
			const response = await original.apply(this, args);
			const url = response.url || String(args[0]);
			if (shouldSkip(url)) return response;

			if (!ready) await rulesReady;
			if (!isJsonResponse(response.headers.get("content-type"))) return response;

			const text = await response.clone().text();
			announce(url, text);
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
			if (!shouldSkip(href)) {
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

					announce(href, text);
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
}

function isJsonResponse(contentType: string | null): boolean {
	return !!contentType && contentType.toLowerCase().includes("json");
}
