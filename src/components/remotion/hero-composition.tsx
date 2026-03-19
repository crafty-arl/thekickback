"use client";

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

/* ═══════════════════════════════════════════════════
   PARALLAX LANDING — "You're Invited to the Kickback"

   Responsive composition that adapts to any viewport.
   Uses useVideoConfig() width/height to switch between
   mobile (stacked) and desktop (side-by-side) layouts.

   Timeline (900 frames @ 30fps = 30 seconds):
   ┌─────────────────────────────────────────────────┐
   │  0–120   Intro: "You're invited"                │
   │ 120–240  What is this?: third places             │
   │ 240–390  The Map: discover venues                │
   │ 390–540  The Drawer: talk to venues              │
   │ 540–680  The Tabs: book, meet, greet             │
   │ 680–820  The Network: move through it            │
   │ 820–900  CTA: "Pull up"                          │
   └─────────────────────────────────────────────────┘
   ═══════════════════════════════════════════════════ */

/* ── Responsive helpers ── */
function useLayout() {
  const { width, height } = useVideoConfig();
  const isWide = width > 700;
  const scale = isWide ? Math.min(width / 1200, 1.4) : Math.min(width / 400, 1.2);
  return { width, height, isWide, scale };
}

/* ── Starfield background ── */
function Starfield() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  const stars = [];
  for (let i = 0; i < 180; i++) {
    const seed = i * 7919;
    const x = (seed * 13) % 100;
    const y = (seed * 17) % 100;
    const size = (seed % 3) + 1;
    const depth = (seed % 4) + 1;
    const drift = progress * depth * 25;
    const opacity = 0.12 + (depth / 4) * 0.25;

    stars.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${((y + drift) % 120) - 10}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: "#fff",
          opacity,
        }}
      />
    );
  }

  return <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{stars}</div>;
}

/* ── Floating venue orbs ── */
function VenueOrbs() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progress = frame / durationInFrames;

  const orbs = [
    { x: 12, y: 20, color: "#f97316", size: 16, depth: 2 },
    { x: 85, y: 35, color: "#4ade80", size: 12, depth: 3 },
    { x: 30, y: 60, color: "#facc15", size: 14, depth: 1.5 },
    { x: 75, y: 75, color: "#f87171", size: 18, depth: 2.5 },
    { x: 20, y: 85, color: "#a78bfa", size: 10, depth: 3.5 },
    { x: 55, y: 12, color: "#4ade80", size: 11, depth: 2.8 },
    { x: 92, y: 55, color: "#f97316", size: 13, depth: 1.8 },
    { x: 45, y: 42, color: "#f87171", size: 9, depth: 3.2 },
    { x: 8, y: 48, color: "#a78bfa", size: 15, depth: 1.3 },
  ];

  return (
    <>
      {orbs.map((orb, i) => {
        const drift = progress * orb.depth * 30;
        const pulse = Math.sin(frame * 0.06 + i * 2) * 0.3 + 1;
        const yPos = ((orb.y + drift) % 130) - 15;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${orb.x}%`,
              top: `${yPos}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              style={{
                width: orb.size * 3 * pulse,
                height: orb.size * 3 * pulse,
                borderRadius: "50%",
                backgroundColor: `${orb.color}08`,
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
            <div
              style={{
                width: orb.size * 1.8,
                height: orb.size * 1.8,
                borderRadius: "50%",
                border: `1px solid ${orb.color}25`,
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) scale(${pulse})`,
              }}
            />
            <div
              style={{
                width: orb.size,
                height: orb.size,
                borderRadius: "50%",
                backgroundColor: orb.color,
                boxShadow: `0 0 ${orb.size}px ${orb.color}50`,
                position: "relative",
              }}
            />
          </div>
        );
      })}
    </>
  );
}

/* ── Scene wrapper — responsive centering ── */
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
  const { isWide } = useLayout();
  const exitFrame = enterFrame + holdFrames;

  const enter = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  const exit =
    frame > exitFrame
      ? interpolate(frame, [exitFrame, exitFrame + 30], [0, 1], {
          extrapolateRight: "clamp",
        })
      : 0;

  const opacity = enter * (1 - exit);
  const y = interpolate(enter, [0, 1], [50, 0]) - exit * 35;
  const scale =
    interpolate(enter, [0, 1], [0.94, 1]) *
    interpolate(exit, [0, 1], [1, 0.96]);

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
        padding: isWide ? "0 10%" : "0 24px",
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Responsive text styles ── */
function useTextStyles() {
  const { isWide, scale } = useLayout();

  return {
    heading: {
      fontFamily: "var(--font-fraunces), Georgia, serif",
      fontSize: isWide ? 52 * scale : 28,
      fontWeight: 600,
      lineHeight: 1.1,
      letterSpacing: isWide ? -1.5 : -0.5,
      color: "#fff",
      textAlign: "center" as const,
    },
    body: {
      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      fontSize: isWide ? 18 * scale : 13,
      lineHeight: 1.6,
      color: "rgba(255,255,255,0.45)",
      textAlign: "center" as const,
      maxWidth: isWide ? 600 : 320,
    },
    label: {
      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
      fontSize: isWide ? 11 * scale : 9,
      fontWeight: 600,
      letterSpacing: 2.5,
      color: "rgba(255,255,255,0.25)",
      textAlign: "center" as const,
      textTransform: "uppercase" as const,
    },
    chip: {
      padding: isWide ? "8px 20px" : "6px 14px",
      borderRadius: isWide ? 14 : 10,
      border: "1px solid rgba(255,255,255,0.08)",
      backgroundColor: "rgba(255,255,255,0.03)",
      fontSize: isWide ? 14 * scale : 10,
      fontWeight: 500,
      color: "rgba(255,255,255,0.5)",
      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    },
  };
}

/* ── Mini map mockup (scales with layout) ── */
function MiniMap() {
  const frame = useCurrentFrame();
  const { isWide, scale } = useLayout();
  const mapW = isWide ? Math.min(560 * scale, 700) : 320;

  const markers = [
    { x: 30, y: 35, color: "#f97316", name: "The Rooftop" },
    { x: 55, y: 55, color: "#4ade80", name: "Daily Grind" },
    { x: 72, y: 30, color: "#facc15", name: "Study Loft" },
    { x: 40, y: 70, color: "#f87171", name: "North House" },
  ];

  return (
    <div
      style={{
        width: mapW,
        maxWidth: "100%",
        aspectRatio: isWide ? "16/9" : "4/3",
        borderRadius: isWide ? 24 : 18,
        background: "#1a1a1a",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {[25, 50, 75].map((p) => (
        <div key={`h${p}`} style={{ position: "absolute", left: 0, right: 0, top: `${p}%`, height: 1, backgroundColor: "rgba(255,255,255,0.03)" }} />
      ))}
      {[33, 66].map((p) => (
        <div key={`v${p}`} style={{ position: "absolute", top: 0, bottom: 0, left: `${p}%`, width: 1, backgroundColor: "rgba(255,255,255,0.03)" }} />
      ))}
      {[
        { x: 10, y: 15, w: 18, h: 12 },
        { x: 45, y: 10, w: 14, h: 16 },
        { x: 70, y: 50, w: 16, h: 10 },
        { x: 15, y: 60, w: 20, h: 14 },
        { x: 55, y: 70, w: 12, h: 10 },
        { x: 80, y: 20, w: 10, h: 14 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: `${b.w}%`,
            height: `${b.h}%`,
            backgroundColor: "rgba(255,255,255,0.02)",
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.02)",
          }}
        />
      ))}
      {markers.map((m, i) => {
        const pulse = Math.sin(frame * 0.08 + i * 1.5) * 0.3 + 1;
        const markerSize = isWide ? 14 : 10;
        return (
          <div
            key={m.name}
            style={{
              position: "absolute",
              left: `${m.x}%`,
              top: `${m.y}%`,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: markerSize,
                height: markerSize,
                borderRadius: "50%",
                backgroundColor: m.color,
                boxShadow: `0 0 ${markerSize}px ${m.color}50`,
                transform: `scale(${pulse})`,
              }}
            />
            <span
              style={{
                fontSize: isWide ? 10 : 7,
                color: "rgba(255,255,255,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              {m.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Mini drawer mockup ── */
function MiniDrawer({ phase }: { phase: "collapsed" | "expanded" }) {
  const frame = useCurrentFrame();
  const { isWide, scale } = useLayout();
  const dot = Math.sin(frame * 0.1) * 0.2 + 1;
  const drawerW = isWide ? Math.min(440 * scale, 520) : 320;
  const f = isWide ? scale : 1;

  if (phase === "collapsed") {
    return (
      <div
        style={{
          width: drawerW,
          maxWidth: "100%",
          height: 44 * f,
          borderRadius: 22 * f,
          background: "rgba(15, 15, 18, 0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          padding: `0 ${14 * f}px`,
          gap: 8 * f,
          fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        }}
      >
        <div style={{ width: 7 * f, height: 7 * f, borderRadius: "50%", backgroundColor: "#f97316", transform: `scale(${dot})`, boxShadow: "0 0 6px #f9731650" }} />
        <span style={{ fontSize: 12 * f, fontWeight: 600, color: "#fff" }}>The Rooftop</span>
        <div style={{ flex: 1, marginLeft: 4, padding: `${5 * f}px ${10 * f}px`, borderRadius: 12 * f, backgroundColor: "rgba(255,255,255,0.04)", fontSize: 10 * f, color: "rgba(255,255,255,0.2)" }}>
          Ask anything...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: drawerW,
        maxWidth: "100%",
        borderRadius: `${20 * f}px ${20 * f}px 0 0`,
        background: "rgba(15, 15, 18, 0.9)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: `${10 * f}px ${14 * f}px`, gap: 8 * f }}>
        <div style={{ width: 7 * f, height: 7 * f, borderRadius: "50%", backgroundColor: "#f97316", transform: `scale(${dot})`, boxShadow: "0 0 6px #f9731650" }} />
        <div>
          <div style={{ fontSize: 12 * f, fontWeight: 600, color: "#fff" }}>The Rooftop</div>
          <div style={{ fontSize: 9 * f, color: "rgba(255,255,255,0.35)" }}>Busy · 72%</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 3 * f, padding: `0 ${12 * f}px ${8 * f}px` }}>
        {["Chat", "Vibe", "Menu", "Events", "Reserve"].map((t, i) => (
          <div
            key={t}
            style={{
              padding: `${3 * f}px ${8 * f}px`,
              borderRadius: 6 * f,
              fontSize: 9 * f,
              fontWeight: 500,
              backgroundColor: i === 0 ? "#f9731620" : "rgba(255,255,255,0.04)",
              color: i === 0 ? "#f97316" : "rgba(255,255,255,0.3)",
              border: `1px solid ${i === 0 ? "#f9731630" : "rgba(255,255,255,0.04)"}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 * f, padding: `0 ${12 * f}px ${8 * f}px` }}>
        <div style={{ display: "flex" }}>
          <div style={{ padding: `${6 * f}px ${10 * f}px`, borderRadius: `${12 * f}px ${12 * f}px ${12 * f}px ${3 * f}px`, background: "rgba(255,255,255,0.06)", fontSize: 10 * f, color: "rgba(255,255,255,0.7)", maxWidth: "80%" }}>
            Welcome to The Rooftop. Busy tonight — 28 people.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ padding: `${6 * f}px ${10 * f}px`, borderRadius: `${12 * f}px ${12 * f}px ${3 * f}px ${12 * f}px`, background: "#f97316", fontSize: 10 * f, color: "#000", maxWidth: "75%" }}>
            Any booths open?
          </div>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ padding: `${6 * f}px ${10 * f}px`, borderRadius: `${12 * f}px ${12 * f}px ${12 * f}px ${3 * f}px`, background: "rgba(255,255,255,0.06)", fontSize: 10 * f, color: "rgba(255,255,255,0.7)", maxWidth: "80%" }}>
            Booth 4 is open. Want me to hold it?
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 * f, padding: `${6 * f}px ${12 * f}px ${10 * f}px` }}>
        <div style={{ flex: 1, padding: `${6 * f}px ${10 * f}px`, borderRadius: 14 * f, backgroundColor: "rgba(255,255,255,0.04)", fontSize: 10 * f, color: "rgba(255,255,255,0.15)" }}>
          Ask anything...
        </div>
        <div style={{ width: 26 * f, height: 26 * f, borderRadius: "50%", backgroundColor: "#f97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={10 * f} height={10 * f} fill="none" viewBox="0 0 24 24" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Side-by-side wrapper for desktop ── */
function SplitLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const { isWide } = useLayout();

  if (!isWide) {
    return (
      <>
        {left}
        <div style={{ height: 16 }} />
        {right}
      </>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 48,
        width: "100%",
        maxWidth: 1000,
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        {left}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {right}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPOSITION
   ═══════════════════════════════════════════════════ */
export function HeroComposition() {
  const styles = useTextStyles();
  const { isWide, scale } = useLayout();

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <Starfield />
      <VenueOrbs />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,0.7) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Scene 1: You're Invited ── */}
      <Scene enterFrame={10} holdFrames={100}>
        <div style={styles.label}>YOU&apos;RE INVITED</div>
        <div style={{ height: isWide ? 20 : 12 }} />
        <div style={styles.heading}>
          Welcome to<br />the Kickback.
        </div>
        <div style={{ height: isWide ? 20 : 14 }} />
        <div style={styles.body}>
          Think of it like this — you know those spots? The coffee shop
          where everybody knows your order. The rooftop where the vibe
          is always right. The study loft that just works.
        </div>
        <div style={{ height: isWide ? 14 : 10 }} />
        <div style={styles.body}>We put them all in one place.</div>
      </Scene>

      {/* ── Scene 2: Third Places ── */}
      <Scene enterFrame={130} holdFrames={100}>
        <div style={styles.label}>WHAT IS THIS</div>
        <div style={{ height: isWide ? 20 : 12 }} />
        <div style={styles.heading}>
          Your third places.
          <br />
          <span style={{ color: "rgba(255,255,255,0.3)" }}>All of them.</span>
        </div>
        <div style={{ height: isWide ? 20 : 14 }} />
        <div style={styles.body}>
          Not home. Not work. The places in between where life actually
          happens. We call them third places — and theKickBack connects
          you to every single one.
        </div>
        <div style={{ height: isWide ? 20 : 14 }} />
        <div style={{ display: "flex", gap: isWide ? 12 : 8 }}>
          {["Book a spot", "Meet people", "Just vibe"].map((t) => (
            <div key={t} style={styles.chip}>
              {t}
            </div>
          ))}
        </div>
      </Scene>

      {/* ── Scene 3: The Map ── */}
      <Scene enterFrame={250} holdFrames={130}>
        <SplitLayout
          left={
            <>
              <div style={isWide ? { ...styles.label, textAlign: "left" } : styles.label}>DISCOVER</div>
              <div style={{ height: isWide ? 16 : 12 }} />
              <div style={isWide ? { ...styles.heading, textAlign: "left" } : styles.heading}>
                See what&apos;s live
                <br />
                around you.
              </div>
              <div style={{ height: isWide ? 16 : 14 }} />
              <div style={isWide ? { ...styles.body, textAlign: "left" } : styles.body}>
                Every dot is a venue. Every color is a vibe. Green means chill.
                Orange means it&apos;s poppin. Tap one and you&apos;re in.
              </div>
            </>
          }
          right={<MiniMap />}
        />
      </Scene>

      {/* ── Scene 4: The Drawer ── */}
      <Scene enterFrame={400} holdFrames={130}>
        <SplitLayout
          left={
            <>
              <div style={isWide ? { ...styles.label, textAlign: "left" } : styles.label}>TALK TO IT</div>
              <div style={{ height: isWide ? 16 : 12 }} />
              <div style={isWide ? { ...styles.heading, textAlign: "left" } : styles.heading}>
                Every venue has
                <br />
                its own AI.
              </div>
              <div style={{ height: isWide ? 16 : 14 }} />
              <div style={isWide ? { ...styles.body, textAlign: "left" } : styles.body}>
                Ask if there&apos;s space. Check the menu. Reserve a booth. The
                venue talks back — like a friend who works there.
              </div>
            </>
          }
          right={
            <div style={{ display: "flex", flexDirection: "column", gap: isWide ? 12 : 10, alignItems: "center" }}>
              <MiniDrawer phase="collapsed" />
              <MiniDrawer phase="expanded" />
            </div>
          }
        />
      </Scene>

      {/* ── Scene 5: The Tabs ── */}
      <Scene enterFrame={550} holdFrames={120}>
        <SplitLayout
          left={
            <>
              <div style={isWide ? { ...styles.label, textAlign: "left" } : styles.label}>DO THINGS</div>
              <div style={{ height: isWide ? 16 : 12 }} />
              <div style={isWide ? { ...styles.heading, textAlign: "left" } : styles.heading}>
                Book. Meet. Greet.
                <br />
                <span style={{ color: "rgba(255,255,255,0.3)" }}>All from one chat.</span>
              </div>
            </>
          }
          right={
            <div style={{ display: "flex", flexDirection: "column", gap: isWide ? 10 : 8, width: "100%", maxWidth: isWide ? 420 : 300 }}>
              {[
                { tab: "Vibe", desc: "What's the energy like right now?", color: "#4ade80" },
                { tab: "Menu", desc: "See what they're serving", color: "#facc15" },
                { tab: "Events", desc: "Anything happening tonight?", color: "#a78bfa" },
                { tab: "Reserve", desc: "Lock down a table or booth", color: "#f97316" },
              ].map((item) => {
                const f = isWide ? scale : 1;
                return (
                  <div
                    key={item.tab}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12 * f,
                      padding: `${10 * f}px ${14 * f}px`,
                      borderRadius: 14 * f,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                    }}
                  >
                    <div
                      style={{
                        padding: `${4 * f}px ${10 * f}px`,
                        borderRadius: 8 * f,
                        backgroundColor: `${item.color}18`,
                        fontSize: 10 * f,
                        fontWeight: 600,
                        color: item.color,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.tab}
                    </div>
                    <span style={{ fontSize: 11 * f, color: "rgba(255,255,255,0.4)" }}>
                      {item.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          }
        />
      </Scene>

      {/* ── Scene 6: The Network ── */}
      <Scene enterFrame={690} holdFrames={120}>
        <div style={styles.label}>THE NETWORK</div>
        <div style={{ height: isWide ? 20 : 12 }} />
        <div style={styles.heading}>
          One identity.
          <br />
          Every venue.
        </div>
        <div style={{ height: isWide ? 18 : 14 }} />
        <div style={styles.body}>
          Walk into any KickBack venue and you&apos;re already recognized.
          Your preferences travel with you. Your membership stacks. No
          sign-ups. No check-ins. Just pull up.
        </div>
        <div style={{ height: isWide ? 24 : 16 }} />
        <svg
          width={isWide ? 400 : 240}
          height={isWide ? 80 : 60}
          viewBox="0 0 240 60"
        >
          <line x1="40" y1="30" x2="80" y2="20" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1="80" y1="20" x2="120" y2="35" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1="120" y1="35" x2="160" y2="18" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <line x1="160" y1="18" x2="200" y2="30" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          {[
            { cx: 40, cy: 30, color: "#f97316" },
            { cx: 80, cy: 20, color: "#4ade80" },
            { cx: 120, cy: 35, color: "#facc15" },
            { cx: 160, cy: 18, color: "#f87171" },
            { cx: 200, cy: 30, color: "#a78bfa" },
          ].map((n, i) => (
            <g key={i}>
              <circle cx={n.cx} cy={n.cy} r="8" fill={`${n.color}15`} />
              <circle cx={n.cx} cy={n.cy} r="4" fill={n.color} />
            </g>
          ))}
        </svg>
      </Scene>

      {/* ── Scene 7: CTA ── */}
      <Scene enterFrame={830} holdFrames={70}>
        <div style={styles.heading}>Pull up.</div>
        <div style={{ height: isWide ? 16 : 12 }} />
        <div style={styles.body}>
          The kickback is happening. You&apos;re invited.
        </div>
        <div style={{ height: isWide ? 28 : 20 }} />
        <div
          style={{
            padding: isWide ? "14px 40px" : "10px 28px",
            borderRadius: 50,
            backgroundColor: "#F97316",
            fontSize: isWide ? 16 : 13,
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
