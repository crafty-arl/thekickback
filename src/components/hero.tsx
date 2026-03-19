"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const PlayerWrapper = dynamic(
  () =>
    import("@/components/remotion/player-wrapper").then(
      (m) => m.PlayerWrapper
    ),
  { ssr: false }
);

const HeroComposition = dynamic(
  () =>
    import("@/components/remotion/hero-composition").then(
      (m) => m.HeroComposition
    ),
  { ssr: false }
);

export function Hero() {
  return (
    <section className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      {/* Logo */}
      <Image
        src="/logo.png"
        alt="theKickBack"
        width={160}
        height={50}
        className="mb-10 h-8 w-auto invert sm:h-10"
        priority
      />

      {/* Remotion animation — the entire focus */}
      <div className="w-full max-w-[380px] sm:max-w-[420px]">
        <PlayerWrapper
          component={HeroComposition as React.ComponentType}
          durationInFrames={300}
          width={420}
          height={560}
          fps={30}
          style={{ borderRadius: 24 }}
        />
      </div>

      {/* Headline */}
      <h1 className="mt-10 text-center font-display text-3xl font-semibold leading-[1.05] tracking-[-1px] text-white sm:text-4xl">
        Text a venue. Enter the network.
      </h1>

      {/* One-liner */}
      <p className="mt-4 max-w-md text-center font-sans text-base leading-[1.6] text-white/40">
        No app. No account. Just send a message.
      </p>

      {/* Single CTA */}
      <a
        href="shortcuts://run-shortcut?name=Join%20theKickBack"
        className="mt-8 flex items-center gap-3 rounded-full bg-orange px-6 py-3 font-sans text-sm font-semibold text-black transition-opacity hover:opacity-90"
      >
        <svg
          width="18"
          height="18"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        Open theKickBack
      </a>
    </section>
  );
}
