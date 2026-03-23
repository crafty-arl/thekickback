"use client";

import { isSandboxClient } from "@/lib/sandbox";
import { useEffect, useState } from "react";

export function SandboxBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isSandboxClient());
  }, []);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center" style={{ paddingTop: "max(2px, env(safe-area-inset-top))" }}>
      <span className="pointer-events-auto px-3 py-0.5 font-mono text-[9px] font-bold tracking-wider text-black" style={{ backgroundColor: "rgba(250,204,21,0.9)" }}>
        SANDBOX
      </span>
    </div>
  );
}
