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
	startPick: "empeo-inspector:start-pick",
	openPopup: "empeo-inspector:open-popup",
} as const;

export interface Seen {
	url: string;
	name: string;
	rows: number | null;
	samples: string[];
}

export const PORT = "empeo-inspector";
