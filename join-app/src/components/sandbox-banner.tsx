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
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-[max(4px,env(safe-area-inset-top))]"
    >
      <div className="rounded-full px-3 py-1" style={{ backgroundColor: "rgba(249,115,22,0.9)" }}>
        <span className="font-mono text-[10px] font-bold text-black tracking-wider">
          SANDBOX — TEST MODE
        </span>
      </div>
    </div>
  );
}
