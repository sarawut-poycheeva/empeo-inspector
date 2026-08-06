type Json = unknown;
type Dict = Record<string, Json>;

const IDENTITY_KEY = /(^|[a-z])(id|no|guid|key|code)$/i;
const TOTAL_KEY = /^(total|totalcount|totalrecords|totalitems|totalrows|count|recordcount|itemcount|rowcount)$/i;
const ID_OFFSET = 1_000_000;

export interface ArrayHit {
	container: Dict | Json[];
	key: string | number;
	length: number;
	depth: number;
}

function isPlainObject(value: Json): value is Dict {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRowArray(value: Json): value is Dict[] {
	return Array.isArray(value) && value.length > 0 && isPlainObject(value[0]);
}

export function findPrimaryArray(root: Json): ArrayHit | null {
	let best: ArrayHit | null = null;

	const consider = (hit: ArrayHit) => {
		if (!best || hit.length > best.length || (hit.length === best.length && hit.depth < best.depth)) {
			best = hit;
		}
	};

	const visit = (node: Json, depth: number) => {
		if (Array.isArray(node)) {
			node.forEach((child, index) => {
				if (isRowArray(child)) consider({ container: node, key: index, length: child.length, depth });
				visit(child, depth + 1);
			});
			return;
		}
		if (!isPlainObject(node)) return;
		for (const [key, child] of Object.entries(node)) {
			if (isRowArray(child)) consider({ container: node, key, length: child.length, depth });
			visit(child, depth + 1);
		}
	};

	visit(root, 0);
	return best;
}

function remapIdentity(row: Dict, copyIndex: number): Dict {
	const copy: Dict = { ...row };
	for (const [key, value] of Object.entries(copy)) {
		if (!IDENTITY_KEY.test(key)) continue;
		if (typeof value === "number") copy[key] = value + copyIndex * ID_OFFSET;
		else if (typeof value === "string") copy[key] = `${value}#${copyIndex}`;
	}
	return copy;
}

function resize(rows: Dict[], count: number): Dict[] {
	if (count <= rows.length) return rows.slice(0, count);
	const out: Dict[] = [];
	for (let i = 0; i < count; i++) {
		const copyIndex = Math.floor(i / rows.length);
		const row = rows[i % rows.length];
		out.push(copyIndex === 0 ? row : remapIdentity(row, copyIndex));
	}
	return out;
}

function syncTotals(root: Json, originalLength: number, count: number): void {
	const visit = (node: Json) => {
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		if (!isPlainObject(node)) return;
		for (const [key, value] of Object.entries(node)) {
			if (typeof value === "number" && TOTAL_KEY.test(key)) {
				if (count === 0) node[key] = 0;
				else if (value === originalLength) node[key] = count;
			}
			visit(value);
		}
	};
	visit(root);
}

export function applyRowCount(root: Json, count: number): Json {
	const wrapper: Dict = { root: structuredClone(root) as Json };

	const hit = findPrimaryArray(wrapper.root);
	if (!hit) return wrapper.root;

	const container = hit.container as Dict;
	const rows = container[hit.key as string] as Dict[];
	const originalLength = rows.length;

	container[hit.key as string] = resize(rows, count);
	syncTotals(wrapper.root, originalLength, count);

	return wrapper.root;
}

export function primaryArrayLength(text: string): number | null {
	try {
		return findPrimaryArray(JSON.parse(text))?.length ?? null;
	} catch {
		return null;
	}
}

export function transformJsonText(text: string, count: number): string {
	let parsed: Json;
	try {
		parsed = JSON.parse(text);
	} catch {
		return text;
	}
	return JSON.stringify(applyRowCount(parsed, count));
}
