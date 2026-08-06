/**
 * empeo lets each tenant configure its own production domain, so a blocklist of
 * known production hosts would always leak. Only these origins are ever touched.
 */
export const ALLOWED_HOSTS = ["localhost", "127.0.0.1", "portal.dev.empeo.com", "portal.uat.empeo.com"];

export function isAllowedOrigin(href: string): boolean {
	try {
		return ALLOWED_HOSTS.includes(new URL(href).hostname);
	} catch {
		return false;
	}
}