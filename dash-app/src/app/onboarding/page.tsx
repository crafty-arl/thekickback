"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createVenue } from "./actions";

interface PlaceResult {
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviewCount: number | null;
  googlePlaceId: string | null;
  unclaimedVenueId: string | null;
}

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

const GOOGLE_CATEGORY_MAP: Record<string, string> = {
  "Bar": "bar", "Cocktail bar": "bar", "Wine bar": "bar", "Pub": "bar", "Brewery": "bar",
  "Restaurant": "restaurant", "Cafe": "cafe", "Coffee shop": "cafe", "Bakery": "cafe",
  "Night club": "club", "Lounge": "lounge",
  "Barber shop": "barbershop", "Hair salon": "salon", "Nail salon": "nail_salon", "Beauty salon": "salon",
  "Gym": "gym", "Fitness center": "gym",
  "Coworking space": "coworking",
};

function mapGoogleCategory(googleCat: string): string {
  for (const [key, val] of Object.entries(GOOGLE_CATEGORY_MAP)) {
    if (googleCat.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return "other";
}

export default function OnboardingPage() {
  return <Suspense><OnboardingContent /></Suspense>;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [googleImported, setGoogleImported] = useState(false);
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [googleLocations, setGoogleLocations] = useState<{ googleName: string; name: string; address: string; phone: string; category: string; hours: string; website: string; description: string }[]>([]);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Parse Google Business data from callback URL
  useEffect(() => {
    const googleData = searchParams.get("google_data");
    const googleError = searchParams.get("google_error");
    if (googleError) {
      const msg = googleError === "denied" ? "Google access denied"
        : googleError === "no_account" ? "No Google Business account found — your Business Profile API access may still be pending approval from Google"
        : googleError === "token_failed" ? "Google authentication failed — try again"
        : googleError === "locations_failed" ? "Could not load your business locations — API access may be pending approval"
        : `Google error: ${googleError}`;
      setError(msg);
      // Clean URL so error doesn't persist on refresh
      router.replace("/onboarding", { scroll: false });
    }
    if (googleData) {
      try {
        const decoded = JSON.parse(atob(googleData));
        if (Array.isArray(decoded) && decoded.length > 0) {
          setGoogleLocations(decoded);
          // Auto-fill from first location
          const loc = decoded[0];
          setName(loc.name || "");
          setAddress(loc.address || "");
          setDescription(loc.description || "");
          setType(mapGoogleCategory(loc.category));
          setGoogleImported(true);
        }
      } catch { /* ignore parse errors */ }
      // Clean URL
      router.replace("/onboarding", { scroll: false });
    }
  }, [searchParams, router]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced place search
  useEffect(() => {
    if (address.length < 3) { setPlaceResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      try {
        const q = name ? `${name} ${address}` : address;
        const res = await fetch(`/api/places-search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setPlaceResults(data.results || []);
          setShowResults(true);
        }
      } catch {}
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [address, name]);

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

    log("Creating your spot...");

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
        claimVenueId: selectedPlace?.unclaimedVenueId || undefined,
      });

      if (result?.error) {
        log(`Error: ${result.error}`);
        setError(result.error);
        setSaving(false);
        return;
      }

      if (result?.ok) {
        log("Venue created successfully");
        log(`Slug: ${result.slug}`);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ai = result.ai as any;
        if (ai?.errors?.length) {
          for (const err of ai.errors) log(`AI warning: ${err}`);
        }
        if (ai?.offerings) log(`Generated ${ai.offerings} offerings`);
        if (ai?.xpActions) log(`Generated ${ai.xpActions} XP actions`);
        if (ai?.milestones) log(`Generated ${ai.milestones} milestones`);
        if (ai?.perks) log(`Generated ${ai.perks} perks`);
        if (ai?.error) log(`AI setup error: ${ai.error}`);

        log("Redirecting to dashboard...");
        setTimeout(() => router.push("/"), 2000);
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
          <h1 className="font-sans text-[22px] font-bold text-white">Add your spot</h1>
          <p className="mt-1 font-sans text-[13px] text-white/40">
            A barbershop, a running club, a musician's studio — if people go there, it's a spot.
          </p>
        </div>

        {/* Google Business import */}
        {!googleImported ? (
          <div className="mb-4">
            <a
              href="/api/auth/google"
              className="flex w-full items-center justify-center gap-3 rounded-lg py-3 font-sans text-[14px] font-semibold text-white transition active:scale-[0.98]"
              style={{ backgroundColor: "rgba(66,133,244,0.15)", border: "1px solid rgba(66,133,244,0.3)", color: "#4285F4" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Connect Google Business
            </a>
            <p className="mt-2 text-center font-sans text-[10px] text-white/20">Import your name, address, hours, and description automatically</p>
            {error && error.includes("Google") && (
              <div className="mt-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                <p className="text-center font-sans text-[11px]" style={{ color: "#F97316" }}>{error}</p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-3">
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
              <span className="font-sans text-[10px] text-white/20">or fill in manually</span>
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
            </div>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(66,133,244,0.08)", border: "1px solid rgba(66,133,244,0.2)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            <span className="font-sans text-[12px] font-semibold" style={{ color: "#4285F4" }}>Imported from Google Business</span>
            {googleLocations.length > 1 && (
              <select
                onChange={(e) => {
                  const loc = googleLocations[parseInt(e.target.value)];
                  if (loc) {
                    setName(loc.name); setAddress(loc.address); setDescription(loc.description);
                    setType(mapGoogleCategory(loc.category));
                  }
                }}
                className="ml-auto rounded px-2 py-1 font-sans text-[10px] text-white/60 outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {googleLocations.map((loc, i) => (
                  <option key={i} value={i}>{loc.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

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

          {/* Address with autocomplete */}
          <div className="relative">
            <label className="mb-1.5 block font-sans text-[11px] font-semibold text-white/30">Address <span className="text-white/15">(optional for virtual/mobile)</span></label>
            <input
              type="text"
              value={address}
              onChange={(e) => { setAddress(e.target.value); setSelectedPlace(null); }}
              onFocus={() => placeResults.length > 0 && setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="Start typing an address or spot name..."
              disabled={saving}
              className="w-full px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/20 outline-none disabled:opacity-50"
              style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            {selectedPlace?.unclaimedVenueId && (
              <div className="mt-1.5 flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
                <span className="font-sans text-[11px] font-semibold" style={{ color: "#4ADE80" }}>Found on KickBack</span>
                <span className="font-sans text-[10px] text-white/30">This spot exists — you'll be claiming it</span>
              </div>
            )}
            {showResults && placeResults.length > 0 && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg" style={{ backgroundColor: "rgba(20,20,22,0.98)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}>
                {placeResults.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setAddress(r.address);
                      if (!name && r.name) setName(r.name);
                      setSelectedPlace(r);
                      setShowResults(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                    style={{ borderBottom: i < placeResults.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[13px] font-semibold text-white/80 truncate">{r.name}</p>
                      <p className="font-sans text-[11px] text-white/30 truncate">{r.address}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {r.rating && (
                        <span className="font-sans text-[10px] font-medium" style={{ color: "#facc15" }}>★ {r.rating.toFixed(1)}</span>
                      )}
                      {r.unclaimedVenueId && (
                        <span className="rounded-full px-2 py-0.5 font-sans text-[8px] font-bold" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>ON KB</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block font-sans text-[11px] font-semibold text-white/30">Description <span className="text-white/15">(helps AI generate your page)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes your spot special? What do people come for?"
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
            {saving ? "Setting up..." : "Create Spot"}
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
