import { ChatMessage } from "@/lib/dashboard";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function maskIdentifier(id: string): string {
  if (id.includes("@")) {
    const [local, domain] = id.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  if (id.length > 6) {
    return `***-***-${id.slice(-4)}`;
  }
  return id;
}

export function TextLog({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-black p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
          LIVE FEED
        </span>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          <span className="font-sans text-[10px] font-medium tracking-[2px] text-white/40">
            LIVE
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {messages.length === 0 && (
          <p className="py-4 text-center font-sans text-sm text-white/20">
            No messages yet. Conversations will appear here.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 rounded-xl px-3 py-2 ${msg.sender_type === "guest" ? "bg-white/[0.04]" : "bg-orange/[0.08]"
              }`}
          >
            {/* Direction arrow */}
            <span className={`mt-0.5 font-mono text-xs ${msg.sender_type === "guest" ? "text-green-400" : "text-orange"
              }`}>
              {msg.sender_type === "guest" ? "→" : "←"}
            </span>

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-white/40">
                  {msg.sender_phone ? maskIdentifier(msg.sender_phone) : "guest"}
                </span>
                <span className="font-sans text-[10px] text-white/25">
                  {formatTime(msg.created_at)}
                </span>
              </div>
              <p className="font-sans text-sm text-white/70">{msg.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
