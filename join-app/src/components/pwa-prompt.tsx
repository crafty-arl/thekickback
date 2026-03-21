"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Install Prompt ─────────────────────────────────────────────
// Shows a custom "Add to Home Screen" banner for eligible browsers

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone) {
      setIsStandalone(true);
      return;
    }

    // Don't show if dismissed recently
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 86400000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a delay so user has time to engage first
      setTimeout(() => setShowPrompt(true), 15000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  }, []);

  if (isStandalone || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-x-0 bottom-0 z-50 px-4"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div
          className="mx-auto max-w-md overflow-hidden rounded-2xl"
          style={{
            backgroundColor: "rgba(20,20,20,0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 -4px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center gap-3 p-4">
            <img src="/logo.png" alt="KickBack" className="h-10 w-10 rounded-xl" />
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[14px] font-semibold text-white">Add to Home Screen</p>
              <p className="font-sans text-[12px] text-white/40 truncate">
                Quick access — no app store needed
              </p>
            </div>
            <button
              onClick={handleInstall}
              className="shrink-0 rounded-xl px-4 py-2 font-sans text-[13px] font-bold text-black"
              style={{ backgroundColor: "#F97316" }}
            >
              Install
            </button>
          </div>
          <button
            onClick={handleDismiss}
            className="w-full border-t py-2.5 font-sans text-[12px] text-white/25 transition hover:text-white/40"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            Not now
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Update Notification ────────────────────────────────────────
// Shows when a new service worker version is available

export function PwaUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);

      // Check for waiting worker (update available)
      if (reg.waiting) {
        setShowUpdate(true);
        return;
      }

      // Listen for new worker
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShowUpdate(true);
          }
        });
      });
    });

    // Detect controller change (new SW activated) → reload
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    setShowUpdate(false);
  }, [registration]);

  if (!showUpdate) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed inset-x-0 top-0 z-50 px-4 pt-[max(12px,env(safe-area-inset-top))]"
      >
        <div
          className="mx-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: "rgba(20,20,20,0.98)",
            border: "1px solid rgba(74,222,128,0.2)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(74,222,128,0.1)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="flex-1 font-sans text-[13px] text-white/70">New version available</p>
          <button
            onClick={handleUpdate}
            className="shrink-0 rounded-lg px-3 py-1.5 font-sans text-[12px] font-bold text-black"
            style={{ backgroundColor: "#4ade80" }}
          >
            Update
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
