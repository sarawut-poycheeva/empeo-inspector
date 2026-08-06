export interface ChaosRules {
	/** null means "leave the real row count alone" */
	rowCount: number | null;
	/** null means every API response on the page */
	urlContains: string | null;
}

export const OFF: ChaosRules = { rowCount: null, urlContains: null };

export interface Seen {
	url: string;
	name: string;
	rows: number | null;
	samples: string[];
}

export const RULES_KEY = "chaosRules";

export function seenKey(origin: string): string {
	return `seen:${origin}`;
}

export function pickKey(origin: string): string {
	return `pick:${origin}`;
}

export const MSG = {
	openPopup: "empeo-inspector:open-popup",
} as const;

export const PORT = "empeo-inspector";