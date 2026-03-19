"use client";

import { useState } from "react";
import Image from "next/image";
import { createVenue } from "./actions";

const TYPES = ["Bar", "Restaurant", "Lounge", "Club", "Cafe", "Coworking", "Barbershop", "Nail Salon", "Other"];

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    type: "",
    address: "",
    maxOccupancy: "",
    hours: "",
    tagline: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.type) {
      setError("Venue name and type are required.");
      return;
    }
    setError("");
    setLoading(true);

    const result = await createVenue({
      ...form,
      maxOccupancy: parseInt(form.maxOccupancy) || 100,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4" style={{ backgroundColor: "#000" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Image src="/logo.png" alt="theKickBack" width={140} height={46} className="h-9 w-auto" />
        </div>

        <h1 className="mb-1 text-center font-sans text-[24px] font-bold text-white">Set up your venue</h1>
        <p className="mb-8 text-center font-sans text-[14px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          Takes about 30 seconds. You can edit everything later.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Venue Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="The Rooftop"
              className="rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Type *</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update("type", t.toLowerCase())}
                  className="rounded-lg border px-3 py-1.5 font-sans text-[13px] font-medium transition active:scale-95"
                  style={{
                    backgroundColor: form.type === t.toLowerCase() ? "rgba(249,115,22,0.15)" : "transparent",
                    borderColor: form.type === t.toLowerCase() ? "#F97316" : "rgba(255,255,255,0.08)",
                    color: form.type === t.toLowerCase() ? "#F97316" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder="123 Main St, City, State"
              className="rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            />
          </div>

          {/* Capacity + Hours — side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Capacity</label>
              <input
                type="number"
                value={form.maxOccupancy}
                onChange={(e) => update("maxOccupancy", e.target.value)}
                placeholder="100"
                min={1}
                className="rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Hours</label>
              <input
                type="text"
                value={form.hours}
                onChange={(e) => update("hours", e.target.value)}
                placeholder="4pm–12am"
                className="rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              />
            </div>
          </div>

          {/* Tagline */}
          <div className="flex flex-col gap-1.5">
            <label className="font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="A rooftop for people who pay attention"
              maxLength={80}
              className="rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 focus:outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
            />
          </div>

          {error && (
            <p className="rounded-lg px-3 py-2 text-center font-sans text-[13px]" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {loading ? "Creating..." : "Create Venue"}
          </button>

          <p className="text-center font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            You can edit all details later from the dashboard.
          </p>
        </form>
      </div>
    </main>
  );
}
