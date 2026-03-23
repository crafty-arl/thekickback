/**
 * KB Logo Components
 * 
 * Orange K (#f97316) + White B — the core brand mark.
 * 
 * Usage:
 *   <KBMark size={32} />                       — compact KB icon (dark bg)
 *   <KBMark size={32} variant="dark" />         — compact KB icon (light bg)
 *   <KBWordmark height={28} />                  — full "theKickBack" text (dark bg)
 *   <KBWordmark height={28} variant="dark" />   — full "theKickBack" text (light bg)
 */

const KB_ORANGE = "#f97316";

interface KBMarkProps {
  size?: number;
  variant?: "light" | "dark"; // light = on dark bg (default), dark = on light bg
  className?: string;
  style?: React.CSSProperties;
}

/** Compact KB mark — orange K, white/dark B */
export function KBMark({ size = 32, variant = "light", className, style }: KBMarkProps) {
  const bColor = variant === "dark" ? "#1a1a1a" : "#ffffff";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="KB"
    >
      {/* K */}
      <text
        x="3"
        y="38"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="42"
        fill={KB_ORANGE}
        letterSpacing="-3"
      >
        K
      </text>
      {/* B */}
      <text
        x="24"
        y="38"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="42"
        fill={bColor}
        letterSpacing="-3"
      >
        B
      </text>
    </svg>
  );
}

interface KBWordmarkProps {
  height?: number;
  variant?: "light" | "dark"; // light = on dark bg (default), dark = on light bg
  className?: string;
  style?: React.CSSProperties;
}

/** Full wordmark: "theKickBack" with orange K and contextual B */
export function KBWordmark({ height = 28, variant = "light", className, style }: KBWordmarkProps) {
  const isDark = variant === "dark";
  const theColor = isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.55)";
  const textColor = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
  const bColor = isDark ? "#1a1a1a" : "#ffffff";
  const aspectRatio = 5.2;
  const width = Math.round(height * aspectRatio);

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        fontWeight: 700,
        fontSize: height * 0.72,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        userSelect: "none",
        whiteSpace: "nowrap",
        width,
        ...style,
      }}
      aria-label="theKickBack"
    >
      <span style={{ color: theColor, fontWeight: 500 }}>the</span>
      <span style={{ color: KB_ORANGE }}>K</span>
      <span style={{ color: textColor }}>ick</span>
      <span style={{ color: bColor }}>B</span>
      <span style={{ color: textColor }}>ack</span>
    </span>
  );
}

