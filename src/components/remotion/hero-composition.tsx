"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

/* ═══════════════════════════════════════════════════
   MINIMALIST APP WALKTHROUGH

   Shows someone using KickBack in 5 clean steps.
   No fluff. Just the product.

   Timeline (1500 frames @ 30fps = 50 seconds):
   ┌─────────────────────────────────────────────────┐
   │   0–120   Fade in: "Find your spot."            │
   │ 120–420   The Map: venues appear as dots         │
   │ 420–720   Tap a Venue: drawer slides up          │
   │ 720–1020  Ask Something: chat interaction         │
   │ 1020–1260 Check In: XP earned                    │
   │ 1260–1500 CTA: "Pull up."                        │
   └─────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════ */

function useLayout() {
  const { width } = useVideoConfig();
  const isWide = width > 700;
  const scale = isWide ? Math.min(width / 1200, 1.4) : Math.min(width / 400, 1.2);
  return { isWide, scale };
}

/* ── Scene wrapper ── */
function Scene({
  children,
  enterFrame,
  holdFrames,
}: {
  children: React.ReactNode;
  enterFrame: number;
  holdFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exitFrame = enterFrame + holdFrames;

  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 20, stiffness: 80 } });
  const exit = frame > exitFrame
    ? interpolate(frame, [exitFrame, exitFrame + 40], [0, 1], { extrapolateRight: "clamp" })
    : 0;

  const opacity = enter * (1 - exit);
  const y = interpolate(enter, [0, 1], [40, 0]) - exit * 30;

  if (frame < enterFrame - 5 || opacity < 0.01) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 24px",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Phone mockup frame ── */
function Phone({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  return (
    <div
      style={{
        width: 280 * scale,
        height: 560 * scale,
        borderRadius: 32 * scale,
        border: `2px solid rgba(255,255,255,0.1)`,
        background: "#0A0A0A",
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100 * scale,
          height: 24 * scale,
          borderRadius: `0 0 ${14 * scale}px ${14 * scale}px`,
          background: "#000",
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
}

/* ── Map dots that appear one by one ── */
function MapScreen() {
  const frame = useCurrentFrame();
  const { isWide, scale: layoutScale } = useLayout();
  const s = isWide ? layoutScale : 1;

  const venues = [
    { x: 30, y: 35, color: "#f97316", delay: 0 },
    { x: 65, y: 25, color: "#4ade80", delay: 5 },
    { x: 45, y: 55, color: "#facc15", delay: 10 },
    { x: 75, y: 60, color: "#f87171", delay: 15 },
    { x: 20, y: 70, color: "#a78bfa", delay: 20 },
    { x: 55, y: 80, color: "#4ade80", delay: 25 },
    { x: 80, y: 40, color: "#f97316", delay: 30 },
  ];

  return (
    <Phone scale={s}>
      {/* Dark map bg */}
      <div style={{ position: "absolute", inset: 0, background: "#111" }}>
        {/* Grid lines */}
        {[20, 40, 60, 80].map((p) => (
          <div key={`h${p}`} style={{ position: "absolute", left: 0, right: 0, top: `${p}%`, height: 1, background: "rgba(255,255,255,0.03)" }} />
        ))}
        {[25, 50, 75].map((p) => (
          <div key={`v${p}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${p}%`, width: 1, background: "rgba(255,255,255,0.03)" }} />
        ))}
      </div>

      {/* Venue dots */}
      {venues.map((v, i) => {
        const dotFrame = frame - 130 - v.delay;
        const dotScale = dotFrame > 0 ? Math.min(dotFrame / 8, 1) : 0;
        const pulse = Math.sin(frame * 0.08 + i) * 0.2 + 1;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${v.x}%`,
              top: `${v.y}%`,
              transform: `translate(-50%, -50%) scale(${dotScale * pulse})`,
              opacity: dotScale,
            }}
          >
            <div style={{ width: 24 * s, height: 24 * s, borderRadius: "50%", background: `${v.color}15`, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />
            <div style={{ width: 10 * s, height: 10 * s, borderRadius: "50%", background: v.color, boxShadow: `0 0 10px ${v.color}60`, position: "relative" }} />
          </div>
        );
      })}

      {/* Bottom bar */}
      <div
        style={{
          position: "absolute",
          bottom: 8 * s,
          left: 12 * s,
          right: 12 * s,
          height: 40 * s,
          borderRadius: 20 * s,
          background: "rgba(15,15,18,0.9)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          padding: `0 ${12 * s}px`,
          gap: 6 * s,
        }}
      >
        <div style={{ width: 6 * s, height: 6 * s, borderRadius: "50%", background: "#a78bfa" }} />
        <span style={{ fontFamily: "system-ui", fontSize: 10 * s, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>KB</span>
        <span style={{ fontFamily: "system-ui", fontSize: 10 * s, color: "rgba(255,255,255,0.2)", marginLeft: 4 }}>Where should I go?</span>
      </div>
    </Phone>
  );
}

/* ── Venue drawer sliding up ── */
function DrawerScreen() {
  const frame = useCurrentFrame();
  const { isWide, scale: layoutScale } = useLayout();
  const s = isWide ? layoutScale : 1;
  const slideUp = interpolate(frame - 430, [0, 20], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dot = Math.sin(frame * 0.1) * 0.2 + 1;

  return (
    <Phone scale={s}>
      <div style={{ position: "absolute", inset: 0, background: "#111" }} />

      {/* Drawer */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: `translateY(${slideUp}%)`,
          borderRadius: `${20 * s}px ${20 * s}px 0 0`,
          background: "rgba(15,15,18,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          padding: `${12 * s}px`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 * s, marginBottom: 8 * s }}>
          <div style={{ width: 7 * s, height: 7 * s, borderRadius: "50%", background: "#f97316", transform: `scale(${dot})`, boxShadow: "0 0 6px #f9731650" }} />
          <div>
            <div style={{ fontFamily: "system-ui", fontSize: 12 * s, fontWeight: 600, color: "#fff" }}>The Rooftop</div>
            <div style={{ fontFamily: "system-ui", fontSize: 9 * s, color: "rgba(255,255,255,0.3)" }}>Busy · 72%</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4 * s, marginBottom: 10 * s }}>
          {["Chat", "Vibe", "Menu", "Events"].map((t, i) => (
            <div
              key={t}
              style={{
                padding: `${3 * s}px ${8 * s}px`,
                borderRadius: 8 * s,
                fontSize: 9 * s,
                fontFamily: "system-ui",
                fontWeight: 500,
                background: i === 0 ? "#f9731620" : "rgba(255,255,255,0.04)",
                color: i === 0 ? "#f97316" : "rgba(255,255,255,0.3)",
                border: `1px solid ${i === 0 ? "#f9731630" : "rgba(255,255,255,0.04)"}`,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* Messages */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 * s }}>
          <div style={{ display: "flex" }}>
            <div style={{ padding: `${5 * s}px ${8 * s}px`, borderRadius: 10 * s, background: "rgba(255,255,255,0.06)", fontSize: 9 * s, fontFamily: "system-ui", color: "rgba(255,255,255,0.7)", maxWidth: "80%" }}>
              Welcome to The Rooftop. Busy tonight — 28 people.
            </div>
          </div>
          {frame > 500 && (
            <div style={{ display: "flex", justifyContent: "flex-end", opacity: interpolate(frame, [500, 510], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) }}>
              <div style={{ padding: `${5 * s}px ${8 * s}px`, borderRadius: 10 * s, background: "#f97316", fontSize: 9 * s, fontFamily: "system-ui", color: "#000", maxWidth: "75%" }}>
                Any booths open?
              </div>
            </div>
          )}
          {frame > 560 && (
            <div style={{ display: "flex", opacity: interpolate(frame, [560, 570], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) }}>
              <div style={{ padding: `${5 * s}px ${8 * s}px`, borderRadius: 10 * s, background: "rgba(255,255,255,0.06)", fontSize: 9 * s, fontFamily: "system-ui", color: "rgba(255,255,255,0.7)", maxWidth: "80%" }}>
                Booth 4 is open by the window. Want me to hold it?
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 * s, marginTop: 10 * s }}>
          <div style={{ flex: 1, padding: `${5 * s}px ${10 * s}px`, borderRadius: 12 * s, background: "rgba(255,255,255,0.04)", fontSize: 9 * s, fontFamily: "system-ui", color: "rgba(255,255,255,0.15)" }}>
            Ask anything...
          </div>
          <div style={{ width: 24 * s, height: 24 * s, borderRadius: "50%", background: "#f97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={10 * s} height={10 * s} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
            </svg>
          </div>
        </div>
      </div>
    </Phone>
  );
}

/* ── Check-in screen with XP ── */
function CheckinScreen() {
  const frame = useCurrentFrame();
  const { isWide, scale: layoutScale } = useLayout();
  const s = isWide ? layoutScale : 1;
  const checkScale = spring({ frame: frame - 1030, fps: 30, config: { damping: 10, stiffness: 150 } });
  const xpCount = Math.min(Math.floor((frame - 1060) * 2), 50);

  return (
    <Phone scale={s}>
      <div style={{ position: "absolute", inset: 0, background: "#0A0A0A", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 * s }}>
        {/* Checkmark */}
        <div
          style={{
            width: 64 * s,
            height: 64 * s,
            borderRadius: "50%",
            background: "#f9731620",
            border: "2px solid #f9731640",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${checkScale})`,
          }}
        >
          <svg width={28 * s} height={28 * s} viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div style={{ marginTop: 16 * s, fontFamily: "system-ui", fontSize: 18 * s, fontWeight: 700, color: "#fff" }}>
          You&apos;re in.
        </div>
        <div style={{ marginTop: 4 * s, fontFamily: "system-ui", fontSize: 12 * s, color: "rgba(255,255,255,0.4)" }}>
          The Rooftop · Table 4
        </div>

        {/* XP */}
        {frame > 1060 && (
          <div
            style={{
              marginTop: 20 * s,
              padding: `${12 * s}px ${20 * s}px`,
              borderRadius: 14 * s,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "system-ui", fontSize: 10 * s, fontWeight: 600, letterSpacing: 1.5, color: "rgba(255,255,255,0.25)" }}>
              XP EARNED
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 28 * s, fontWeight: 700, color: "#f97316", marginTop: 4 * s }}>
              +{Math.max(0, xpCount)}
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 10 * s, height: 6 * s, borderRadius: 3 * s, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min((frame - 1060) * 0.5, 65)}%`,
                  borderRadius: 3 * s,
                  background: "#4ade80",
                  transition: "width 0.1s",
                }}
              />
            </div>
            <div style={{ marginTop: 4 * s, fontFamily: "system-ui", fontSize: 9 * s, color: "rgba(255,255,255,0.2)" }}>
              175 XP to Regular
            </div>
          </div>
        )}
      </div>
    </Phone>
  );
}

/* ═══ MAIN COMPOSITION ═══ */
export function HeroComposition() {
  const { isWide, scale } = useLayout();

  const heading = {
    fontFamily: "var(--font-fraunces), Georgia, serif",
    fontSize: isWide ? 48 * scale : 28,
    fontWeight: 600,
    lineHeight: 1.1,
    letterSpacing: isWide ? -1.5 : -0.5,
    color: "#fff",
    textAlign: "center" as const,
  };

  const body = {
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontSize: isWide ? 16 * scale : 13,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center" as const,
    maxWidth: isWide ? 500 : 300,
  };

  const label = {
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontSize: isWide ? 10 * scale : 9,
    fontWeight: 600,
    letterSpacing: 2.5,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center" as const,
    textTransform: "uppercase" as const,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>

      {/* Scene 1: Find your spot */}
      <Scene enterFrame={10} holdFrames={90}>
        <div style={label}>KICKBACK</div>
        <div style={{ height: isWide ? 16 : 10 }} />
        <div style={heading}>Find your spot.</div>
        <div style={{ height: isWide ? 16 : 10 }} />
        <div style={body}>
          Every venue has an AI. Every vibe has a color.<br />
          Just open the map and pull up.
        </div>
      </Scene>

      {/* Scene 2: The Map */}
      <Scene enterFrame={130} holdFrames={260}>
        <div style={label}>DISCOVER</div>
        <div style={{ height: isWide ? 12 : 8 }} />
        <div style={{ ...heading, fontSize: isWide ? 32 * scale : 22 }}>Every dot is a venue.</div>
        <div style={{ height: isWide ? 16 : 12 }} />
        <MapScreen />
      </Scene>

      {/* Scene 3: Talk to it */}
      <Scene enterFrame={430} holdFrames={260}>
        <div style={label}>TALK TO IT</div>
        <div style={{ height: isWide ? 12 : 8 }} />
        <div style={{ ...heading, fontSize: isWide ? 32 * scale : 22 }}>Ask the venue anything.</div>
        <div style={{ height: isWide ? 16 : 12 }} />
        <DrawerScreen />
      </Scene>

      {/* Scene 4: Check in */}
      <Scene enterFrame={730} holdFrames={260}>
        <div style={label}>CHECK IN</div>
        <div style={{ height: isWide ? 12 : 8 }} />
        <div style={{ ...heading, fontSize: isWide ? 32 * scale : 22 }}>Scan. Earn. Level up.</div>
        <div style={{ height: isWide ? 16 : 12 }} />
        <CheckinScreen />
      </Scene>

      {/* Scene 5: Pull up */}
      <Scene enterFrame={1040} holdFrames={260}>
        <div style={heading}>Pull up.</div>
        <div style={{ height: isWide ? 12 : 10 }} />
        <div style={body}>The kickback is happening.</div>
        <div style={{ height: isWide ? 24 : 16 }} />
        <div
          style={{
            padding: isWide ? "12px 36px" : "10px 28px",
            borderRadius: 50,
            backgroundColor: "#F97316",
            fontSize: isWide ? 14 * scale : 13,
            fontWeight: 600,
            color: "#000",
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
          }}
        >
          Open theKickBack
        </div>
      </Scene>
    </AbsoluteFill>
  );
}
