/**
 * SSRF safeguard: returns false for localhost and private IPs.
 * Used when validating URLs that will be fetched (e.g. fetch-website proxy).
 */
export function isTargetUrlAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    if (host.endsWith(".local")) return false;
    const parts = host.split(".").map((p) => parseInt(p, 10));
    if (parts.length === 4 && !parts.some((n) => Number.isNaN(n))) {
      if (parts[0] === 10) return false;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
      if (parts[0] === 192 && parts[1] === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}
