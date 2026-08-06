import { bestMatch, normalise, type Candidate } from "../shared/match.ts";

const ACCENT = "#c2610a";
const MIN_TOKENS = 2;
const MAX_TOKENS = 60;
const TOAST_MS = 3200;

let stop: (() => void) | null = null;

export function isPicking(): boolean {
	return stop !== null;
}

export function startPick(candidates: () => Candidate[], onPick: (candidate: Candidate) => void): void {
	if (stop) return;

	const outline = element("div", [
		"position:fixed",
		"z-index:2147483646",
		`border:2px solid ${ACCENT}`,
		`background:${ACCENT}1a`,
		"pointer-events:none",
		"transition:all .06s linear",
		"display:none",
	]);

	const hint = element("div", [
		"position:fixed",
		"left:50%",
		"bottom:24px",
		"transform:translateX(-50%)",
		"z-index:2147483647",
		`background:${ACCENT}`,
		"color:#fff",
		"font:600 12px/1.4 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
		"padding:9px 15px",
		"border-radius:6px",
		"pointer-events:none",
		"box-shadow:0 6px 20px rgba(0,0,0,.3)",
	]);
	hint.textContent = "คลิกที่ตารางหรือรายการที่ต้องการ · กด ESC เพื่อยกเลิก";

	document.body.append(outline, hint);
	const previousCursor = document.body.style.cursor;
	document.body.style.cursor = "crosshair";

	let target: Element | null = null;

	const onMove = (event: MouseEvent) => {
		const found = subjectAt(event.clientX, event.clientY);
		target = found;
		if (!found) {
			outline.style.display = "none";
			return;
		}
		const box = found.getBoundingClientRect();
		Object.assign(outline.style, {
			display: "block",
			top: `${box.top}px`,
			left: `${box.left}px`,
			width: `${box.width}px`,
			height: `${box.height}px`,
		});
	};

	const onClick = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();

		const chosen = target ?? subjectAt(event.clientX, event.clientY);
		const tokens = chosen ? tokensIn(chosen) : [];
		const match = bestMatch(tokens, candidates());

		finish();
		if (match) {
			toast(`เลือก ${match.name} แล้ว`);
			onPick(match);
		} else {
			toast("ไม่พบ API ที่ตรงกับข้อความตรงนี้ — ลองคลิกที่แถวในตาราง");
		}
	};

	const onKey = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		event.preventDefault();
		finish();
	};

	const finish = () => {
		document.removeEventListener("mousemove", onMove, true);
		document.removeEventListener("click", onClick, true);
		document.removeEventListener("keydown", onKey, true);
		outline.remove();
		hint.remove();
		document.body.style.cursor = previousCursor;
		stop = null;
	};

	document.addEventListener("mousemove", onMove, true);
	document.addEventListener("click", onClick, true);
	document.addEventListener("keydown", onKey, true);
	stop = finish;
}

function subjectAt(x: number, y: number): Element | null {
	let node = document.elementFromPoint(x, y);
	while (node && node !== document.body) {
		if (tokensIn(node).length >= MIN_TOKENS) return node;
		node = node.parentElement;
	}
	return null;
}

function tokensIn(root: Element): string[] {
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

function element(tag: string, styles: string[]): HTMLElement {
	const node = document.createElement(tag);
	node.style.cssText = styles.join(";");
	return node;
}

function toast(message: string): void {
	const node = element("div", [
		"position:fixed",
		"left:50%",
		"bottom:24px",
		"transform:translateX(-50%)",
		"z-index:2147483647",
		"background:#1c2027",
		"color:#fff",
		"font:600 12px/1.4 -apple-system,BlinkMacSystemFont,'Noto Sans Thai',sans-serif",
		"padding:10px 16px",
		"border-radius:6px",
		"pointer-events:none",
		"box-shadow:0 6px 20px rgba(0,0,0,.35)",
	]);
	node.textContent = message;
	document.body.append(node);
	setTimeout(() => node.remove(), TOAST_MS);
}