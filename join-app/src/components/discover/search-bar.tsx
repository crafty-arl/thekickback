"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-[#FAFAFA] px-4 py-3">
      <svg
        width="20"
        height="20"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        className="shrink-0 text-black/30"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search venues, neighborhoods, vibes..."
        className="w-full bg-transparent font-sans text-sm text-black outline-none placeholder:text-black/30"
      />
    </div>
  );
}
