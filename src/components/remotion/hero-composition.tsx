"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";

const MESSAGES = [
  { from: "user" as const, text: "join" },
  {
    from: "venue" as const,
    text: "Welcome to The Rooftop. Quiet right now — 12 people, 3 groups.",
  },
  { from: "venue" as const, text: "You're in. Reply MENU, REQUEST, or ASK." },
  { from: "user" as const, text: "ask is there a booth open?" },
  {
    from: "venue" as const,
    text: "Booth 4 near the window is open. Want me to hold it?",
  },
  { from: "user" as const, text: "hold" },
  { from: "venue" as const, text: "Booth 4 held for 10 min. Head over." },
];

function TypingDots() {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", gap: 4, padding: "8px 16px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.3)",
            opacity: interpolate(
              (frame + i * 4) % 24,
              [0, 12, 24],
              [0.3, 1, 0.3]
            ),
          }}
        />
      ))}
    </div>
  );
}

function ChatBubble({
  msg,
  delay,
}: {
  msg: (typeof MESSAGES)[number];
  delay: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  const isUser = msg.from === "user";

  if (frame < delay) return null;

  // Show typing dots briefly before venue messages
  if (!isUser && frame < delay + 8) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start" }}>
        <TypingDots />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [12, 0])}px) scale(${interpolate(enter, [0, 1], [0.95, 1])})`,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 16px",
          borderRadius: 16,
          ...(isUser
            ? {
                borderBottomRightRadius: 4,
                background: "#F97316",
                color: "#000",
              }
            : {
                borderBottomLeftRadius: 4,
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.85)",
              }),
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

function PulsingDot({ color, delay }: { color: string; delay: number }) {
  const frame = useCurrentFrame();
  const pulse = interpolate((frame + delay) % 60, [0, 30, 60], [1, 1.6, 1]);
  const glowOpacity = interpolate(
    (frame + delay) % 60,
    [0, 30, 60],
    [0.3, 0.7, 0.3]
  );

  return (
    <div
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        transform: `scale(${pulse})`,
        boxShadow: `0 0 ${12 * glowOpacity}px ${color}`,
      }}
    />
  );
}

function OccupancyBar() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fillWidth = spring({
    frame: frame - 30,
    fps,
    config: { damping: 25, stiffness: 80 },
    from: 0,
    to: 38,
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          fontSize: 10,
          letterSpacing: 2,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        <span>OCCUPANCY</span>
        <span>{Math.round(fillWidth)}%</span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fillWidth}%`,
            borderRadius: 2,
            background:
              "linear-gradient(90deg, #4ade80, #F97316)",
          }}
        />
      </div>
    </div>
  );
}

export function HeroComposition() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Stagger message appearances
  const messageDelays = [10, 35, 55, 80, 105, 130, 150];

  // Overall fade for the thread card
  const cardEnter = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  // Subtle parallax on the whole composition
  const drift = interpolate(
    frame,
    [0, durationInFrames],
    [0, -20],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial gradient bg */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(249,115,22,0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(74,222,128,0.04) 0%, transparent 50%)",
        }}
      />

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: 32,
          transform: `translateY(${drift}px)`,
        }}
      >
        {/* Header row */}
        <Sequence from={0} durationInFrames={durationInFrames}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              opacity: interpolate(frame, [0, 15], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <PulsingDot color="#F97316" delay={0} />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 2.2,
                  color: "rgba(255,255,255,0.45)",
                  fontWeight: 500,
                }}
              >
                LIVE THREAD
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                letterSpacing: 2,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              THE ROOFTOP
            </span>
          </div>
        </Sequence>

        {/* Chat area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 20,
            opacity: cardEnter,
            overflowY: "hidden",
          }}
        >
          {MESSAGES.map((msg, i) => (
            <ChatBubble key={i} msg={msg} delay={messageDelays[i]} />
          ))}
        </div>

        {/* Occupancy bar at bottom */}
        <Sequence from={20} durationInFrames={durationInFrames - 20}>
          <div style={{ marginTop: 16 }}>
            <OccupancyBar />
          </div>
        </Sequence>

        {/* Input bar */}
        <Sequence from={5} durationInFrames={durationInFrames - 5}>
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.04)",
              opacity: interpolate(frame, [5, 15], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 14,
                color: "rgba(255,255,255,0.2)",
              }}
            >
              Send a message...
            </span>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#F97316",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#000"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
          </div>
        </Sequence>
      </div>
    </AbsoluteFill>
  );
}
