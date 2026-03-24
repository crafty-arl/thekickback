"use client";

interface Offering {
  id: string;
  type: string;
  name: string;
  description: string | null;
  price_cents: number;
  recurring: boolean;
  interval: string | null;
  perks: string[];
  active: boolean;
  image_url?: string | null;
  duration_minutes?: number | null;
  category?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

interface Props {
  offerings: Offering[];
  themeColor: string;
  venueName: string;
  staffByOffering?: Record<string, { id: string; name: string; avatar_url: string | null }[]>;
  onTapOffering?: (offeringId: string) => void;
}

const TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  membership: { icon: "👑", label: "Membership" },
  reservation: { icon: "📅", label: "Reservations" },
  service: { icon: "✂️", label: "Services" },
  product: { icon: "☕", label: "Products" },
  event: { icon: "🎟️", label: "Events" },
  package: { icon: "📦", label: "Packages" },
  custom: { icon: "✦", label: "Other" },
  booth_hold: { icon: "🪑", label: "Booth Holds" },
  space_rental: { icon: "🏠", label: "Space Rentals" },
  event_ticket: { icon: "🎟️", label: "Event Tickets" },
};

function formatPrice(cents: number, recurring?: boolean, interval?: string | null): string {
  if (cents === 0) return "Free";
  const dollars = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  if (recurring) return `$${dollars}/${interval === "year" ? "yr" : "mo"}`;
  return `$${dollars}`;
}

export function VenueOfferings({ offerings, themeColor, venueName, staffByOffering = {}, onTapOffering }: Props) {
  const active = offerings.filter((o) => o.active);
  if (active.length === 0) return null;

  // Group by category first, then by type within uncategorized
  const categorized = new Map<string, Offering[]>();
  const uncategorized: Offering[] = [];

  for (const o of active) {
    if (o.category) {
      const existing = categorized.get(o.category) || [];
      existing.push(o);
      categorized.set(o.category, existing);
    } else {
      uncategorized.push(o);
    }
  }

  // Group uncategorized by type
  const byType = new Map<string, Offering[]>();
  for (const o of uncategorized) {
    const existing = byType.get(o.type) || [];
    existing.push(o);
    byType.set(o.type, existing);
  }

  // Build section list: categories first, then types
  const sections: { label: string; icon: string; items: Offering[] }[] = [];

  for (const [cat, items] of categorized) {
    sections.push({ label: cat, icon: "", items });
  }

  for (const [type, items] of byType) {
    const meta = TYPE_LABELS[type] || { icon: "✦", label: type.charAt(0).toUpperCase() + type.slice(1) };
    sections.push({ label: meta.label, icon: meta.icon, items });
  }

  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.label}>
          {/* Section header */}
          <p className="mb-2.5 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/25 uppercase">
            {section.icon && `${section.icon} `}{section.label}
          </p>

          {/* Items list */}
          <div className="flex flex-col gap-1">
            {section.items.map((o) => {
              const staff = staffByOffering[o.id];
              const isMembership = o.type === "membership";
              const hasImage = !!o.image_url;

              if (isMembership) {
                return (
                  <button
                    key={o.id}
                    onClick={() => onTapOffering?.(o.id)}
                    className="w-full text-left overflow-hidden border active:scale-[0.98] transition"
                    style={{
                      borderColor: `${themeColor}20`,
                      background: `linear-gradient(180deg, ${themeColor}10 0%, ${themeColor}04 100%)`,
                    }}
                  >
                    <div className="px-4 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px]">👑</span>
                          <span className="font-sans text-[14px] font-bold text-white">{o.name}</span>
                        </div>
                        <span className="font-mono text-[13px] font-bold" style={{ color: themeColor }}>
                          {formatPrice(o.price_cents, o.recurring, o.interval)}
                        </span>
                      </div>
                      {o.description && (
                        <p className="mt-1 font-sans text-[12px] leading-relaxed text-white/40">{o.description}</p>
                      )}
                      {o.perks.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {o.perks.slice(0, 4).map((perk) => (
                            <span key={perk} className="flex items-center gap-1.5 font-sans text-[11px] text-white/35">
                              <span className="h-1 w-1 rounded-full" style={{ backgroundColor: themeColor }} />
                              {perk}
                            </span>
                          ))}
                          {o.perks.length > 4 && (
                            <span className="font-sans text-[10px] text-white/20">+{o.perks.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={o.id}
                  onClick={() => onTapOffering?.(o.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.99] transition"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {/* Image or icon */}
                  {hasImage ? (
                    <div className="h-12 w-12 shrink-0 overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                      <img src={o.image_url!} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center" style={{ backgroundColor: `${themeColor}08`, border: `1px solid ${themeColor}15` }}>
                      <span className="text-[16px]">{TYPE_LABELS[o.type]?.icon || "✦"}</span>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[13px] font-semibold text-white/85 truncate">{o.name}</span>
                      {o.duration_minutes && (
                        <span className="shrink-0 font-sans text-[10px] text-white/20">{o.duration_minutes}min</span>
                      )}
                    </div>
                    {o.description && (
                      <p className="mt-0.5 font-sans text-[11px] text-white/30 truncate">{o.description}</p>
                    )}
                    {staff && staff.length > 0 && (
                      <div className="mt-1 flex items-center gap-1">
                        {staff.slice(0, 3).map((s, i) => (
                          <span key={i} className="flex h-4 w-4 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                            {s.avatar_url ? (
                              <img src={s.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[7px] font-bold text-white/50">{s.name.charAt(0)}</span>
                            )}
                          </span>
                        ))}
                        <span className="font-sans text-[9px] text-white/20">
                          {staff.map((s) => s.name.split(" ")[0]).join(", ")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="shrink-0 text-right">
                    <span className="font-mono text-[13px] font-bold" style={{ color: o.price_cents === 0 ? "#4ade80" : themeColor }}>
                      {formatPrice(o.price_cents, o.recurring, o.interval)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
