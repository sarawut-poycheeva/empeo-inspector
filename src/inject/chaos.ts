import { isAllowedOrigin } from "../shared/allowlist.ts";
import { transformJsonText } from "../shared/transform.ts";
import { OFF, PORT, type ChaosRules } from "../shared/types.ts";

const SKIP_EXTENSION = /\.(js|mjs|css|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot)(\?|$)/i;
const RULES_TIMEOUT_MS = 1000;

if (isAllowedOrigin(location.href)) {
	install();
}

function install(): void {
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
		const data = event.data as { port?: string; rules?: ChaosRules } | null;
		if (data?.port !== PORT || !data.rules) return;
		rules = data.rules;
		release();
	});

	const active = () => rules.rowCount !== null;

	const shouldSkip = (url: string) => SKIP_EXTENSION.test(url);

	const announce = (url: string, rows: number | null) => {
		window.postMessage({ port: PORT, seen: { url, rows } }, "*");
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
			announce(url, rowsIn(text));
			if (!active()) return response;

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
			// Registering here — before the caller attaches its own handlers — is what
			// lets the rewrite land ahead of Angular reading the body.
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

					announce(href, rowsIn(text));
					if (!active()) return;

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

function rowsIn(text: string): number | null {
	try {
		const parsed: unknown = JSON.parse(text);
		return findLongest(parsed);
	} catch {
		return null;
	}
}

function findLongest(node: unknown, depth = 0): number | null {
	if (depth > 8 || node === null || typeof node !== "object") return null;
	let best: number | null = null;
	const children = Array.isArray(node) ? node : Object.values(node as Record<string, unknown>);
	if (Array.isArray(node) && node.length > 0 && typeof node[0] === "object" && node[0] !== null) {
		best = node.length;
	}
	for (const child of children) {
		const found = findLongest(child, depth + 1);
		if (found !== null && (best === null || found > best)) best = found;
	}
	return best;
}