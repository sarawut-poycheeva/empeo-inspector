export function matchesScope(url: string, urlContains: string | null): boolean {
	if (!urlContains) return true;
	return url.toLowerCase().includes(urlContains.toLowerCase());
}

export function shortenUrl(url: string): string {
	try {
		const segments = new URL(url).pathname.split("/").filter(Boolean);
		return segments.slice(-2).join("/") || url;
	} catch {
		return url;
	}
}
