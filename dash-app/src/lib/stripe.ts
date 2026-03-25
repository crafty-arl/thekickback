import { headers } from "next/headers";

const SANDBOX_HOST = "sanddash.thekickback.net";

/** Check if the current request is coming through the sandbox dashboard */
export async function isSandbox(): Promise<boolean> {
  const h = await headers();
  const host = h.get("host") || h.get("x-forwarded-host") || "";
  return host.startsWith("sanddash.") || host === SANDBOX_HOST;
}

/** Get the appropriate Stripe secret key based on the request hostname */
export async function getStripeKey(): Promise<{ key: string | null; testMode: boolean }> {
  const sandbox = await isSandbox();

  if (sandbox) {
    // Sandbox: prefer test key, fall back to main key
    const testKey = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || null;
    return { key: testKey, testMode: true };
  }

  // Production: use STRIPE_SECRET_KEY but ONLY if it's a live key
  // If only a test key is available, use it but mark as testMode
  const key = process.env.STRIPE_SECRET_KEY || null;
  if (!key) return { key: null, testMode: false };

  const isTestKey = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  if (isTestKey) {
    // On production with a test key: still use it but clearly flag as test mode
    return { key, testMode: true };
  }

  return { key, testMode: false };
}
