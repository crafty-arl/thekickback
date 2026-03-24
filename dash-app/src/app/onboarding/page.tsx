"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createVenue } from "./actions";

const PLACE_TYPES = [
  { value: "bar", label: "Bar", icon: "🍸" },
  { value: "restaurant", label: "Restaurant", icon: "🍽" },
  { value: "cafe", label: "Cafe", icon: "☕" },
  { value: "lounge", label: "Lounge", icon: "🛋" },
  { value: "club", label: "Club", icon: "🎵" },
  { value: "barbershop", label: "Barbershop", icon: "💈" },
  { value: "nail_salon", label: "Nail Salon", icon: "💅" },
  { value: "coworking", label: "Coworking", icon: "💻" },
  { value: "salon", label: "Salon", icon: "✂️" },
  { value: "gym", label: "Gym", icon: "🏋️" },
  { value: "group", label: "Group", icon: "👥" },
  { value: "community", label: "Community", icon: "🌍" },
  { value: "league", label: "League", icon: "🏆" },
  { value: "org", label: "Organization", icon: "🏛" },
  { value: "artist", label: "Artist", icon: "🎨" },
  { value: "musician", label: "Musician", icon: "🎸" },
  { value: "creator", label: "Creator", icon: "✦" },
  { value: "other", label: "Other", icon: "📍" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);
    setStatus(msg);
  };

  const canSubmit = name.trim() && type && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    setLogs([]);

    log("Creating your place...");

    try {
      log("Geocoding address...");
      const result = await createVenue({
        name: name.trim(),
        type,
        address: address.trim(),
        description: description.trim(),
        maxOccupancy: 100,
        hours: "",
        tagline: "",
      });

      if (result?.error) {
        log(`Error: ${result.error}`);
        setError(result.error);
        setSaving(false);
        return;
      }

      if (result?.ok) {
        log("Venue created successfully");
        log("AI is generating offerings, XP, milestones, perks...");
        log(`Slug: ${result.slug}`);
        log("Redirecting to dashboard...");

        // Give AI setup a moment to start, then redirect
        setTimeout(() => router.push("/"), 1500);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      log(`Exception: ${msg}`);
      setError(msg);
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Image src="/logo.png" alt="theKickBack" width={500} height={250} className="h-8 w-auto" priority />
        </div>

        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="font-sans text-[22px] font-bold text-white">Add your place</h1>
          <p className="mt-1 font-sans text-[13px] text-white/40">
            A barbershop, a running club, a musician's studio — if people go there, it's a place.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold text-white/30">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What's it called?"
              maxLength={60}
              autoFocus
              disabled={saving}
              className="w-full px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 outline-none disabled:opacity-50"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Type */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold text-white/30">Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PLACE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => !saving && setType(t.value)}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-2.5 font-sans text-[12px] font-medium transition active:scale-[0.97] disabled:opacity-50"
                  style={{
                    backgroundColor: type === t.value ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                    color: type === t.value ? "#F97316" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${type === t.value ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <span className="text-[14px]">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold text-white/30">Address <span className="text-white/15">(optional for virtual/mobile)</span></label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Austin TX"
              disabled={saving}
              className="w-full px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 outline-none disabled:opacity-50"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold text-white/30">Description <span className="text-white/15">(helps AI generate your page)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes your place special? What do people come for?"
              rows={3}
              maxLength={300}
              disabled={saving}
              className="w-full resize-none px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 outline-none disabled:opacity-50"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            <p className="mt-1 text-right font-sans text-[10px] text-white/15">{description.length}/300</p>
          </div>

          {error && (
            <p className="font-sans text-[13px] text-red-400 text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 font-sans text-[14px] font-bold text-black transition active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "#F97316" }}
          >
            {saving ? "Setting up..." : "Create Place"}
          </button>

          <p className="text-center font-sans text-[11px] text-white/20">
            We'll auto-generate your offerings, rewards, and AI — you can edit everything from the dashboard.
          </p>
        </form>

        {/* Status / Debug Log */}
        {logs.length > 0 && (
          <div className="mt-6 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="mb-2 font-sans text-[10px] font-semibold text-white/25">STATUS</p>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {logs.map((l, i) => (
                <p key={i} className="font-mono text-[11px] text-white/40">
                  {l}
                </p>
              ))}
              {saving && (
                <p className="font-mono text-[11px] text-orange-400 animate-pulse">
                  {status}...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
