interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-black/5 bg-white p-4 sm:p-5">
      <span className="font-sans text-[11px] font-medium tracking-[2px] text-black/35">
        {label}
      </span>
      <span className={`font-sans text-2xl font-bold tracking-tight sm:text-3xl ${accent ? "text-orange" : "text-black"}`}>
        {value}
      </span>
      {sub && (
        <span className="font-sans text-xs text-black/40">{sub}</span>
      )}
    </div>
  );
}
