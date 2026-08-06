import { isAllowedOrigin } from "../shared/allowlist.ts";
import { OFF, STORAGE_KEY, type ChaosRules, type Seen } from "../shared/types.ts";

const env = document.getElementById("env") as HTMLElement;
const blocked = document.getElementById("blocked") as HTMLElement;
const stale = document.getElementById("stale") as HTMLElement;
const staleReason = document.getElementById("staleReason") as HTMLElement;
const staleReload = document.getElementById("staleReload") as HTMLButtonElement;
const panel = document.getElementById("panel") as HTMLElement;
const pickButton = document.getElementById("pick") as HTMLButtonElement;
const scopeList = document.getElementById("scope") as HTMLElement;
const scopeNote = document.getElementById("scopeNote") as HTMLElement;
const rowsGroup = document.getElementById("rows") as HTMLElement;

let tabId: number | undefined;
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

	env.textContent = labelFor(url);

	const stored = await chrome.storage.session.get(STORAGE_KEY);
	rules = (stored[STORAGE_KEY] as ChaosRules) ?? OFF;

	try {
		const state = await readState(tabId);
		panel.hidden = false;
		paintRows();
		paintScope(state.seen);
	} catch (error) {
		staleReason.textContent = error instanceof Error ? error.message : String(error);
		stale.hidden = false;
	}
}

async function readState(id: number): Promise<{ rules: ChaosRules; seen: Seen[] }> {
	const [result] = await chrome.scripting.executeScript({
		target: { tabId: id },
		world: "MAIN",
		func: () => window.__empeoInspector?.state() ?? null,
	});

	const state = result?.result as { rules: ChaosRules; seen: Seen[] } | null;
	if (!state) throw new Error("ส่วนขยายยังไม่ได้เข้าไปในหน้านี้ — โหลดหน้าใหม่หนึ่งครั้ง");
	return state;
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
		scopeNote.textContent = "ยังไม่เห็น request — โหลดหน้าใหม่แล้วเปิดอีกครั้ง";
		paintScopeSelection();
		return;
	}

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

staleReload.addEventListener("click", () => {
	if (tabId) chrome.tabs.reload(tabId);
	window.close();
});

pickButton.addEventListener("click", () => {
	if (!tabId) return;
	void chrome.scripting
		.executeScript({
			target: { tabId },
			world: "MAIN",
			func: () => window.__empeoInspector?.pick(),
		})
		.then(() => window.close())
		.catch((error: unknown) => {
			staleReason.textContent = error instanceof Error ? error.message : String(error);
			panel.hidden = true;
			stale.hidden = false;
		});
});

scopeList.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest("button");
	if (!button) return;

	const value = button.dataset.scope ?? "";
	rules = { ...rules, urlContains: value === "" ? null : value };
	paintScopeSelection();
	void chrome.storage.session.set({ [STORAGE_KEY]: rules });
});

rowsGroup.addEventListener("click", (event) => {
	const button = (event.target as HTMLElement).closest("button");
	if (!button || !tabId) return;

	const value = button.dataset.count;
	rules = { ...rules, rowCount: value === "off" ? null : Number(value) };
	paintRows();

	void chrome.storage.session.set({ [STORAGE_KEY]: rules }).then(() => {
		chrome.tabs.reload(tabId as number);
		window.close();
	});
});
