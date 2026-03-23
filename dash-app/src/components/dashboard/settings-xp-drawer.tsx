"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  addXpAction,
  deleteXpAction,
  toggleXpAction,
  addXpMilestone,
  deleteXpMilestone,
  applyXpTemplate,
  saveCustomTemplate,
  deleteCustomTemplate,
} from "@/app/settings/actions";

// ─── Constants ────────────────────────────────────────────────────

const XP_ACTION_PRESETS = [
  { action: "visit", label: "Visit", points: 50, description: "Earn XP every time you visit" },
  { action: "first_visit", label: "First Visit", points: 100, description: "Bonus XP for your first visit" },
  { action: "order", label: "Place an Order", points: 25, description: "Earn XP when you order" },
  { action: "referral", label: "Refer a Friend", points: 200, description: "Bring someone new" },
  { action: "event_attend", label: "Attend an Event", points: 75, description: "Show up to a venue event" },
  { action: "review", label: "Leave a Review", points: 50, description: "Share your experience" },
  { action: "membership", label: "Become a Member", points: 300, description: "Join the membership program" },
  { action: "challenge", label: "Complete a Challenge", points: 150, description: "Finish a venue challenge" },
];

const MILESTONE_COLORS = ["#4ade80", "#facc15", "#f97316", "#a78bfa", "#f87171", "#60a5fa", "#34d399", "#fb923c"];

interface XpTemplate {
  name: string;
  venueType: string;
  actions: { action: string; label: string; points: number; description: string; max_per_day?: number }[];
  milestones: { name: string; threshold: number; color: string; reward: string; perks: string[] }[];
}

const XP_TEMPLATES: XpTemplate[] = [
  {
    name: "Coffee Shop",
    venueType: "cafe",
    actions: [
      { action: "visit", label: "Visit", points: 30, description: "Earn XP every visit" },
      { action: "first_visit", label: "First Visit", points: 100, description: "Welcome bonus" },
      { action: "order", label: "Buy a Drink", points: 15, description: "Every drink counts", max_per_day: 5 },
      { action: "referral", label: "Bring a Friend", points: 75, description: "Introduce someone new" },
      { action: "review", label: "Leave a Review", points: 50, description: "Share your experience", max_per_day: 1 },
    ],
    milestones: [
      { name: "Newcomer", threshold: 0, color: "#94a3b8", reward: "Welcome to the fam", perks: [] },
      { name: "Regular", threshold: 200, color: "#4ade80", reward: "Free drip coffee", perks: ["Free drip coffee", "Birthday drink"] },
      { name: "Loyal", threshold: 600, color: "#facc15", reward: "10% off all drinks", perks: ["10% off drinks", "Early access to new menu", "Name on the wall"] },
      { name: "OG", threshold: 1500, color: "#f97316", reward: "Free specialty drink monthly", perks: ["Free specialty drink/month", "Priority seating", "Invite to tastings"] },
    ],
  },
  {
    name: "Bar / Lounge",
    venueType: "bar",
    actions: [
      { action: "visit", label: "Pull Up", points: 50, description: "Show face, earn XP" },
      { action: "first_visit", label: "First Night", points: 150, description: "Welcome to the spot" },
      { action: "order", label: "Order a Round", points: 20, description: "Every tab counts", max_per_day: 3 },
      { action: "event_attend", label: "Event Night", points: 100, description: "Show up to an event" },
      { action: "referral", label: "Bring the Squad", points: 200, description: "Your crew = your points" },
      { action: "membership", label: "Go Member", points: 500, description: "Lock in membership" },
    ],
    milestones: [
      { name: "Guest", threshold: 0, color: "#94a3b8", reward: "You're in", perks: [] },
      { name: "Regular", threshold: 300, color: "#4ade80", reward: "Skip the line", perks: ["Skip the line", "Happy hour pricing anytime"] },
      { name: "VIP", threshold: 1000, color: "#f97316", reward: "Reserved booth priority", perks: ["Booth priority", "Comp drink on birthdays", "VIP area access"] },
      { name: "Legend", threshold: 3000, color: "#a78bfa", reward: "You run this place", perks: ["Permanent reserved spot", "Guest list +2", "Bottle service discount", "Name on the wall"] },
    ],
  },
  {
    name: "Restaurant",
    venueType: "restaurant",
    actions: [
      { action: "visit", label: "Dine In", points: 40, description: "Every meal matters" },
      { action: "first_visit", label: "First Meal", points: 120, description: "Welcome bonus" },
      { action: "order", label: "Order", points: 10, description: "Per menu item ordered", max_per_day: 10 },
      { action: "referral", label: "Recommend Us", points: 150, description: "Send a friend our way" },
      { action: "review", label: "Write a Review", points: 60, description: "Tell people about us", max_per_day: 1 },
      { action: "event_attend", label: "Special Event", points: 80, description: "Wine dinner, tasting, etc." },
    ],
    milestones: [
      { name: "Diner", threshold: 0, color: "#94a3b8", reward: "Welcome", perks: [] },
      { name: "Foodie", threshold: 250, color: "#4ade80", reward: "Free appetizer", perks: ["Free appetizer", "Priority reservations"] },
      { name: "Connoisseur", threshold: 800, color: "#facc15", reward: "Chef's table access", perks: ["Chef's table access", "15% off", "Secret menu items"] },
      { name: "Family", threshold: 2000, color: "#f97316", reward: "You're part of the family", perks: ["Comp dessert every visit", "Private dining priority", "Annual dinner on us"] },
    ],
  },
  {
    name: "Coworking Space",
    venueType: "coworking",
    actions: [
      { action: "visit", label: "Check In", points: 25, description: "Show up and grind" },
      { action: "first_visit", label: "First Day", points: 100, description: "Welcome to the space" },
      { action: "referral", label: "Invite a Coworker", points: 200, description: "Grow the community" },
      { action: "event_attend", label: "Attend a Meetup", points: 75, description: "Networking events, workshops" },
      { action: "membership", label: "Get a Desk", points: 300, description: "Lock in a membership" },
      { action: "challenge", label: "Ship Something", points: 150, description: "Complete a build challenge" },
    ],
    milestones: [
      { name: "Visitor", threshold: 0, color: "#94a3b8", reward: "Day pass access", perks: [] },
      { name: "Regular", threshold: 200, color: "#4ade80", reward: "Free coffee forever", perks: ["Free coffee", "Locker access"] },
      { name: "Builder", threshold: 700, color: "#60a5fa", reward: "Meeting room credits", perks: ["2hr meeting room/week", "Mail handling", "Community Slack"] },
      { name: "Resident", threshold: 2000, color: "#a78bfa", reward: "24/7 access", perks: ["24/7 keycard", "Dedicated desk", "Event hosting rights", "Mentorship priority"] },
    ],
  },
  {
    name: "Club / Nightlife",
    venueType: "club",
    actions: [
      { action: "visit", label: "Show Up", points: 60, description: "Every night counts" },
      { action: "first_visit", label: "First Night Out", points: 200, description: "Welcome to the scene" },
      { action: "order", label: "Order Bottles", points: 50, description: "Big spender energy", max_per_day: 3 },
      { action: "referral", label: "Bring the Crew", points: 250, description: "Squad up" },
      { action: "event_attend", label: "Headliner Night", points: 120, description: "Special events and shows" },
    ],
    milestones: [
      { name: "Rookie", threshold: 0, color: "#94a3b8", reward: "General admission", perks: [] },
      { name: "Regular", threshold: 400, color: "#4ade80", reward: "Skip the line", perks: ["Skip the line", "Cover charge waived"] },
      { name: "VIP", threshold: 1200, color: "#f97316", reward: "Booth access", perks: ["VIP booth access", "Comp bottle on birthday", "Early entry"] },
      { name: "Icon", threshold: 4000, color: "#a78bfa", reward: "You are the party", perks: ["Permanent VIP", "Guest list +4", "Green room access", "First picks on all events"] },
    ],
  },
  {
    name: "Lounge / Speakeasy",
    venueType: "lounge",
    actions: [
      { action: "visit", label: "Visit", points: 40, description: "Low key, high value" },
      { action: "first_visit", label: "Discovery", points: 120, description: "You found us" },
      { action: "order", label: "Order a Cocktail", points: 20, description: "Every drink earns", max_per_day: 4 },
      { action: "referral", label: "Whisper to a Friend", points: 150, description: "Keep it exclusive" },
      { action: "review", label: "Rate the Vibe", points: 40, description: "Share the atmosphere" },
    ],
    milestones: [
      { name: "Passerby", threshold: 0, color: "#94a3b8", reward: "You're in the know", perks: [] },
      { name: "Insider", threshold: 300, color: "#4ade80", reward: "Signature drink on us", perks: ["Free signature drink", "Off-menu access"] },
      { name: "Confidant", threshold: 900, color: "#facc15", reward: "Private room access", perks: ["Private room booking", "Bartender's choice", "Secret events invite"] },
      { name: "Patron", threshold: 2500, color: "#a78bfa", reward: "Lifetime perks", perks: ["Permanent reserved seat", "Custom cocktail named after you", "Annual tasting dinner", "Key to the back door"] },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────

interface XpAction {
  id?: string;
  action?: string;
  label: string;
  points: number;
  description?: string;
  max_per_day?: number;
  active?: boolean;
}

interface XpMilestone {
  id?: string;
  name: string;
  threshold: number;
  reward?: string | null;
  perks?: string[] | string | null;
  color?: string | null;
}

interface CustomTemplate {
  id: string;
  name: string;
  actions: XpTemplate["actions"];
  milestones: XpTemplate["milestones"];
}

export interface SettingsXpDrawerProps {
  venueId: string;
  venueType?: string;
  initialXpActions: XpAction[];
  initialXpMilestones: XpMilestone[];
  customTemplates?: CustomTemplate[];
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────

export function SettingsXpDrawer({
  venueId,
  venueType = "",
  initialXpActions,
  initialXpMilestones,
  customTemplates: initialCustomTemplates = [],
  onClose,
}: SettingsXpDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [selectedColor, setSelectedColor] = useState(MILESTONE_COLORS[0]);
  const [showTemplates, setShowTemplates] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const thresholdRef = useRef<HTMLInputElement>(null);
  const rewardRef = useRef<HTMLInputElement>(null);
  const perksRef = useRef<HTMLInputElement>(null);

  const xpActions = initialXpActions;
  const xpMilestones = initialXpMilestones;
  const customTemplates = initialCustomTemplates;

  const hasRoadmap = xpActions.length > 0 || xpMilestones.length > 0;

  const primary = XP_TEMPLATES.filter((t) => t.venueType === venueType);
  const others = XP_TEMPLATES.filter((t) => t.venueType !== venueType);
  const allTemplates = [...primary, ...others];

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2000);
  }

  async function handleAddMilestone() {
    const name = nameRef.current?.value;
    const threshold = thresholdRef.current?.value;
    if (!name || !threshold) return;
    setSaving(true);
    await addXpMilestone({
      name,
      threshold: parseInt(threshold),
      color: selectedColor,
      reward: rewardRef.current?.value || undefined,
      perks: perksRef.current?.value
        ? perksRef.current.value.split(",").map((p) => p.trim()).filter(Boolean)
        : undefined,
    });
    if (nameRef.current) nameRef.current.value = "";
    if (thresholdRef.current) thresholdRef.current.value = "";
    if (rewardRef.current) rewardRef.current.value = "";
    if (perksRef.current) perksRef.current.value = "";
    setSaving(false);
    flash("Level added");
  }

  async function handleApplyTemplate(t: XpTemplate | CustomTemplate) {
    if (hasRoadmap && !confirm(`Apply "${t.name}"? This will replace your current roadmap.`)) return;
    setSaving(true);
    await applyXpTemplate(
      t.actions as XpTemplate["actions"],
      t.milestones as XpTemplate["milestones"],
    );
    setSaving(false);
    flash("Template applied");
  }

  const milestonePerks = (m: XpMilestone): string[] => {
    if (!m.perks) return [];
    if (Array.isArray(m.perks)) return m.perks;
    return [];
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="xp-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <motion.div
        key="xp-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-lg flex-col border-l border-gray-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <div>
              <p className="font-sans text-[16px] font-bold text-gray-900">Loyalty Rewards</p>
              <p className="font-sans text-[11px] text-gray-400">XP actions, levels & templates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {msg && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-full bg-green-50 px-3 py-1 font-sans text-[11px] font-semibold text-green-600"
                >
                  {msg}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {/* ── Templates toggle ── */}
          <div>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 transition hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
                <span className="font-sans text-[13px] font-semibold text-gray-700">
                  {hasRoadmap ? "Templates" : "Start with a template"}
                </span>
              </div>
              <motion.svg
                animate={{ rotate: showTemplates ? 180 : 0 }}
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </motion.svg>
            </button>

            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    {/* Save as template */}
                    {hasRoadmap && (
                      <button
                        onClick={async () => {
                          const name = prompt("Name this template:");
                          if (!name) return;
                          setSaving(true);
                          await saveCustomTemplate(
                            name,
                            xpActions.map((a) => ({ action: a.action || "", label: a.label, points: a.points, description: a.description, max_per_day: a.max_per_day })),
                            xpMilestones.map((m) => ({ name: m.name, threshold: m.threshold, color: m.color || "#f97316", reward: m.reward, perks: milestonePerks(m) })),
                          );
                          setSaving(false);
                          flash("Template saved!");
                        }}
                        disabled={saving}
                        className="w-full rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 font-sans text-[12px] font-semibold text-violet-600 transition hover:bg-violet-100 active:scale-[0.98] disabled:opacity-40"
                      >
                        Save current roadmap as template
                      </button>
                    )}

                    {/* Custom saved templates */}
                    {customTemplates.length > 0 && (
                      <div>
                        <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-300">Your Templates</p>
                        <div className="flex flex-wrap gap-2">
                          {customTemplates.map((t) => (
                            <div key={t.id} className="flex items-center gap-1">
                              <button
                                onClick={() => handleApplyTemplate(t)}
                                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 font-sans text-[12px] font-medium text-violet-600 transition hover:bg-violet-100 active:scale-95"
                              >
                                {t.name}
                              </button>
                              <button
                                onClick={async () => { await deleteCustomTemplate(t.id); }}
                                className="rounded p-1 text-gray-300 hover:text-red-500"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Built-in templates */}
                    {primary.length > 0 && (
                      <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-300">Recommended for your hub</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {allTemplates.map((t) => {
                        const isRecommended = primary.includes(t);
                        return (
                          <button
                            key={t.name}
                            onClick={() => handleApplyTemplate(t)}
                            disabled={saving}
                            className="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition active:scale-[0.98] disabled:opacity-40"
                            style={{
                              borderColor: isRecommended ? "#fdba7440" : "#e5e7eb",
                              backgroundColor: isRecommended ? "#fff7ed" : "#fafafa",
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-sans text-[13px] font-semibold" style={{ color: isRecommended ? "#ea580c" : "#374151" }}>
                                {t.name}
                              </span>
                              {isRecommended && (
                                <span className="rounded px-1.5 py-0.5 bg-orange-100 font-sans text-[8px] font-bold text-orange-600">
                                  MATCH
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-sans text-[9px] text-gray-400">
                                {t.actions.length} actions
                              </span>
                              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-sans text-[9px] text-gray-400">
                                {t.milestones.length} tiers
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {t.milestones.map((m) => (
                                <div key={m.name} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── XP Actions ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-sans text-[13px] font-semibold text-gray-700">How guests earn points</h3>
              <span className="rounded-full bg-green-50 px-2.5 py-0.5 font-sans text-[10px] font-semibold text-green-600">
                {xpActions.length} active
              </span>
            </div>

            {/* Existing actions */}
            <div className="space-y-2 mb-3">
              {xpActions.map((a) => (
                <motion.div
                  key={a.id || a.label}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: a.active !== false ? "#fff7ed" : "#f9fafb" }}
                  >
                    <span className="font-mono text-[13px] font-bold" style={{ color: a.active !== false ? "#f97316" : "#d1d5db" }}>
                      +{a.points}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[13px] font-semibold text-gray-800">{a.label}</p>
                    {a.description && <p className="font-sans text-[11px] text-gray-400">{a.description}</p>}
                    {a.max_per_day && <p className="font-sans text-[10px] text-gray-300">Max {a.max_per_day}x per day</p>}
                  </div>
                  {a.id && (
                    <>
                      <button
                        onClick={async () => { await toggleXpAction(a.id!, a.active === false); }}
                        className="shrink-0 rounded-lg px-2.5 py-1 font-sans text-[10px] font-semibold transition"
                        style={{
                          backgroundColor: a.active !== false ? "#f0fdf4" : "#f9fafb",
                          color: a.active !== false ? "#16a34a" : "#9ca3af",
                          border: `1px solid ${a.active !== false ? "#bbf7d0" : "#e5e7eb"}`,
                        }}
                      >
                        {a.active !== false ? "Active" : "Paused"}
                      </button>
                      <button
                        onClick={async () => { await deleteXpAction(a.id!); }}
                        className="shrink-0 rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      </button>
                    </>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Preset grid */}
            <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-300">Tap to add</p>
            <div className="grid grid-cols-4 gap-2">
              {XP_ACTION_PRESETS.map((preset) => {
                const exists = xpActions.some((a) => a.action === preset.action || a.label === preset.label);
                return (
                  <button
                    key={preset.action}
                    disabled={exists}
                    onClick={async () => {
                      setSaving(true);
                      await addXpAction(preset);
                      setSaving(false);
                      flash("Action added");
                    }}
                    className="flex flex-col items-center gap-1 rounded-xl border p-2.5 font-sans text-[10px] font-medium transition active:scale-95 disabled:opacity-30"
                    style={{
                      borderColor: exists ? "#bbf7d0" : "#e5e7eb",
                      backgroundColor: exists ? "#f0fdf4" : "#fafafa",
                      color: exists ? "#16a34a" : "#6b7280",
                    }}
                  >
                    <span className="font-mono text-[11px] font-bold text-orange-500">+{preset.points}</span>
                    <span className="text-center leading-tight">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Milestones / Visual Roadmap ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-sans text-[13px] font-semibold text-gray-700">Levels guests unlock</h3>
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 font-sans text-[10px] font-semibold text-violet-600">
                {xpMilestones.length} levels
              </span>
            </div>

            {/* Visual roadmap */}
            {xpMilestones.length > 0 && (
              <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <div className="relative">
                  {/* Track line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  {xpMilestones.map((m, i) => {
                    const color = m.color || "#f97316";
                    const perks = milestonePerks(m);
                    return (
                      <motion.div
                        key={m.id || m.name}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="relative flex items-start gap-4 pb-5 last:pb-0"
                      >
                        {/* Node */}
                        <div
                          className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${color}18`, border: `2px solid ${color}60` }}
                        >
                          <span className="font-mono text-[10px] font-bold" style={{ color }}>{i + 1}</span>
                        </div>
                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="font-sans text-[14px] font-bold" style={{ color }}>{m.name}</span>
                            <span className="font-mono text-[11px] text-gray-300">{m.threshold.toLocaleString()} XP</span>
                          </div>
                          {m.reward && <p className="mt-0.5 font-sans text-[12px] text-gray-400">{m.reward}</p>}
                          {perks.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {perks.map((p) => (
                                <span
                                  key={p}
                                  className="rounded-md px-2 py-0.5 font-sans text-[10px]"
                                  style={{ backgroundColor: `${color}10`, color: `${color}cc`, border: `1px solid ${color}20` }}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Delete */}
                        {m.id && (
                          <button
                            onClick={async () => { await deleteXpMilestone(m.id!); }}
                            className="shrink-0 rounded-lg p-1.5 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add milestone form */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="mb-3 font-sans text-[10px] font-semibold uppercase tracking-wider text-gray-300">Add a level</p>
              <div className="flex flex-col gap-2.5">
                <div className="flex gap-2">
                  <input
                    ref={nameRef}
                    placeholder="Level name (e.g. Regular, VIP)"
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 placeholder:text-gray-300 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                  />
                  <input
                    ref={thresholdRef}
                    type="number"
                    placeholder="Points needed"
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 placeholder:text-gray-300 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                  />
                </div>
                <input
                  ref={rewardRef}
                  placeholder="What do they get? (e.g. Free coffee every visit)"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 placeholder:text-gray-300 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                />
                <input
                  ref={perksRef}
                  placeholder="Extra perks, separated by commas"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 placeholder:text-gray-300 focus:border-orange-300 focus:outline-none focus:ring-1 focus:ring-orange-200"
                />
                {/* Color picker */}
                <div className="flex items-center gap-2">
                  <span className="font-sans text-[11px] text-gray-400">Color:</span>
                  {MILESTONE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className="h-5 w-5 rounded-full transition"
                      style={{
                        backgroundColor: c,
                        boxShadow: selectedColor === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAddMilestone}
                  disabled={saving}
                  className="mt-1 rounded-xl bg-orange-500 px-5 py-2.5 font-sans text-[13px] font-bold text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Add Level"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
