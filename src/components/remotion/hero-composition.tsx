"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

/* ── Venue nodes on the "map" ── */
const VENUES = [
  { x: 52, y: 32, name: "The Rooftop", color: "#f97316", vibe: "Busy", occ: 72 },
  { x: 24, y: 48, name: "Daily Grind", color: "#4ade80", vibe: "Quiet", occ: 18 },
  { x: 78, y: 55, name: "Study Loft", color: "#facc15", vibe: "Moderate", occ: 46 },
  { x: 38, y: 72, name: "North House", color: "#f87171", vibe: "Lit", occ: 88 },
  { x: 68, y: 22, name: "The Yard", color: "#4ade80", vibe: "Quiet", occ: 22 },
];

/* ── Chat flow that mirrors the actual product ── */
const CONCIERGE_FLOW = [
  { from: "guest" as const, text: "Where should I go tonight?" },
  {
    from: "ai" as const,
    text: "Here are a few spots that are live right now:",
    chips: [
      { name: "The Rooftop", color: "#f97316" },
      { name: "North House", color: "#f87171" },
    ],
  },
];

const VENUE_FLOW = [
  { from: "ai" as const, text: "Welcome to The Rooftop. Busy right now — 28 people. What can I help with?" },
  { from: "guest" as const, text: "Any booths open?" },
  { from: "ai" as const, text: "Booth 4 near the window is open. Want me to hold it?" },
  { from: "guest" as const, text: "Yes please" },
  { from: "ai" as const, text: "Done — booth 4 held for 10 min. Head over when ready." },
];

const TABS = ["Chat", "Vibe", "Menu", "Events", "Reserve"];

/* ── Pulsing venue marker ── */
function VenueMarker({
  x, y, color, name, selected, delay,
}: {
  x: number; y: number; color: string; name: string; selected: boolean; delay: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 100 } });
  if (frame < delay) return null;

  const pulse = interpolate((frame + delay) % 75, [0, 37, 75], [1, 1.5, 1]);
  const pulseOpacity = interpolate((frame + delay) % 75, [0, 37, 75], [0.25, 0, 0.25]);
  const selectedScale = selected
    ? interpolate((frame) % 45, [0, 22, 45], [1, 1.8, 1])
    : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) scale(${enter})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
      }}
    >
      {/* Pulse ring */}
      <div
        style={{
          position: "absolute",
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `1.5px solid ${color}`,
          opacity: pulseOpacity,
          transform: `scale(${pulse})`,
        }}
      />
      {selected && (
        <div
          style={{
            position: "absolute",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${color}`,
            opacity: pulseOpacity * 0.6,
            transform: `scale(${selectedScale})`,
          }}
        />
      )}

      {/* Core dot */}
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}60`,
          position: "relative",
          zIndex: 2,
        }}
      />

      {/* Connector ticks */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <div
          key={angle}
          style={{
            position: "absolute",
            width: 1,
            height: 6,
            backgroundColor: `${color}40`,
            transform: `rotate(${angle}deg) translateY(-14px)`,
            transformOrigin: "center center",
          }}
        />
      ))}

      {/* Name label (shows when selected) */}
      {selected && (
        <div
          style={{
            marginTop: 6,
            padding: "2px 8px",
            borderRadius: 6,
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            fontSize: 9,
            color: "rgba(255,255,255,0.7)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            whiteSpace: "nowrap",
            letterSpacing: 0.5,
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

/* ── Loading dots ── */
function LoadingDots({ color }: { color: string }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 4, padding: "6px 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            backgroundColor: color,
            opacity: 0.5,
            transform: `translateY(${interpolate((frame + i * 5) % 18, [0, 9, 18], [0, -4, 0])}px)`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Chat bubble matching actual product style ── */
function ChatBubble({
  msg,
  delay,
  accentColor,
}: {
  msg: (typeof VENUE_FLOW)[number] | (typeof CONCIERGE_FLOW)[number];
  delay: number;
  accentColor: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.7 },
  });

  const isGuest = msg.from === "guest";
  if (frame < delay) return null;

  // Show dots briefly before AI messages
  if (!isGuest && frame < delay + 10) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: 4 }}>
        <LoadingDots color="rgba(255,255,255,0.3)" />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isGuest ? "flex-end" : "flex-start",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [10, 0])}px) scale(${interpolate(enter, [0, 1], [0.96, 1])})`,
        gap: 6,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 14px",
          borderRadius: 14,
          ...(isGuest
            ? {
                borderBottomRightRadius: 4,
                background: accentColor,
                color: "#000",
                boxShadow: `0 2px 12px ${accentColor}30`,
              }
            : {
                borderBottomLeftRadius: 4,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.8)",
              }),
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {msg.text}
      </div>

      {/* Venue chips (for concierge recommendations) */}
      {"chips" in msg && msg.chips && (
        <div style={{ display: "flex", gap: 6, paddingLeft: 4 }}>
          {msg.chips.map((chip) => (
            <div
              key={chip.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                borderRadius: 10,
                backgroundColor: `${chip.color}18`,
                border: `1px solid ${chip.color}30`,
                fontSize: 10,
                fontWeight: 600,
                color: chip.color,
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={chip.color} strokeWidth="2.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {chip.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Glass drawer (mirrors the morphing command bar) ── */
function Drawer({
  expanded,
  expandProgress,
  children,
  accentColor,
  venueName,
  vibeLabel,
  occupancy,
  showTabs,
  activeTab,
}: {
  expanded: boolean;
  expandProgress: number;
  children: React.ReactNode;
  accentColor: string;
  venueName: string;
  vibeLabel?: string;
  occupancy?: number;
  showTabs: boolean;
  activeTab: number;
}) {
  const frame = useCurrentFrame();

  const collapsedH = 48;
  const expandedH = 340;
  const height = collapsedH + (expandedH - collapsedH) * expandProgress;
  const borderRadius = interpolate(expandProgress, [0, 1], [28, 20]);
  const bottomRadius = interpolate(expandProgress, [0, 1], [28, 0]);

  const dotPulse = interpolate((frame) % 60, [0, 30, 60], [1, 1.3, 1]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 6,
        left: 8,
        right: 8,
        height,
        borderTopLeftRadius: borderRadius,
        borderTopRightRadius: borderRadius,
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
        background: "rgba(15, 15, 18, 0.85)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.1), 0 -4px 40px rgba(0,0,0,0.3), 0 4px 30px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      }}
    >
      {/* Collapsed bar / Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          height: collapsedH,
          flexShrink: 0,
          gap: 8,
        }}
      >
        {/* Pulsing dot */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: accentColor,
            transform: `scale(${dotPulse})`,
            boxShadow: `0 0 8px ${accentColor}50`,
            flexShrink: 0,
          }}
        />

        {/* Venue name + meta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {venueName}
          </span>
          {expanded && vibeLabel && (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
              {vibeLabel} · {occupancy}%
            </span>
          )}
        </div>

        {/* Input placeholder (when collapsed) */}
        {!expanded && (
          <div
            style={{
              flex: 1,
              marginLeft: 4,
              padding: "6px 12px",
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              fontSize: 12,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            {venueName === "KickBack" ? "Where should I go tonight?" : "Ask anything..."}
          </div>
        )}
      </div>

      {/* Tabs (venue drawer only) */}
      {expanded && showTabs && (
        <div
          style={{
            display: "flex",
            gap: 4,
            padding: "0 12px 8px",
            flexShrink: 0,
          }}
        >
          {TABS.map((tab, i) => {
            const isActive = i === activeTab;
            return (
              <div
                key={tab}
                style={{
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 500,
                  backgroundColor: isActive
                    ? `${accentColor}20`
                    : "rgba(255,255,255,0.04)",
                  color: isActive ? accentColor : "rgba(255,255,255,0.35)",
                  border: `1px solid ${isActive ? `${accentColor}30` : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {tab}
              </div>
            );
          })}
        </div>
      )}

      {/* Chat messages */}
      {expanded && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "0 12px",
            overflowY: "hidden",
          }}
        >
          {children}
        </div>
      )}

      {/* Input bar (expanded) */}
      {expanded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12,
              color: "rgba(255,255,255,0.2)",
            }}
          >
            Ask anything...
          </div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 2px 10px ${accentColor}40`,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Map grid lines (faux grayscale map) ── */
function MapBackground() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* Base */}
      <div style={{ position: "absolute", inset: 0, background: "#1a1a1a" }} />

      {/* Faux road grid */}
      {[20, 40, 60, 80].map((y) => (
        <div
          key={`h-${y}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${y}%`,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
      ))}
      {[25, 50, 75].map((x) => (
        <div
          key={`v-${x}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${x}%`,
            width: 1,
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
      ))}
      {/* Diagonal streets */}
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "15%",
          width: "60%",
          height: 1,
          backgroundColor: "rgba(255,255,255,0.03)",
          transform: "rotate(25deg)",
          transformOrigin: "left center",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "5%",
          top: "30%",
          width: "50%",
          height: 1,
          backgroundColor: "rgba(255,255,255,0.03)",
          transform: "rotate(-15deg)",
          transformOrigin: "right center",
        }}
      />

      {/* Block shapes */}
      {[
        { x: 8, y: 10, w: 12, h: 14 },
        { x: 30, y: 5, w: 16, h: 10 },
        { x: 60, y: 38, w: 10, h: 18 },
        { x: 82, y: 8, w: 8, h: 12 },
        { x: 12, y: 60, w: 14, h: 10 },
        { x: 55, y: 65, w: 18, h: 8 },
      ].map((block, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.w}%`,
            height: `${block.h}%`,
            backgroundColor: "rgba(255,255,255,0.02)",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.02)",
          }}
        />
      ))}
    </div>
  );
}

/* ── Main composition ── */
export function HeroComposition() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  /*
   * Timeline:
   *   0–60:   Map appears, markers animate in, master drawer collapsed
   *  60–80:   Master drawer expands
   *  80–140:  Concierge conversation plays out
   * 140–160:  Transition — master collapses, venue marker selected, venue drawer appears
   * 160–180:  Venue drawer expands with tabs
   * 180–280:  Venue conversation plays out
   * 280–300:  Hold / loop reset
   */

  const phase1End = 60;
  const phase2Start = 60;
  const phase2End = 140;
  const transitionStart = 140;
  const transitionEnd = 160;
  const phase3Start = 160;

  // Which venue is selected (The Rooftop = index 0)
  const selectedVenueIdx = frame >= transitionStart ? 0 : -1;

  // Master drawer
  const showMaster = frame < transitionEnd;
  const masterExpand = showMaster
    ? spring({
        frame: frame - phase2Start,
        fps,
        config: { damping: 25, stiffness: 200 },
      })
    : 0;

  // Venue drawer
  const showVenue = frame >= transitionStart;
  const venueDrawerEnter = showVenue
    ? spring({
        frame: frame - transitionStart,
        fps,
        config: { damping: 22, stiffness: 180 },
      })
    : 0;
  const venueExpand = showVenue
    ? spring({
        frame: frame - phase3Start,
        fps,
        config: { damping: 25, stiffness: 200 },
      })
    : 0;

  // Concierge message delays (relative to phase2Start)
  const conciergeDelays = [70, 95];
  // Venue message delays (relative to phase3Start)
  const venueDelays = [170, 200, 220, 248, 265];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <MapBackground />

      {/* Venue markers */}
      {VENUES.map((v, i) => (
        <VenueMarker
          key={v.name}
          x={v.x}
          y={v.y}
          color={v.color}
          name={v.name}
          selected={i === selectedVenueIdx}
          delay={8 + i * 8}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 3,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          theKickBack
        </div>
      </div>

      {/* Master Drawer (concierge) */}
      {showMaster && (
        <div style={{ opacity: frame >= transitionStart ? interpolate(frame, [transitionStart, transitionStart + 10], [1, 0], { extrapolateRight: "clamp" }) : 1 }}>
          <Drawer
            expanded={masterExpand > 0.5}
            expandProgress={masterExpand}
            accentColor="#a78bfa"
            venueName="KickBack"
            showTabs={false}
            activeTab={0}
          >
            {CONCIERGE_FLOW.map((msg, i) => (
              <ChatBubble
                key={i}
                msg={msg}
                delay={conciergeDelays[i]}
                accentColor="#a78bfa"
              />
            ))}
          </Drawer>
        </div>
      )}

      {/* Venue Drawer (The Rooftop) */}
      {showVenue && (
        <div style={{ opacity: venueDrawerEnter }}>
          <Drawer
            expanded={venueExpand > 0.5}
            expandProgress={venueExpand}
            accentColor="#f97316"
            venueName="The Rooftop"
            vibeLabel="Busy"
            occupancy={72}
            showTabs={true}
            activeTab={0}
          >
            {VENUE_FLOW.map((msg, i) => (
              <ChatBubble
                key={i}
                msg={msg}
                delay={venueDelays[i]}
                accentColor="#f97316"
              />
            ))}
          </Drawer>
        </div>
      )}
    </AbsoluteFill>
  );
}
