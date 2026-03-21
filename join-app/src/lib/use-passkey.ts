"use client";

import { useState, useEffect, useCallback } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

interface PasskeyState {
  hasPasskey: boolean;
  loading: boolean;
  verifying: boolean;
  error: string | null;
}

export function usePasskey() {
  const [state, setState] = useState<PasskeyState>({
    hasPasskey: false,
    loading: true,
    verifying: false,
    error: null,
  });

  // Check if user has registered passkeys
  useEffect(() => {
    fetch("/api/passkey/check")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setState((s) => ({ ...s, hasPasskey: data?.hasPasskey || false, loading: false }));
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  // Register a new passkey (biometric enrollment)
  const register = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, error: null, verifying: true }));
    try {
      // 1. Get registration options from server
      const optionsRes = await fetch("/api/passkey/register");
      if (!optionsRes.ok) throw new Error("Failed to get registration options");
      const options = await optionsRes.json();

      // 2. Trigger browser biometric prompt
      const credential = await startRegistration({ optionsJSON: options });

      // 3. Send credential back to server for verification
      const verifyRes = await fetch("/api/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Registration failed");
      }

      setState((s) => ({ ...s, hasPasskey: true, verifying: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      // User cancelled is not an error
      if (msg.includes("cancelled") || msg.includes("canceled") || msg.includes("NotAllowedError")) {
        setState((s) => ({ ...s, verifying: false, error: null }));
        return false;
      }
      setState((s) => ({ ...s, verifying: false, error: msg }));
      return false;
    }
  }, []);

  // Verify with biometric (for purchase confirmation)
  const verify = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, error: null, verifying: true }));
    try {
      // 1. Get authentication options from server
      const optionsRes = await fetch("/api/passkey/verify");
      if (!optionsRes.ok) {
        const err = await optionsRes.json();
        if (err.needsSetup) {
          setState((s) => ({ ...s, verifying: false, hasPasskey: false }));
          return false;
        }
        throw new Error(err.error || "Failed to get verification options");
      }
      const options = await optionsRes.json();

      // 2. Trigger browser biometric prompt
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. Verify on server
      const verifyRes = await fetch("/api/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        throw new Error(err.error || "Verification failed");
      }

      setState((s) => ({ ...s, verifying: false }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      if (msg.includes("cancelled") || msg.includes("canceled") || msg.includes("NotAllowedError")) {
        setState((s) => ({ ...s, verifying: false, error: null }));
        return false;
      }
      setState((s) => ({ ...s, verifying: false, error: msg }));
      return false;
    }
  }, []);

  // Reset (delete all passkeys so user can re-register)
  const reset = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/passkey/check", { method: "DELETE" });
      if (!res.ok) return false;
      setState((s) => ({ ...s, hasPasskey: false, error: null }));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { ...state, register, verify, reset };
}
