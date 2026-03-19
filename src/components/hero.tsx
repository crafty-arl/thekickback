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
    <section className="flex min-h-dvh flex-col items-center justify-center px-4">
      {/* Logo */}
      <Image
        src="/logo.png"
        alt="theKickBack"
        width={140}
        height={44}
        className="absolute top-6 h-7 w-auto invert sm:h-9"
        priority
      />

      {/* Full cinematic Remotion player */}
      <div className="w-full max-w-[420px]">
        <PlayerWrapper
          component={HeroComposition as React.ComponentType}
          durationInFrames={900}
          width={420}
          height={900}
          fps={30}
          style={{ borderRadius: 28 }}
        />
      </div>
    </section>
  );
}
