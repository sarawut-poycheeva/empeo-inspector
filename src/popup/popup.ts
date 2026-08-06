import { isAllowedOrigin } from "../shared/allowlist.ts";
import { INSPECT_KEY, OFF, RULES_KEY, type ChaosRules } from "../shared/types.ts";

const env = document.getElementById("env") as HTMLElement;
const blocked = document.getElementById("blocked") as HTMLElement;
const panel = document.getElementById("panel") as HTMLElement;
const toggle = document.getElementById("toggle") as HTMLButtonElement;
const activeBlock = document.getElementById("active") as HTMLElement;
const current = document.getElementById("current") as HTMLElement;
const reset = document.getElementById("reset") as HTMLButtonElement;

let tabId: number | undefined;
let inspecting = false;
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
	panel.hidden = false;

	const stored = await chrome.storage.local.get([RULES_KEY, INSPECT_KEY]);
	rules = (stored[RULES_KEY] as ChaosRules) ?? OFF;
	inspecting = stored[INSPECT_KEY] === true;
	paint();
}

function labelFor(url: string): string {
	const host = new URL(url).hostname;
	if (host === "portal.uat.empeo.com") return "uat";
	if (host === "portal.dev.empeo.com") return "dev";
	return "local";
}

function paint(): void {
	toggle.textContent = inspecting ? "ปิดโหมดส่อง" : "เปิดโหมดส่อง";
	toggle.classList.toggle("is-on", inspecting);

	const on = rules.rowCount !== null && rules.urlContains !== null;
	activeBlock.hidden = !on;
	if (on) {
		const amount = rules.rowCount === 0 ? "ว่าง" : `${rules.rowCount?.toLocaleString("en-US")} แถว`;
		current.textContent = `${rules.urlContains} → ${amount}`;
	}
}

toggle.addEventListener("click", () => {
	inspecting = !inspecting;
	paint();
	void chrome.storage.local.set({ [INSPECT_KEY]: inspecting }).then(() => window.close());
});

reset.addEventListener("click", () => {
	rules = OFF;
	paint();
	void chrome.storage.local.set({ [RULES_KEY]: OFF }).then(() => {
		if (tabId) chrome.tabs.reload(tabId);
		window.close();
	});
});
