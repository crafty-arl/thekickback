"use client";

const FEATURES = [
  {
    title: "No app required",
    body: "Works from any email client on any device. No download, no updates, no storage. Your thread IS the interface.",
  },
  {
    title: "Text is the protocol",
    body: "JOIN, ASK, REQUEST, STATUS — simple commands that resolve instantly. Every message is an action.",
  },
  {
    title: "Context built in",
    body: "The venue knows who you are. Returning guest? Member? First timer? The system remembers. No login required.",
  },
];

export function Features() {
  return (
    <section
      id="protocol"
      className="flex flex-col gap-4 py-10 sm:flex-row sm:gap-5"
    >
      {FEATURES.map((feat) => (
        <div
          key={feat.title}
          className="group flex flex-1 flex-col gap-3 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-7 transition-all hover:border-orange/15 hover:bg-white/[0.04]"
        >
          <div className="h-1.5 w-10 rounded-full bg-orange/60 transition-all group-hover:w-14 group-hover:bg-orange" />
          <h3 className="font-sans text-xl font-semibold tracking-tight text-white">
            {feat.title}
          </h3>
          <p className="font-sans text-sm leading-[1.6] text-white/40">
            {feat.body}
          </p>
        </div>
      ))}
    </section>
  );
}
