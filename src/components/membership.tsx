const MEMBERSHIP_FLOW = [
  { from: "user", text: "membership" },
  {
    from: "venue",
    text: "The Rooftop Membership\n\n→ Priority booths\n→ Skip the wait\n→ Members-only events\n→ $25/month\n\nReply YES to join, or ASK to learn more.",
  },
  { from: "user", text: "yes" },
  {
    from: "venue",
    text: "You're in. Welcome to The Rooftop, member. Your number is now recognized across all KickBack venues. Text STATUS anytime.",
  },
];

export function Membership() {
  return (
    <section
      id="membership"
      className="flex gap-8 rounded-[32px] bg-black px-10 py-12"
    >
      {/* Left — Text */}
      <div className="flex flex-1 flex-col gap-6">
        <span className="font-sans text-[11px] font-medium tracking-[2.4px] text-white/45">
          MEMBERSHIP VIA TEXT
        </span>
        <h2 className="font-display text-5xl font-semibold leading-[1.05] tracking-[-1.5px] text-white">
          Text YES to join.
        </h2>
        <p className="max-w-lg font-sans text-base leading-[1.6] text-white/65">
          No signup form. No credit card page. No app onboarding.
          Membership is a text message. Your phone number is your identity.
          One number, recognized across the entire network.
        </p>

        {/* Membership benefits */}
        <div className="flex flex-col gap-3 pt-2">
          {[
            "Your number = your membership card",
            "Recognized at every KickBack venue",
            "Venue-specific tiers stack on top",
            "Cancel anytime — text CANCEL",
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-orange" />
              <span className="font-sans text-sm text-white/60">
                {benefit}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — SMS flow */}
      <div className="flex w-[400px] shrink-0 flex-col gap-3 rounded-3xl bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 pb-2">
          <div className="h-2 w-2 rounded-full bg-orange" />
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
            MEMBERSHIP FLOW
          </span>
        </div>

        {MEMBERSHIP_FLOW.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-2.5 ${
                msg.from === "user"
                  ? "rounded-br-sm bg-orange text-black"
                  : "rounded-bl-sm bg-white/[0.08] text-white/80"
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
