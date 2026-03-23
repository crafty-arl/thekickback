"use client";

import { useState } from "react";

type TabId = "overview" | "orders" | "bookings" | "sessions" | "requests" | "conversations" | "points";

interface DashboardTabsProps {
  overviewContent: React.ReactNode;
  ordersContent: React.ReactNode;
  bookingsContent: React.ReactNode;
  sessionsContent: React.ReactNode;
  requestsContent: React.ReactNode;
  conversationsContent: React.ReactNode;
  pointsContent: React.ReactNode;
  orderCount?: number;
  bookingCount?: number;
  sessionCount?: number;
  pendingRequestCount?: number;
  conversationCount?: number;
}

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1" },
  { id: "orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { id: "bookings", label: "Bookings", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "sessions", label: "Sessions", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { id: "requests", label: "Requests", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { id: "conversations", label: "AI Chats", icon: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" },
  { id: "points", label: "Points & Perks", icon: "M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" },
];

export function DashboardTabs({
  overviewContent,
  ordersContent,
  bookingsContent,
  sessionsContent,
  requestsContent,
  conversationsContent,
  pointsContent,
  orderCount,
  bookingCount,
  sessionCount,
  pendingRequestCount,
  conversationCount,
}: DashboardTabsProps) {
  const [active, setActive] = useState<TabId>("overview");

  function getBadge(tabId: TabId): number | undefined {
    if (tabId === "orders") return orderCount;
    if (tabId === "bookings") return bookingCount;
    if (tabId === "sessions") return sessionCount;
    if (tabId === "requests") return pendingRequestCount;
    if (tabId === "conversations") return conversationCount;
    return undefined;
  }

  return (
    <>
      {/* Tab bar */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-black/5 bg-white p-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {TABS.map((tab) => {
          const badge = getBadge(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 font-sans text-sm font-medium transition-all ${
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
              {badge !== undefined && badge > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none ${
                    active === tab.id
                      ? "bg-orange-500/30 text-orange-500"
                      : "bg-black/[0.08] text-black/40"
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {active === "overview" && overviewContent}
      {active === "orders" && ordersContent}
      {active === "bookings" && bookingsContent}
      {active === "sessions" && sessionsContent}
      {active === "requests" && requestsContent}
      {active === "conversations" && conversationsContent}
      {active === "points" && pointsContent}
    </>
  );
}
