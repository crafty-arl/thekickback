"use client";

import { StatsCard, BookingsCard, GuestsCard, RevenueCard, ActionConfirmCard, SettingsLinkCard } from "./owner-cards";

interface OwnerMessageBodyProps {
  body: string;
  onApproveBooking?: (id: string) => void;
  onDeclineBooking?: (id: string) => void;
}

export function OwnerMessageBody({ body, onApproveBooking, onDeclineBooking }: OwnerMessageBodyProps) {
  // Split on [[TAG:...]] patterns
  const parts = body.split(/(\[\[[A-Z_]+:[\s\S]*?\]\])/g);

  return (
    <div className="flex flex-col gap-2">
      {parts.map((part, i) => {
        // Try to match each tag type
        const statsMatch = part.match(/^\[\[STATS:([\s\S]*?)\]\]$/);
        if (statsMatch) {
          try {
            const data = JSON.parse(statsMatch[1]);
            return <StatsCard key={i} {...data} />;
          } catch { return null; }
        }

        const bookingsMatch = part.match(/^\[\[BOOKINGS:([\s\S]*?)\]\]$/);
        if (bookingsMatch) {
          try {
            const data = JSON.parse(bookingsMatch[1]);
            return <BookingsCard key={i} bookings={data} onApprove={onApproveBooking} onDecline={onDeclineBooking} />;
          } catch { return null; }
        }

        const guestsMatch = part.match(/^\[\[GUESTS:([\s\S]*?)\]\]$/);
        if (guestsMatch) {
          try {
            const data = JSON.parse(guestsMatch[1]);
            return <GuestsCard key={i} guests={data} />;
          } catch { return null; }
        }

        const revenueMatch = part.match(/^\[\[REVENUE:([\s\S]*?)\]\]$/);
        if (revenueMatch) {
          try {
            const data = JSON.parse(revenueMatch[1]);
            return <RevenueCard key={i} {...data} />;
          } catch { return null; }
        }

        const actionMatch = part.match(/^\[\[ACTION_CONFIRM:([\s\S]*?)\]\]$/);
        if (actionMatch) {
          try {
            const data = JSON.parse(actionMatch[1]);
            return <ActionConfirmCard key={i} {...data} />;
          } catch { return null; }
        }

        const linkMatch = part.match(/^\[\[LINK:([^\]]+)\]\]$/);
        if (linkMatch) {
          const path = linkMatch[1];
          const section = path.replace("/settings#", "");
          const labels: Record<string, string> = {
            knowledge: "Edit Knowledge Base",
            offerings: "Manage Offerings",
            hours: "Update Hours",
            general: "General Settings",
            xp: "XP Roadmap",
            staff: "Staff",
            gallery: "Gallery",
          };
          return <SettingsLinkCard key={i} section={section} label={labels[section] || "Open Settings"} />;
        }

        // Plain text
        if (part.trim()) {
          return <p key={i} className="font-sans text-[14px] leading-[1.6] text-white/85">{part}</p>;
        }
        return null;
      })}
    </div>
  );
}
