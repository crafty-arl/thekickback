// ─── Sandbox Mode Detection ──────────────────────────────────────
// sandbox.thekickback.net uses Stripe test keys
// join.thekickback.net uses Stripe live keys

/** Client-side sandbox detection */
export function isSandboxClient(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hostname.startsWith("sandbox.")) return true;
  return document.cookie.includes("kickback_sandbox=true");
}

/** Server-side sandbox detection (from request headers) */
export function isSandboxServer(h: Headers): boolean {
  const host = h.get("host") || h.get("x-forwarded-host") || "";
  return host.startsWith("sandbox.");
}

/** Get the correct Stripe SECRET key based on hostname */
export function getStripeSecretKey(h: Headers): { key: string | null; testMode: boolean } {
  const sandbox = isSandboxServer(h);
  if (sandbox) {
    const key = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || null;
    return { key, testMode: true };
  }
  const key = process.env.STRIPE_SECRET_KEY || null;
  const testMode = key ? key.startsWith("sk_test_") : false;
  return { key, testMode };
}

/** Get the correct Stripe PUBLISHABLE key based on hostname (client-side) */
export function getStripePublishableKey(): string {
  if (typeof window === "undefined") return "";
  if (isSandboxClient()) {
    // Sandbox uses test publishable key
    return process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      || "";
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
}
