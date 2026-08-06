import { isAllowedOrigin } from "../shared/allowlist.ts";
import { MSG, OFF, STORAGE_KEY, type ChaosRules } from "../shared/types.ts";

interface Seen {
	url: string;
	rows: number | null;
}

const env = document.getElementById("env") as HTMLElement;
const blocked = document.getElementById("blocked") as HTMLElement;
const panel = document.getElementById("panel") as HTMLElement;
const rowsGroup = document.getElementById("rows") as HTMLElement;
const seenList = document.getElementById("seen") as HTMLElement;
const reload = document.getElementById("reload") as HTMLButtonElement;

let tabId: number | undefined;

void init();

async function init(): Promise<void> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	tabId = tab?.id;
	const url = tab?.url ?? "";

	if (!tabId || !isAllowedOrigin(url)) {
		env.textContent = "n/a";
		blocked.hidden = false;
		return;
	}

	env.textContent = labelFor(url);
	panel.hidden = false;

	const stored = await chrome.storage.session.get(STORAGE_KEY);
	paintRules((stored[STORAGE_KEY] as ChaosRules) ?? OFF);

	chrome.tabs.sendMessage(tabId, { type: MSG.getRules }, (response?: { seen?: Seen[] }) => {
		if (chrome.runtime.lastError) return;
		paintSeen(response?.seen ?? []);
	});
}

function labelFor(url: string): string {
	const host = new URL(url).hostname;
	if (host === "portal.uat.empeo.com") return "uat";
	if (host === "portal.dev.empeo.com") return "dev";
	return "local";
}

function paintRules(rules: ChaosRules): void {
	const current = rules.rowCount === null ? "off" : String(rules.rowCount);
	for (const button of rowsGroup.querySelectorAll("button")) {
		button.setAttribute("aria-pressed", String(button.dataset.count === current));
	}
}

function paintSeen(seen: Seen[]): void {
	if (seen.length === 0) return;

	const sorted = [...seen].sort((a, b) => (b.rows ?? -1) - (a.rows ?? -1));
	seenList.replaceChildren(
		...sorted.slice(0, 25).map((entry) => {
			const item = document.createElement("li");

			const path = document.createElement("span");
			path.className = "path";
			path.textContent = shorten(entry.url);
			path.title = entry.url;

			const rows = document.createElement("span");
			rows.className = entry.rows === null ? "rows none" : "rows";
			rows.textContent = entry.rows === null ? "—" : entry.rows.toLocaleString("en-US");

			item.append(path, rows);
			return item;
		}),
	);
}

function shorten(url: string): string {
	try {
		const segments = new URL(url).pathname.split("/").filter(Boolean);
		return segments.slice(-2).join("/") || url;
	} catch {
		return url;
	}
}

rowsGroup.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest("button");
	if (!button || !tabId) return;

	const value = button.dataset.count;
	const rules: ChaosRules = { rowCount: value === "off" ? null : Number(value) };

	void chrome.storage.session.set({ [STORAGE_KEY]: rules });
	chrome.tabs.sendMessage(tabId, { type: MSG.setRules, rules }, () => void chrome.runtime.lastError);
	paintRules(rules);
});

reload.addEventListener("click", () => {
	if (tabId) chrome.tabs.reload(tabId);
	window.close();
});