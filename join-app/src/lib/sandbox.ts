// ─── Sandbox Mode Detection ──────────────────────────────────────
// sandbox.thekickback.net uses Stripe test keys
// join.thekickback.net uses Stripe live keys
//
// Client-side: check cookie or hostname
// Server-side: check request hostname or env override

/** Client-side sandbox detection */
export function isSandboxClient(): boolean {
  if (typeof window === "undefined") return false;
  // Check hostname
  if (window.location.hostname.startsWith("sandbox.")) return true;
  // Check cookie (set by middleware)
  return document.cookie.includes("kickback_sandbox=true");
}

/** Server-side sandbox detection (from request headers) */
export function isSandboxServer(headers: Headers): boolean {
  const host = headers.get("host") || "";
  return host.startsWith("sandbox.");
}

/** Get the correct Stripe key based on mode */
export function getStripeKey(headers?: Headers): string {
  const sandbox = headers
    ? isSandboxServer(headers)
    : (typeof process !== "undefined" && process.env.KICKBACK_SANDBOX === "true");

  if (sandbox) {
    return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "";
  }
  return process.env.STRIPE_SECRET_KEY || "";
}
