export interface ChaosRules {
	/** null means "leave the real row count alone" */
	rowCount: number | null;
	/** null means every API response on the page */
	urlContains: string | null;
}

export const OFF: ChaosRules = { rowCount: null, urlContains: null };

export const STORAGE_KEY = "chaosRules";

export const MSG = {
	getRules: "empeo-inspector:get-rules",
	setRules: "empeo-inspector:set-rules",
} as const;

export const PORT = "empeo-inspector";
