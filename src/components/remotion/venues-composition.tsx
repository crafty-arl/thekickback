"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

const VENUES = [
  {
    name: "Daily Grind",
    status: "quiet",
    people: 8,
    vibe: "Good for focus",
    color: "#4ade80",
  },
  {
    name: "The Rooftop",
    status: "busy",
    people: 28,
    vibe: "Booth 4 held for you",
    color: "#F97316",
  },
  {
    name: "Study Loft",
    status: "moderate",
    people: 14,
    vibe: "2 groups",
    color: "#facc15",
  },
  {
    name: "North House",
    status: "members",
    people: 22,
    vibe: "Members only tonight",
    color: "rgba(255,255,255,0.4)",
  },
  {
    name: "Late Shift",
    status: "closed",
    people: 0,
    vibe: "Opening at 8 PM",
    color: "rgba(255,255,255,0.15)",
  },
];

function VenueRow({
  venue,
  index,
}: {
  venue: (typeof VENUES)[number];
  index: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = 10 + index * 12;

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.7 },
  });

  // Pulse for active venues
  const pulse = venue.status !== "closed"
    ? interpolate(
        (frame + index * 15) % 90,
        [0, 45, 90],
        [0.6, 1, 0.6]
      )
    : 0.3;

  if (frame < delay) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
        opacity: enter,
        transform: `translateX(${interpolate(enter, [0, 1], [-20, 0])}px)`,
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: venue.color,
          boxShadow: `0 0 ${8 * pulse}px ${venue.color}`,
          flexShrink: 0,
        }}
      />

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          {venue.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            marginTop: 2,
          }}
        >
          {venue.status !== "closed" ? `${venue.people} people` : ""}{" "}
          {venue.status !== "closed" ? "·" : ""} {venue.vibe}
        </div>
      </div>

      {/* Command hint */}
      <div
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          color: "rgba(255,255,255,0.3)",
          padding: "4px 10px",
          borderRadius: 8,
          backgroundColor: "rgba(255,255,255,0.04)",
        }}
      >
        {venue.status === "closed" ? "notify" : "status"}
      </div>
    </div>
  );
}

export function VenuesComposition() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const headerEnter = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Counter animation
  const count = Math.round(
    interpolate(frame, [15, 50], [0, 5], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: 24,
        }}
      >
        {/* Header */}
        <Sequence from={0} durationInFrames={durationInFrames}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: headerEnter,
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.35)",
                fontWeight: 500,
              }}
            >
              ACTIVE THREADS
            </span>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              {count} VENUES
            </span>
          </div>
        </Sequence>

        {/* Venue list */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {VENUES.map((venue, i) => (
            <VenueRow key={venue.name} venue={venue} index={i} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
