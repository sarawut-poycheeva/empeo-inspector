import { isAllowedOrigin } from "../shared/allowlist.ts";
import { OFF, RULES_KEY, pickKey, seenKey, type ChaosRules, type Seen } from "../shared/types.ts";

const env = document.getElementById("env") as HTMLElement;
const blocked = document.getElementById("blocked") as HTMLElement;
const panel = document.getElementById("panel") as HTMLElement;
const pickButton = document.getElementById("pick") as HTMLButtonElement;
const scopeList = document.getElementById("scope") as HTMLElement;
const scopeNote = document.getElementById("scopeNote") as HTMLElement;
const rowsGroup = document.getElementById("rows") as HTMLElement;

let tabId: number | undefined;
let origin = "";
let rules: ChaosRules = OFF;

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

	origin = new URL(url).origin;
	env.textContent = labelFor(url);
	panel.hidden = false;

	const stored = await chrome.storage.local.get([RULES_KEY, seenKey(origin)]);
	rules = (stored[RULES_KEY] as ChaosRules) ?? OFF;
	paintRows();
	paintScope((stored[seenKey(origin)] as Seen[]) ?? []);

	chrome.storage.onChanged.addListener((changes) => {
		const next = changes[seenKey(origin)]?.newValue as Seen[] | undefined;
		if (next) paintScope(next);
	});
}

function labelFor(url: string): string {
	const host = new URL(url).hostname;
	if (host === "portal.uat.empeo.com") return "uat";
	if (host === "portal.dev.empeo.com") return "dev";
	return "local";
}

function paintRows(): void {
	const current = rules.rowCount === null ? "off" : String(rules.rowCount);
	for (const button of rowsGroup.querySelectorAll("button")) {
		button.setAttribute("aria-pressed", String(button.dataset.count === current));
	}
}

function paintScopeSelection(): void {
	for (const button of scopeList.querySelectorAll("button")) {
		button.setAttribute("aria-pressed", String((button.dataset.scope ?? "") === (rules.urlContains ?? "")));
	}
}

function paintScope(seen: Seen[]): void {
	if (seen.length === 0) {
		scopeNote.textContent = "ยังไม่เห็น request — โหลดหน้าใหม่หนึ่งครั้ง";
		paintScopeSelection();
		return;
	}

	scopeNote.textContent = "ตัวเลขคือจำนวนแถวที่เจอใน response นั้น";

	const sorted = [...seen].sort((a, b) => (b.rows ?? -1) - (a.rows ?? -1));
	const items = sorted.slice(0, 20).map((entry) => {
		const button = document.createElement("button");
		button.type = "button";
		button.dataset.scope = entry.name;

		const head = document.createElement("span");
		head.className = "head";

		const path = document.createElement("span");
		path.className = "path";
		path.textContent = entry.name;

		const count = document.createElement("span");
		count.className = entry.rows === null ? "rows none" : "rows";
		count.textContent = entry.rows === null ? "—" : entry.rows.toLocaleString("en-US");

		head.append(path, count);
		button.append(head);

		const preview = entry.samples.slice(0, 3).join(" · ");
		if (preview) {
			const sample = document.createElement("span");
			sample.className = "sample";
			sample.textContent = preview;
			button.append(sample);
		}

		const item = document.createElement("li");
		item.append(button);
		return item;
	});

	const all = scopeList.querySelector("li");
	scopeList.replaceChildren(...(all ? [all, ...items] : items));
	paintScopeSelection();
}

pickButton.addEventListener("click", () => {
	void chrome.storage.local.set({ [pickKey(origin)]: Date.now() }).then(() => window.close());
});

scopeList.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest("button");
	if (!button) return;

	const value = button.dataset.scope ?? "";
	rules = { ...rules, urlContains: value === "" ? null : value };
	paintScopeSelection();
	void chrome.storage.local.set({ [RULES_KEY]: rules });
});

rowsGroup.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest("button");
	if (!button || !tabId) return;

	const value = button.dataset.count;
	rules = { ...rules, rowCount: value === "off" ? null : Number(value) };
	paintRows();

	void chrome.storage.local.set({ [RULES_KEY]: rules }).then(() => {
		chrome.tabs.reload(tabId as number);
		window.close();
	});
});
