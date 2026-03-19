"use client";

const STEPS = [
  {
    number: "01",
    command: "join",
    title: "Text to enter",
    body: "Send JOIN to join@thekickback.net or scan a venue's QR code. No app download. No signup form. You're in the venue's system in seconds.",
  },
  {
    number: "02",
    command: "ask",
    title: "Talk to the venue",
    body: "Ask if there's space, what the vibe is like, or if the kitchen's still open. The venue responds in real time. Like texting a friend who works there.",
  },
  {
    number: "03",
    command: "request",
    title: "Request anything",
    body: "Need a booth? Want to order ahead? Request a late checkout on your table? Send REQUEST and the venue handles it.",
  },
  {
    number: "04",
    command: "status",
    title: "Stay in the loop",
    body: "Get live updates on your session, your requests, and the venue state. Your thread is your dashboard. Send STATUS anytime.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-14 md:py-20">
      {/* Section header */}
      <div className="flex flex-col gap-4 pb-10">
        <span className="font-sans text-[11px] font-medium tracking-[2.4px] text-white/35">
          HOW IT WORKS
        </span>
        <h2 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-1px] text-white sm:text-4xl md:text-[42px] md:tracking-[-1.5px]">
          One thread. Full venue access.
        </h2>
        <p className="max-w-2xl font-sans text-base leading-[1.6] text-white/45">
          Every interaction with a venue happens through a single conversation.
          No app to learn. No UI to navigate. Just text what you need.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="group flex flex-col gap-4 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-white/10 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] font-medium tracking-[2px] text-white/20">
                {step.number}
              </span>
              <span className="rounded-lg bg-orange/10 px-3 py-1 font-mono text-sm font-medium text-orange">
                {step.command}
              </span>
            </div>
            <h3 className="font-sans text-xl font-semibold tracking-tight text-white">
              {step.title}
            </h3>
            <p className="font-sans text-sm leading-[1.6] text-white/40">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
