"use client";

import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      // Auto-redirect back when connection returns
      window.location.href = "/";
    }
  }, [isOnline]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-black px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>

      <h1 className="mb-2 font-sans text-2xl font-bold text-white">You&apos;re offline</h1>
      <p className="mb-8 max-w-xs font-sans text-[14px] leading-relaxed text-white/40">
        Check your connection. We&apos;ll bring you back as soon as you&apos;re connected.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="rounded-full px-8 py-3 font-sans text-[14px] font-bold text-black transition active:scale-95"
        style={{ backgroundColor: "#F97316" }}
      >
        Try Again
      </button>
    </main>
  );
}
