const FEATURES = [
  {
    title: "No app required",
    body: "Works from any email client on any device. No download, no updates, no storage. Your thread IS the interface. The venue lives in your inbox.",
  },
  {
    title: "Text is the protocol",
    body: "JOIN, ASK, REQUEST, STATUS — simple commands that resolve instantly. The protocol is the conversation. Every message is an action.",
  },
  {
    title: "Context built in",
    body: "The venue knows who you are from your address. Returning guest? Member? First timer? The system remembers. No login required.",
  },
];

export function Features() {
  return (
    <section id="protocol" className="flex flex-col gap-4 py-10 sm:flex-row sm:gap-6">
      {FEATURES.map((feat) => (
        <div
          key={feat.title}
          className="flex flex-1 flex-col gap-3 rounded-[28px] bg-[#FAFAFA] p-7"
        >
          <div className="h-2 w-12 rounded bg-orange" />
          <h3 className="font-sans text-xl font-semibold tracking-tight text-black">
            {feat.title}
          </h3>
          <p className="font-sans text-sm leading-[1.6] text-black/65">
            {feat.body}
          </p>
        </div>
      ))}
    </section>
  );
}
