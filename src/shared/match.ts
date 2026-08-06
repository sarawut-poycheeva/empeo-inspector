const MIN_LENGTH = 2;
const MAX_LENGTH = 80;

export interface Candidate {
	name: string;
	samples: string[];
	rows: number | null;
}

export function normalise(text: string): string {
	return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function collectSamples(value: unknown, limit = 150): string[] {
	const out: string[] = [];
	const seen = new Set<string>();

	const visit = (node: unknown, depth: number) => {
		if (out.length >= limit || depth > 8) return;
		if (typeof node === "string") {
			const text = normalise(node);
			if (text.length < MIN_LENGTH || text.length > MAX_LENGTH || seen.has(text)) return;
			seen.add(text);
			out.push(text);
			return;
		}
		if (Array.isArray(node)) {
			for (const child of node) visit(child, depth + 1);
			return;
		}
		if (node !== null && typeof node === "object") {
			for (const child of Object.values(node)) visit(child, depth + 1);
		}
	};

	visit(value, 0);
	return out;
}

export function scoreMatch(tokens: string[], samples: string[]): number {
	if (tokens.length === 0 || samples.length === 0) return 0;
	const set = new Set(samples);
	let hits = 0;
	for (const token of tokens) if (set.has(token)) hits++;
	return hits;
}

export function bestMatch(tokens: string[], candidates: Candidate[]): Candidate | null {
	let best: Candidate | null = null;
	let bestScore = 0;

	for (const candidate of candidates) {
		const score = scoreMatch(tokens, candidate.samples);
		if (score === 0) continue;
		if (score > bestScore || (score === bestScore && (candidate.rows ?? 0) > (best?.rows ?? 0))) {
			best = candidate;
			bestScore = score;
		}
	}

	return best;
}