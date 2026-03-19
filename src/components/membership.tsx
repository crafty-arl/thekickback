"use client";

const MEMBERSHIP_FLOW = [
  { from: "user" as const, text: "membership" },
  {
    from: "venue" as const,
    text: "The Rooftop Membership\n\n→ Priority booths\n→ Skip the wait\n→ Members-only events\n→ $25/month\n\nReply YES to join, or ASK to learn more.",
  },
  { from: "user" as const, text: "yes" },
  {
    from: "venue" as const,
    text: "You're in. Welcome to The Rooftop, member. You're now recognized across all KickBack venues.",
  },
];

export function Membership() {
  return (
    <section
      id="membership"
      className="mb-10 flex flex-col gap-8 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-6 py-8 sm:rounded-[32px] sm:px-10 sm:py-12 md:flex-row"
    >
      {/* Left — Text */}
      <div className="flex flex-1 flex-col gap-6">
        <span className="font-sans text-[11px] font-medium tracking-[2.4px] text-white/35">
          MEMBERSHIP VIA TEXT
        </span>
        <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-1px] text-white sm:text-4xl md:text-5xl md:tracking-[-1.5px]">
          Reply YES to join.
        </h2>
        <p className="max-w-lg font-sans text-base leading-[1.6] text-white/45">
          No signup form. No credit card page. No app onboarding. Membership is
          a message. Your identity is built in. One address, recognized across
          the entire network.
        </p>

        {/* Benefits */}
        <div className="flex flex-col gap-3 pt-2">
          {[
            "Your identity = your membership card",
            "Recognized at every KickBack venue",
            "Venue-specific tiers stack on top",
            "Cancel anytime — send CANCEL",
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-orange" />
              <span className="font-sans text-sm text-white/45">
                {benefit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Thread flow */}
      <div className="flex w-full flex-col gap-3 rounded-2xl bg-white/[0.03] p-4 sm:rounded-3xl sm:p-6 md:w-[400px] md:shrink-0">
        <div className="flex items-center gap-2 pb-2">
          <div className="h-2 w-2 rounded-full bg-orange animate-pulse" />
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/30">
            MEMBERSHIP FLOW
          </span>
        </div>

        {MEMBERSHIP_FLOW.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                msg.from === "user"
                  ? "rounded-br-sm bg-orange text-black"
                  : "rounded-bl-sm bg-white/[0.06] text-white/70"
              }`}
            >
              <p className="whitespace-pre-line font-sans text-sm leading-[1.5]">
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
