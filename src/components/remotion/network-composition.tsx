"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

/**
 * A visual representation of the KickBack network — nodes pulsing,
 * connections forming, showing the "enter the network" concept.
 */

interface Node {
  x: number;
  y: number;
  label: string;
  color: string;
  delay: number;
}

const NODES: Node[] = [
  { x: 50, y: 50, label: "The Rooftop", color: "#F97316", delay: 0 },
  { x: 20, y: 30, label: "Daily Grind", color: "#4ade80", delay: 8 },
  { x: 80, y: 25, label: "Study Loft", color: "#facc15", delay: 16 },
  { x: 30, y: 75, label: "North House", color: "#F97316", delay: 24 },
  { x: 75, y: 70, label: "Late Shift", color: "#a78bfa", delay: 32 },
  { x: 50, y: 15, label: "The Loft", color: "#4ade80", delay: 40 },
  { x: 15, y: 55, label: "West End", color: "#facc15", delay: 48 },
  { x: 85, y: 48, label: "The Yard", color: "#F97316", delay: 56 },
];

const CONNECTIONS = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [1, 5],
  [1, 6],
  [2, 7],
  [3, 6],
  [4, 7],
  [5, 2],
];

export function NetworkComposition() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        overflow: "hidden",
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.05) 0%, transparent 70%)",
        }}
      />

      {/* Connection lines */}
      <svg
        style={{ position: "absolute", inset: 0 }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {CONNECTIONS.map(([fromIdx, toIdx], i) => {
          const from = NODES[fromIdx];
          const to = NODES[toIdx];
          const delay = Math.max(from.delay, to.delay) + 10;

          const lineProgress = interpolate(
            frame - delay,
            [0, 20],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          if (lineProgress <= 0) return null;

          // Animated endpoint
          const currentX = from.x + (to.x - from.x) * lineProgress;
          const currentY = from.y + (to.y - from.y) * lineProgress;

          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={currentX}
              y2={currentY}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.3"
            />
          );
        })}
      </svg>

      {/* Nodes */}
      {NODES.map((node, i) => {
        const enter = spring({
          frame: frame - node.delay,
          fps,
          config: { damping: 14, stiffness: 100 },
        });

        const pulse = interpolate(
          (frame + i * 20) % 80,
          [0, 40, 80],
          [1, 1.3, 1]
        );

        if (frame < node.delay) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: `translate(-50%, -50%) scale(${enter})`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            {/* Glow ring */}
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: `1.5px solid ${node.color}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 ${16 * (pulse - 0.5)}px ${node.color}40`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: node.color,
                  transform: `scale(${pulse})`,
                }}
              />
            </div>
            {/* Label */}
            <span
              style={{
                fontSize: 9,
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                color: "rgba(255,255,255,0.4)",
                letterSpacing: 1,
                whiteSpace: "nowrap",
              }}
            >
              {node.label}
            </span>
          </div>
        );
      })}

      {/* Center text */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [60, 80], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: 3,
            color: "rgba(255,255,255,0.25)",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontWeight: 500,
          }}
        >
          THE NETWORK IS LIVE
        </span>
      </div>
    </AbsoluteFill>
  );
}
