export interface ChaosRules {
	/** null means "leave the real row count alone" */
	rowCount: number | null;
}

export const OFF: ChaosRules = { rowCount: null };

export const STORAGE_KEY = "chaosRules";

export const MSG = {
	getRules: "empeo-inspector:get-rules",
	setRules: "empeo-inspector:set-rules",
} as const;

/** window.postMessage envelope, MAIN world <-> isolated content script */
export const PORT = "empeo-inspector";