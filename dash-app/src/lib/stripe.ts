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
    const testKey = process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || null;
    return { key: testKey, testMode: true };
  }

  const key = process.env.STRIPE_SECRET_KEY || null;
  const testMode = key ? (key.startsWith("sk_test_") || key.startsWith("rk_test_")) : false;
  return { key, testMode };
}
