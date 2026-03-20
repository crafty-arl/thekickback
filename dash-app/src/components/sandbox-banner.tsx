"use client";

import { useState, useEffect } from "react";

export function SandboxBanner() {
  const [isSandbox, setIsSandbox] = useState(false);

  useEffect(() => {
    setIsSandbox(window.location.hostname.startsWith("sanddash."));
  }, []);

  if (!isSandbox) return null;

  return (
    <div
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 px-4 py-1.5"
      style={{ backgroundColor: "#fbbf24", color: "#000" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="font-sans text-[12px] font-bold tracking-wide">SANDBOX MODE</span>
      <span className="font-sans text-[11px] opacity-70">Test data only — no real charges</span>
      <a
        href="https://dash.thekickback.net"
        className="ml-2 rounded-full bg-black/10 px-2.5 py-0.5 font-sans text-[11px] font-semibold transition hover:bg-black/20"
      >
        Go to Live →
      </a>
    </div>
  );
}
