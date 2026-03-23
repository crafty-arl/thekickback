"use client";

import { useState, useEffect, useCallback } from "react";
import { KBMark } from "@/components/kb-logo";
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
          className="mx-auto max-w-md overflow-hidden "
          style={{
            backgroundColor: "rgba(20,20,20,0.98)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 -4px 30px rgba(0,0,0,0.5)",
          }}
        >
          <div className="flex items-center gap-3 p-4">
            <KBMark size={40} />
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[14px] font-semibold text-white">Add to Home Screen</p>
              <p className="font-sans text-[12px] text-white/40 truncate">
                Quick access — no app store needed
              </p>
            </div>
            <button
              onClick={handleInstall}
              className="shrink-0  px-4 py-2 font-sans text-[13px] font-bold text-black"
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="mx-6 flex max-w-sm flex-col items-center  px-8 py-10 text-center"
          style={{ backgroundColor: "rgba(20,20,20,0.98)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <h2 className="mb-2 font-sans text-[20px] font-bold text-white">Update Available</h2>
          <p className="mb-6 font-sans text-[14px] leading-relaxed text-white/45">
            A new version of theKickBack is ready. Update now for the latest features.
          </p>
          <button
            onClick={handleUpdate}
            className="w-full  py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98]"
            style={{ backgroundColor: "#F97316" }}
          >
            Update Now
          </button>
          <p className="mt-3 font-sans text-[11px] text-white/20">This will refresh the page</p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
