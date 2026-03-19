"use client";

import dynamic from "next/dynamic";
import Image from "next/image";

const PlayerWrapper = dynamic(
  () => import("@/components/remotion/player-wrapper").then((m) => m.PlayerWrapper),
  { ssr: false }
);

const HeroComposition = dynamic(
  () => import("@/components/remotion/hero-composition").then((m) => m.HeroComposition),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Remotion walkthrough — fullscreen */}
      <div className="absolute inset-0">
        <PlayerWrapper
          component={HeroComposition as React.ComponentType}
          durationInFrames={1500}
          fps={30}
        />
      </div>

      {/* Logo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-[max(16px,env(safe-area-inset-top))]">
        <Image
          src="/logo.png"
          alt="theKickBack"
          width={140}
          height={44}
          className="h-7 w-auto invert sm:h-9"
          priority
        />
      </div>
    </main>
  );
}
