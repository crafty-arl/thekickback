const FEATURES = [
  {
    title: "No app required",
    body: "SMS works on every phone. No download, no updates, no storage. Your text thread IS the interface. The venue lives in your messages.",
  },
  {
    title: "Text is the protocol",
    body: "JOIN, ASK, REQUEST, STATUS — simple commands that resolve instantly. The protocol is the conversation. Every text is an action.",
  },
  {
    title: "Context built in",
    body: "The venue knows who you are from your number. Returning guest? Member? First timer? The system remembers. No login required.",
  },
];

export function Features() {
  return (
    <section id="protocol" className="flex gap-6 py-10">
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
