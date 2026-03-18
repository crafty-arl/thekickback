const EMAIL_THREAD = [
  { from: "user", text: "join" },
  { from: "venue", text: "Welcome to The Rooftop. Quiet right now — 12 people, 3 groups. Good for focus." },
  { from: "venue", text: "You're in as a Guest. Reply MENU, REQUEST, or ASK anytime." },
  { from: "user", text: "ask is there a booth open?" },
  { from: "venue", text: "Yes — booth 4 near the window is open. Want me to hold it? Reply HOLD or PASS." },
  { from: "user", text: "hold" },
  { from: "venue", text: "Booth 4 held for 10 min. Head over when ready." },
];

export function Hero() {
  return (
    <section className="flex flex-col gap-8 py-10 md:flex-row md:gap-12 md:py-14">
      {/* Left Column */}
      <div className="flex w-full flex-col gap-6 md:w-[600px] md:shrink-0">
        {/* Badge */}
        <div className="flex w-fit items-center gap-2 rounded-full border border-black/5 px-3.5 py-1.5">
          <div className="h-2 w-2 rounded bg-orange" />
          <span className="font-sans text-[11px] font-medium tracking-[2.2px] text-black/55">
            TEXT-FIRST VENUE PROTOCOL
          </span>
        </div>

        {/* Headlines */}
        <h1 className="font-display text-4xl font-semibold leading-[0.95] tracking-[-1.5px] text-black sm:text-5xl md:text-[60px] md:tracking-[-2px]">
          Text a venue.
        </h1>
        <h1 className="font-display text-4xl font-semibold leading-[0.95] tracking-[-1.5px] text-black/35 sm:text-5xl md:text-[60px] md:tracking-[-2px]">
          Enter the network.
        </h1>

        {/* Description */}
        <p className="max-w-full font-sans text-base leading-[1.6] text-black/65 md:text-lg">
          No app. No download. No account. Just send an email and you&apos;re in.
          theKickBack turns every venue into a live system you interact with
          through text. Check vibes, request a booth, ask the bartender — all
          from one thread.
        </p>

        {/* Get Started — Three Channels */}
        <div className="flex flex-col gap-3">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
            GET STARTED
          </span>

          {/* Shortcut — Primary CTA */}
          <a
            href="shortcuts://run-shortcut?name=Join%20theKickBack"
            className="flex items-center gap-4 rounded-2xl bg-black px-4 py-4 transition-colors hover:bg-black/90 sm:px-6 sm:py-5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange sm:h-12 sm:w-12">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto opacity-40">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          {/* Email — Secondary */}
          <a
            href="mailto:join@thekickback.net?subject=join&amp;body=JOIN"
            className="flex items-center gap-4 rounded-2xl border border-black/8 bg-[#FAFAFA] px-4 py-3 transition-colors hover:bg-[#F0F0F0] sm:px-6 sm:py-4"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06]">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xs font-medium text-black/50">
                Or email us
              </span>
              <span className="font-sans text-sm font-bold tracking-tight text-black">
                join@thekickback.net
              </span>
            </div>
          </a>

          {/* SMS — Coming soon */}
          <div className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06]">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-xs font-medium text-black/50">
                Or text JOIN to
              </span>
              <span className="font-sans text-sm font-bold tracking-tight text-black">
                (877) 780-4236
              </span>
            </div>
            <span className="ml-auto rounded-full bg-orange/10 px-2.5 py-0.5 font-sans text-[10px] font-medium tracking-wide text-orange">
              COMING SOON
            </span>
          </div>

          <span className="font-sans text-xs text-black/35">
            No app. No account. Works on every iPhone with Shortcuts.
          </span>
        </div>

        {/* What you can do */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
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
                className="rounded-lg border border-black/8 bg-white px-3 py-1.5 font-mono text-sm font-medium text-black/70"
              >
                {cmd}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column — Thread Card */}
      <div className="flex flex-1 flex-col gap-4 rounded-[24px] bg-black p-4 sm:rounded-[32px] sm:p-6">
        <div className="flex w-full items-center justify-between">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/55">
            LIVE THREAD
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-orange animate-pulse" />
            <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/55">
              THE ROOFTOP
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden rounded-2xl bg-white/[0.03] p-3 sm:rounded-3xl sm:p-5">
          {EMAIL_THREAD.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 sm:max-w-[85%] sm:px-4 sm:py-2.5 ${
                  msg.from === "user"
                    ? "rounded-br-sm bg-orange text-black"
                    : "rounded-bl-sm bg-white/[0.08] text-white/80"
                }`}
              >
                <p className="font-sans text-sm leading-[1.5]">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input hint */}
        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
          <span className="flex-1 font-sans text-sm text-white/30">
            Send a message...
          </span>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange">
            <svg
              width="16"
              height="16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="black"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
