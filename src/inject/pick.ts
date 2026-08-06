import { bestMatch, normalise, type Candidate } from "../shared/match.ts";

const ACCENT = "#c2610a";
const MIN_TOKENS = 2;
const MAX_TOKENS = 60;
const TOAST_MS = 3600;

let active = false;

export function startPick(candidates: () => Candidate[], onPick: (candidate: Candidate) => void): void {
	if (active || !document.body) return;
	active = true;

	const outline = element("div", [
		"position:fixed",
		"z-index:2147483646",
		`border:2px solid ${ACCENT}`,
		`background:${ACCENT}1a`,
		"pointer-events:none",
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
	let queued = false;
	let pointer = { x: 0, y: 0 };

	const onMove = (event: MouseEvent) => {
		pointer = { x: event.clientX, y: event.clientY };
		if (queued) return;
		queued = true;
		requestAnimationFrame(() => {
			queued = false;
			target = subjectAt(pointer.x, pointer.y);
			if (!target) {
				outline.style.display = "none";
				return;
			}
			const box = target.getBoundingClientRect();
			Object.assign(outline.style, {
				display: "block",
				top: `${box.top}px`,
				left: `${box.left}px`,
				width: `${box.width}px`,
				height: `${box.height}px`,
			});
		});
	};

	const swallow = (event: Event) => {
		event.preventDefault();
		event.stopImmediatePropagation();
	};

	const onClick = (event: MouseEvent) => {
		swallow(event);

		const chosen = target ?? subjectAt(event.clientX, event.clientY);
		const tokens = chosen ? tokensIn(chosen) : [];
		const match = bestMatch(tokens, candidates());

		finish();
		if (match) {
			toast(`เลือก ${match.name} แล้ว`);
			onPick(match);
		} else if (tokens.length === 0) {
			toast("ตรงนี้ไม่มีข้อความให้เทียบ — ลองคลิกที่แถวในตาราง");
		} else {
			toast("ไม่พบ API ที่ตรงกับข้อความตรงนี้ — ข้อมูลอาจโหลดมาก่อนเปิดเครื่องมือ");
		}
	};

	const onKey = (event: KeyboardEvent) => {
		if (event.key !== "Escape") return;
		swallow(event);
		finish();
	};

	const finish = () => {
		document.removeEventListener("mousemove", onMove, true);
		document.removeEventListener("click", onClick, true);
		document.removeEventListener("mousedown", swallow, true);
		document.removeEventListener("pointerdown", swallow, true);
		document.removeEventListener("keydown", onKey, true);
		outline.remove();
		hint.remove();
		document.body.style.cursor = previousCursor;
		active = false;
	};

	document.addEventListener("mousemove", onMove, true);
	document.addEventListener("click", onClick, true);
	document.addEventListener("mousedown", swallow, true);
	document.addEventListener("pointerdown", swallow, true);
	document.addEventListener("keydown", onKey, true);
}

function subjectAt(x: number, y: number): Element | null {
	let node = document.elementFromPoint(x, y);
	let hops = 0;
	while (node && node !== document.body && hops < 12) {
		if (tokensIn(node).length >= MIN_TOKENS) return node;
		node = node.parentElement;
		hops++;
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
		"max-width:80vw",
		"text-align:center",
	]);
	node.textContent = message;
	document.body.append(node);
	setTimeout(() => node.remove(), TOAST_MS);
}