export interface ChaosRules {
	/** null means "leave the real row count alone" */
	rowCount: number | null;
	/** which request the rule applies to; null means no rule */
	urlContains: string | null;
}

export const OFF: ChaosRules = { rowCount: null, urlContains: null };

export interface Seen {
	url: string;
	name: string;
	rows: number | null;
	durationMs: number | null;
	samples: string[];
}

export const RULES_KEY = "chaosRules";
export const INSPECT_KEY = "inspect";

export const PORT = "empeo-inspector";
