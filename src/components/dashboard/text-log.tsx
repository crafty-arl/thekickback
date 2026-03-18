import { MOCK_TEXT_LOG } from "@/lib/dashboard";

export function TextLog() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-black p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
          LIVE TEXT FEED
        </span>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
            LIVE
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {MOCK_TEXT_LOG.map((msg, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-xl px-3 py-2 ${
              msg.direction === "in" ? "bg-white/[0.04]" : "bg-orange/[0.08]"
            }`}
          >
            {/* Direction arrow */}
            <span className={`mt-0.5 font-mono text-xs ${
              msg.direction === "in" ? "text-green-400" : "text-orange"
            }`}>
              {msg.direction === "in" ? "→" : "←"}
            </span>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-white/40">{msg.phone}</span>
                <span className="font-sans text-[10px] text-white/25">{msg.time}</span>
              </div>
              <p className="font-sans text-sm text-white/70">{msg.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
