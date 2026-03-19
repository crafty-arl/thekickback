"use client";

import { useState } from "react";

interface DashboardTabsProps {
  overviewContent: React.ReactNode;
  pointsContent: React.ReactNode;
}

const TABS = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" },
  { id: "points", label: "Points & Perks", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
] as const;

export function DashboardTabs({ overviewContent, pointsContent }: DashboardTabsProps) {
  const [active, setActive] = useState<"overview" | "points">("overview");

  return (
    <>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl border border-black/5 bg-white p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-sans text-sm font-medium transition-all ${
              active === tab.id
                ? "bg-black text-white"
                : "text-black/40 hover:bg-black/[0.04] hover:text-black/60"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {active === "overview" && overviewContent}
      {active === "points" && pointsContent}
    </>
  );
}
