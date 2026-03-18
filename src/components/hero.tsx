const SMS_THREAD = [
  { from: "user", text: "join" },
  { from: "venue", text: "Welcome to The Rooftop. Quiet right now — 12 people, 3 groups. Good for focus." },
  { from: "venue", text: "You're in as a Guest. Text MENU, REQUEST, or ASK anytime." },
  { from: "user", text: "ask is there a booth open?" },
  { from: "venue", text: "Yes — booth 4 near the window is open. Want me to hold it? Reply HOLD or PASS." },
  { from: "user", text: "hold" },
  { from: "venue", text: "Booth 4 held for 10 min. Head over when ready." },
];

export function Hero() {
  return (
    <section className="flex gap-12 py-14">
      {/* Left Column */}
      <div className="flex w-[600px] shrink-0 flex-col gap-6">
        {/* Badge */}
        <div className="flex w-fit items-center gap-2 rounded-full border border-black/5 px-3.5 py-1.5">
          <div className="h-2 w-2 rounded bg-orange" />
          <span className="font-sans text-[11px] font-medium tracking-[2.2px] text-black/55">
            TEXT-FIRST VENUE PROTOCOL
          </span>
        </div>

        {/* Headlines */}
        <h1 className="font-display text-[60px] font-semibold leading-[0.95] tracking-[-2px] text-black">
          Text a venue.
        </h1>
        <h1 className="font-display text-[60px] font-semibold leading-[0.95] tracking-[-2px] text-black/35">
          Enter the network.
        </h1>

        {/* Description */}
        <p className="max-w-full font-sans text-lg leading-[1.6] text-black/65">
          No app. No download. No account. Just text a number and you&apos;re in.
          theKickBack turns every venue into a live system you interact with
          through SMS. Check vibes, request a booth, ask the bartender — all
          from one text thread.
        </p>

        {/* CTA — The Number */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 rounded-2xl border border-black/8 bg-[#FAFAFA] px-6 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange">
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
                TEXT &ldquo;JOIN&rdquo; TO
              </span>
              <span className="font-sans text-3xl font-bold tracking-tight text-black">
                (555) KICK-BACK
              </span>
            </div>
          </div>
          <span className="font-sans text-xs text-black/40">
            Or scan any venue&apos;s QR code. Same number, venue context built in.
          </span>
        </div>

        {/* What you can text */}
        <div className="flex flex-col gap-2">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-black/40">
            THINGS YOU CAN TEXT
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

      {/* Right Column — SMS Thread Card */}
      <div className="flex flex-1 flex-col gap-4 rounded-[32px] bg-black p-6">
        <div className="flex w-full items-center justify-between">
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/55">
            LIVE SMS THREAD
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-orange animate-pulse" />
            <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/55">
              THE ROOFTOP
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden rounded-3xl bg-white/[0.03] p-5">
          {SMS_THREAD.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
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
            Text a command...
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
