export interface ChaosRules {
	/** null means "leave the real row count alone" */
	rowCount: number | null;
	/** null means every API response on the page */
	urlContains: string | null;
}

export const OFF: ChaosRules = { rowCount: null, urlContains: null };

export const STORAGE_KEY = "chaosRules";

export const MSG = {
	openPopup: "empeo-inspector:open-popup",
} as const;

export interface Seen {
	url: string;
	name: string;
	rows: number | null;
	samples: string[];
}

export interface InspectorApi {
	state(): { rules: ChaosRules; seen: Seen[] };
	pick(): void;
}

declare global {
	interface Window {
		__empeoInspector?: InspectorApi;
	}
}

export const PORT = "empeo-inspector";
