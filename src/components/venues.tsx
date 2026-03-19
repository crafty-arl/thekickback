"use client";

import dynamic from "next/dynamic";

const PlayerWrapper = dynamic(
  () =>
    import("@/components/remotion/player-wrapper").then(
      (m) => m.PlayerWrapper
    ),
  { ssr: false }
);

const VenuesComposition = dynamic(
  () =>
    import("@/components/remotion/venues-composition").then(
      (m) => m.VenuesComposition
    ),
  { ssr: false }
);

const NetworkComposition = dynamic(
  () =>
    import("@/components/remotion/network-composition").then(
      (m) => m.NetworkComposition
    ),
  { ssr: false }
);

export function Venues() {
  return (
    <section id="venues" className="flex flex-col gap-8 py-14 md:py-20">
      {/* Text */}
      <div className="flex flex-col gap-4">
        <span className="font-sans text-[11px] font-medium tracking-[2.4px] text-white/35">
          YOUR VENUE THREADS
        </span>
        <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-1px] text-white sm:text-4xl md:text-[42px] md:tracking-[-1.5px]">
          Every venue is a conversation.
        </h2>
        <p className="max-w-2xl font-sans text-base leading-[1.6] text-white/45">
          Your message inbox becomes a live dashboard of every venue you&apos;ve
          entered. Each thread is an open channel.
        </p>
      </div>

      {/* Animated panels */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Venues list animation */}
        <div className="overflow-hidden rounded-[24px] border border-white/[0.06]">
          <PlayerWrapper
            component={VenuesComposition as React.ComponentType}
            durationInFrames={240}
            width={520}
            height={420}
            fps={30}
            style={{ borderRadius: 24 }}
          />
        </div>

        {/* Network visualization */}
        <div className="overflow-hidden rounded-[24px] border border-white/[0.06]">
          <PlayerWrapper
            component={NetworkComposition as React.ComponentType}
            durationInFrames={300}
            width={520}
            height={420}
            fps={30}
            style={{ borderRadius: 24 }}
          />
        </div>
      </div>
    </section>
  );
}
