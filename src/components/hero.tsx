"use client";

import dynamic from "next/dynamic";

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
    <section className="flex flex-col gap-8 py-10 md:flex-row md:gap-12 md:py-20">
      {/* Left Column */}
      <div className="flex w-full flex-col gap-6 md:w-[600px] md:shrink-0">
        {/* Badge */}
        <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 px-3.5 py-1.5">
          <div className="h-2 w-2 rounded bg-orange animate-pulse" />
          <span className="font-sans text-[11px] font-medium tracking-[2.2px] text-white/50">
            TEXT-FIRST VENUE PROTOCOL
          </span>
        </div>

        {/* Headlines */}
        <h1 className="font-display text-4xl font-semibold leading-[0.95] tracking-[-1.5px] text-white sm:text-5xl md:text-[64px] md:tracking-[-2px]">
          Text a venue.
        </h1>
        <h1 className="font-display text-4xl font-semibold leading-[0.95] tracking-[-1.5px] text-white/25 sm:text-5xl md:text-[64px] md:tracking-[-2px]">
          Enter the network.
        </h1>

        {/* Description */}
        <p className="max-w-full font-sans text-base leading-[1.7] text-white/50 md:text-lg">
          No app. No download. No account. Just send a message and you&apos;re
          in. theKickBack turns every venue into a live system you interact
          with through text.
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-3 pt-2">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/30">
            GET STARTED
          </span>

          {/* Shortcut — Primary CTA */}
          <a
            href="shortcuts://run-shortcut?name=Join%20theKickBack"
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 transition-all hover:border-orange/30 hover:bg-white/[0.06] sm:px-6 sm:py-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange sm:h-12 sm:w-12">
              <svg
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
                stroke="black"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[10px] font-medium tracking-[2px] text-orange">
                TAP TO JOIN A VENUE
              </span>
              <span className="font-sans text-xl font-bold tracking-tight text-white sm:text-2xl">
                Open theKickBack
              </span>
            </div>
            <svg
              width="20"
              height="20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-auto opacity-20 transition-all group-hover:translate-x-1 group-hover:opacity-40"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          {/* Email */}
          <a
            href="mailto:join@thekickback.net?subject=join&amp;body=JOIN"
            className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-all hover:border-white/10 hover:bg-white/[0.04] sm:px-6 sm:py-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <svg
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xs font-medium text-white/40">
                Or email us
              </span>
              <span className="font-sans text-sm font-bold tracking-tight text-white/80">
                join@thekickback.net
              </span>
            </div>
          </a>

          {/* SMS */}
          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.04] bg-white/[0.01] px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
              <svg
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xs font-medium text-white/40">
                Or text JOIN to
              </span>
              <span className="font-sans text-sm font-bold tracking-tight text-white/80">
                (877) 780-4236
              </span>
            </div>
            <span className="ml-auto rounded-full bg-orange/10 px-2.5 py-0.5 font-sans text-[10px] font-medium tracking-wide text-orange">
              COMING SOON
            </span>
          </div>

          <span className="font-sans text-xs text-white/25">
            No app. No account. Works on every iPhone with Shortcuts.
          </span>
        </div>

        {/* Commands */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/30">
            WHAT YOU CAN DO
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              "join",
              "ask",
              "request",
              "menu",
              "hold",
              "status",
              "leave",
              "membership",
            ].map((cmd) => (
              <span
                key={cmd}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 font-mono text-sm font-medium text-white/50 transition-colors hover:border-orange/20 hover:text-orange/80"
              >
                {cmd}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column — Remotion Animated Thread */}
      <div className="flex flex-1 items-center">
        <PlayerWrapper
          component={HeroComposition as React.ComponentType}
          durationInFrames={300}
          width={480}
          height={640}
          fps={30}
          style={{ borderRadius: 28 }}
        />
      </div>
    </section>
  );
}
