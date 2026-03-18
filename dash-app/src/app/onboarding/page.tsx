"use client";

import { useState } from "react";
import Image from "next/image";
import { createVenue } from "./actions";

const CATEGORIES = [
  "Bar",
  "Restaurant",
  "Lounge",
  "Club",
  "Cafe",
  "Coworking",
  "Other",
];

const VIBES = ["Chill", "Energetic", "Upscale", "Casual", "Creative"];

const STEPS = ["Basics", "Location", "Details", "Description"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "",
    address: "",
    neighborhood: "",
    maxOccupancy: "",
    openTime: "",
    closeTime: "",
    tagline: "",
    description: "",
    vibe: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function next() {
    if (step === 0 && !form.name) {
      setError("Venue name is required");
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
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
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.png"
            alt="theKickBack"
            width={160}
            height={53}
            className="h-10 w-auto"
            priority
          />
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-8">
          {/* Step indicator */}
          <div className="mb-6 flex items-center justify-between">
            <span className="text-xs font-medium text-black/40">
              Step {step + 1} of {STEPS.length}
            </span>
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i <= step ? "bg-orange" : "bg-black/10"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Step 1: Basics */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-dark">
                  Let&apos;s set up your venue
                </h2>
                <p className="mt-1 text-sm text-black/45">
                  Start with the basics.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Venue Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="The Rooftop"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => update("category", cat.toLowerCase())}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        form.category === cat.toLowerCase()
                          ? "border-orange bg-orange/10 text-orange"
                          : "border-black/10 text-black/50 hover:border-black/20"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-dark">
                  Where are you located?
                </h2>
                <p className="mt-1 text-sm text-black/45">
                  Help guests find you.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="123 Main St"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Neighborhood
                </label>
                <input
                  type="text"
                  placeholder="Downtown"
                  value={form.neighborhood}
                  onChange={(e) => update("neighborhood", e.target.value)}
                  className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>
            </div>
          )}

          {/* Step 3: Capacity & Hours */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-dark">
                  Capacity & hours
                </h2>
                <p className="mt-1 text-sm text-black/45">
                  Set your limits and schedule.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Max Occupancy
                </label>
                <input
                  type="number"
                  placeholder="100"
                  min={1}
                  value={form.maxOccupancy}
                  onChange={(e) => update("maxOccupancy", e.target.value)}
                  className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-black/60">
                    Opens at
                  </label>
                  <input
                    type="time"
                    value={form.openTime}
                    onChange={(e) => update("openTime", e.target.value)}
                    className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-black/60">
                    Closes at
                  </label>
                  <input
                    type="time"
                    value={form.closeTime}
                    onChange={(e) => update("closeTime", e.target.value)}
                    className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Description */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-dark">
                  Describe your vibe
                </h2>
                <p className="mt-1 text-sm text-black/45">
                  This shows up on your public page.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Tagline
                </label>
                <input
                  type="text"
                  placeholder="A rooftop for people who pay attention"
                  maxLength={80}
                  value={form.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                  className="rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Description
                </label>
                <textarea
                  placeholder="Tell guests what to expect..."
                  maxLength={200}
                  rows={3}
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                  className="resize-none rounded-xl border border-black/10 px-4 py-3 font-sans text-sm outline-none transition focus:border-orange focus:ring-2 focus:ring-orange/20"
                />
                <span className="text-right text-xs text-black/30">
                  {form.description.length}/200
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-black/60">
                  Vibe
                </label>
                <div className="flex flex-wrap gap-2">
                  {VIBES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => update("vibe", v.toLowerCase())}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        form.vibe === v.toLowerCase()
                          ? "border-orange bg-orange/10 text-orange"
                          : "border-black/10 text-black/50 hover:border-black/20"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-4 text-center text-sm text-red-500">{error}</p>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={back}
                className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-medium text-black/60 transition hover:border-black/20"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="rounded-xl bg-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange/90"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !form.name}
                className="rounded-xl bg-orange px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange/90 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Venue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
