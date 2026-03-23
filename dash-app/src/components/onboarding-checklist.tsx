"use client";

import { motion } from "framer-motion";

export interface ChecklistState {
  basics: boolean;
  location: boolean;
  hours: boolean;
  branding: boolean;
  offerings: boolean;
  knowledge: boolean;
  photos: boolean;
  xp: boolean;
  stripe: boolean;
}

const CHECKLIST_ITEMS: { key: keyof ChecklistState; label: string; description: string }[] = [
  { key: "basics", label: "The Basics", description: "Name and what kind of place" },
  { key: "location", label: "Location", description: "Address" },
  { key: "hours", label: "Hours", description: "When you're open" },
  { key: "branding", label: "Style", description: "Tagline, description, and your color" },
  { key: "offerings", label: "What You Offer", description: "Check the things we listed for you" },
  { key: "knowledge", label: "Teach the AI", description: "Tell it things visitors should know" },
  { key: "photos", label: "Photos", description: "Upload at least one photo" },
  { key: "xp", label: "Rewards", description: "Check your points and levels" },
  { key: "stripe", label: "Payments", description: "Connect Stripe so people can pay you" },
];

interface OnboardingChecklistProps {
  checklist: ChecklistState;
  currentItem: keyof ChecklistState | null;
  onItemClick: (key: keyof ChecklistState) => void;
  onSubmit: () => void;
  submitting?: boolean;
}

export function OnboardingChecklist({ checklist, currentItem, onItemClick, onSubmit, submitting }: OnboardingChecklistProps) {
  const completed = Object.values(checklist).filter(Boolean).length;
  const total = CHECKLIST_ITEMS.length;
  const percent = Math.round((completed / total) * 100);
  const canSubmit = checklist.stripe === true;

  return (
    <div className="px-4 py-3">
      {/* Progress bar */}
      <div className="mb-1 flex items-center justify-between">
        <span className="font-sans text-[11px] font-semibold text-white/40">Setup Progress</span>
        <span className="font-sans text-[11px] font-bold text-orange">{completed} of {total}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
        <motion.div
          className="h-full rounded-full bg-orange"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {CHECKLIST_ITEMS.map(({ key, label, description }) => {
          const done = checklist[key];
          const active = currentItem === key;

          return (
            <button
              key={key}
              onClick={() => onItemClick(key)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
              style={{
                backgroundColor: active ? "rgba(249,115,22,0.08)" : "transparent",
                border: active ? "1px solid rgba(249,115,22,0.2)" : "1px solid transparent",
              }}
            >
              {/* Check circle */}
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition"
                style={{
                  backgroundColor: done ? "#F97316" : "rgba(255,255,255,0.06)",
                  border: done ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-sans text-[13px] font-medium ${done ? "text-white/40 line-through" : "text-white/80"}`}>
                  {label}
                </p>
                <p className="font-sans text-[10px] text-white/25 truncate">{description}</p>
              </div>

              {key === "stripe" && !done && (
                <span className="shrink-0 rounded-md px-1.5 py-0.5 font-sans text-[9px] font-bold text-orange" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
                  REQUIRED
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      <div className="mt-4">
        <button
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-xl py-3 font-sans text-[14px] font-bold transition active:scale-[0.98] disabled:opacity-30"
          style={{
            backgroundColor: canSubmit ? "#F97316" : "rgba(255,255,255,0.06)",
            color: canSubmit ? "#000" : "rgba(255,255,255,0.3)",
          }}
        >
          {submitting ? "Submitting..." : canSubmit ? "Submit for Review" : "Connect Stripe to Submit"}
        </button>
      </div>
    </div>
  );
}

export { CHECKLIST_ITEMS };
