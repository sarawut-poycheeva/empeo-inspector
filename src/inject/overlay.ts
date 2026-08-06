import { normalise } from "../shared/match.ts";
import type { Seen } from "../shared/types.ts";

const ACCENT = "#c2610a";
const MIN_TOKENS = 2;
const MAX_TOKENS = 60;
const MAX_HOPS = 12;
const SETTLE_MS = 120;

export interface OverlayHooks {
	match(tokens: string[]): Seen | null;
	rowsFor(scope: string): number | null;
	apply(scope: string, rowCount: number | null): void;
	close(): void;
}

const COUNTS = [
	{ label: "ว่าง", value: 0 },
	{ label: "100", value: 100 },
	{ label: "1000", value: 1000 },
];

let teardown: (() => void) | null = null;

export function isOpen(): boolean {
	return teardown !== null;
}

export function open(hooks: OverlayHooks): void {
	if (teardown || !document.body) return;

	const outline = box(["position:fixed", `outline:2px solid ${ACCENT}`, `background:${ACCENT}14`, "display:none"]);
	const badge = box([
		"position:fixed",
		"z-index:2147483647",
		"background:#14181e",
		"color:#fff",
		"font:500 11.5px/1.5 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
		"border-radius:7px",
		"padding:7px 9px",
		"display:none",
		"pointer-events:auto",
		"box-shadow:0 8px 26px rgba(0,0,0,.45)",
		"max-width:340px",
	]);
	const flag = box([
		"position:fixed",
		"left:12px",
		"bottom:12px",
		"z-index:2147483647",
		`background:${ACCENT}`,
		"color:#fff",
		"font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
		"letter-spacing:.06em",
		"border-radius:5px",
		"padding:6px 10px",
	]);
	flag.textContent = "โหมดส่อง · ESC เพื่อปิด";

	document.body.append(outline, badge, flag);

	let subject: Element | null = null;
	let locked = false;
	let settle: ReturnType<typeof setTimeout> | undefined;

	const onMove = (event: MouseEvent) => {
		if (locked) return;
		const { clientX: x, clientY: y } = event;
		clearTimeout(settle);
		settle = setTimeout(() => update(x, y), SETTLE_MS);
	};

	const update = (x: number, y: number) => {
		const found = subjectAt(x, y);
		if (found === subject) return;
		subject = found;

		if (!found) {
			outline.style.display = "none";
			badge.style.display = "none";
			return;
		}

		const rect = found.getBoundingClientRect();
		Object.assign(outline.style, {
			display: "block",
			top: `${rect.top}px`,
			left: `${rect.left}px`,
			width: `${rect.width}px`,
			height: `${rect.height}px`,
		});

		render(hooks.match(tokensIn(found)), rect);
	};

	const render = (hit: Seen | null, rect: DOMRect) => {
		badge.replaceChildren();

		if (!hit) {
			badge.append(line("ไม่รู้ว่าข้อมูลนี้มาจาก API ไหน", "#9aa4b1"));
			badge.append(line("ลองชี้ที่แถวในตารางหรือรายการ", "#6f7987"));
		} else {
			const facts = [hit.name];
			if (hit.rows !== null) facts.push(`${hit.rows.toLocaleString("en-US")} แถว`);
			if (hit.durationMs !== null) facts.push(`${Math.round(hit.durationMs)} ms`);
			badge.append(line(facts.join(" · "), "#fff"));

			const row = box(["display:flex", "gap:5px", "margin-top:6px", "flex-wrap:wrap"]);
			const applied = hooks.rowsFor(hit.name);

			for (const count of COUNTS) {
				row.append(
					action(count.label, applied === count.value, () => {
						hooks.apply(hit.name, count.value);
					}),
				);
			}
			if (applied !== null) {
				row.append(
					action("คืนค่า", false, () => {
						hooks.apply(hit.name, null);
					}),
				);
			}
			badge.append(row);
		}

		badge.style.display = "block";
		badge.style.visibility = "hidden";
		requestAnimationFrame(() => {
			const height = badge.offsetHeight;
			const top = rect.top - height - 8 < 8 ? rect.bottom + 8 : rect.top - height - 8;
			badge.style.top = `${Math.max(8, top)}px`;
			badge.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - badge.offsetWidth - 8))}px`;
			badge.style.visibility = "visible";
		});
	};

	const onKey = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		hooks.close();
	};

	badge.addEventListener("mouseenter", () => {
		locked = true;
	});
	badge.addEventListener("mouseleave", () => {
		locked = false;
	});

	document.addEventListener("mousemove", onMove, true);
	document.addEventListener("keydown", onKey, true);

	teardown = () => {
		clearTimeout(settle);
		document.removeEventListener("mousemove", onMove, true);
		document.removeEventListener("keydown", onKey, true);
		outline.remove();
		badge.remove();
		flag.remove();
		teardown = null;
	};
}

export function close(): void {
	teardown?.();
}

function action(label: string, on: boolean, run: () => void): HTMLElement {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	button.style.cssText = [
		"pointer-events:auto",
		"font:600 11px/1 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
		"padding:5px 9px",
		"border-radius:5px",
		"cursor:pointer",
		on ? `background:${ACCENT}` : "background:#242a33",
		on ? "border:1px solid transparent" : "border:1px solid #333b46",
		"color:#fff",
	].join(";");
	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopImmediatePropagation();
		run();
	});
	return button;
}

function line(text: string, color: string): HTMLElement {
	const node = box([`color:${color}`, "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"]);
	node.textContent = text;
	return node;
}

function box(styles: string[]): HTMLElement {
	const node = document.createElement("div");
	node.style.cssText = ["pointer-events:none", "z-index:2147483646", ...styles].join(";");
	return node;
}

function subjectAt(x: number, y: number): Element | null {
	let node = document.elementFromPoint(x, y);
	let hops = 0;
	while (node && node !== document.body && hops < MAX_HOPS) {
		if (tokensIn(node).length >= MIN_TOKENS) return node;
		node = node.parentElement;
		hops++;
	}
	return null;
}

export function tokensIn(root: Element): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	let node = walker.nextNode();
	while (node && out.length < MAX_TOKENS) {
		const text = normalise(node.nodeValue ?? "");
		if (text.length >= 2 && text.length <= 80 && !seen.has(text)) {
			seen.add(text);
			out.push(text);
		}
		node = walker.nextNode();
	}
	return out;
}
