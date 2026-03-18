"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { updateVenue, updateVenuePage } from "./actions";

const TYPES = ["bar", "restaurant", "lounge", "club", "cafe", "coworking", "other"];

interface Props {
  venue: {
    id: string;
    name: string;
    type: string;
    address: string;
    neighborhood: string;
    max_occupancy: number;
    vibe: string;
    rules: string[];
  } | null;
  page: {
    slug: string;
    tagline: string;
    description: string;
    theme_color: string;
    hours: { day: string; open: string; close: string }[];
    menu_sections: { name: string; items: string[] }[];
    review_status: string;
  } | null;
}

export function EditForm({ venue, page }: Props) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [name, setName] = useState(venue?.name || "");
  const [type, setType] = useState(venue?.type || "");
  const [address, setAddress] = useState(venue?.address || "");
  const [capacity, setCapacity] = useState(String(venue?.max_occupancy || ""));
  const [vibe, setVibe] = useState(venue?.vibe || "quiet");
  const [rulesText, setRulesText] = useState((venue?.rules || []).join("\n"));

  const [tagline, setTagline] = useState(page?.tagline || "");
  const [description, setDescription] = useState(page?.description || "");
  const [themeColor, setThemeColor] = useState(page?.theme_color || "#F97316");
  const [hours, setHours] = useState(
    page?.hours?.map((h) => `${h.day}: ${h.open}${h.close ? `–${h.close}` : ""}`).join("\n") || ""
  );
  const [menuText, setMenuText] = useState(
    page?.menu_sections?.map((s) => `${s.name}: ${s.items.join(", ")}`).join("\n") || ""
  );

  async function handleSave() {
    if (!venue) return;
    setSaving(true);
    setMsg("");

    const rules = rulesText.split("\n").map((r) => r.trim()).filter(Boolean);

    const venueResult = await updateVenue(venue.id, {
      name,
      type,
      address,
      max_occupancy: parseInt(capacity) || 100,
      vibe,
      rules,
    });

    if (venueResult.error) {
      setMsg(venueResult.error);
      setSaving(false);
      return;
    }

    // Parse hours
    const parsedHours = hours.split("\n").filter(Boolean).map((line) => {
      const [day, ...rest] = line.split(":");
      const times = rest.join(":").trim();
      const [open, close] = times.split("–").map((t) => t.trim());
      return { day: day?.trim() || "Daily", open: open || times, close: close || "" };
    });

    // Parse menu
    const parsedMenu = menuText.split("\n").filter(Boolean).map((line) => {
      const [sectionName, ...rest] = line.split(":");
      const items = rest.join(":").split(",").map((i) => i.trim()).filter(Boolean);
      return { name: sectionName?.trim() || "Menu", items };
    });

    const pageResult = await updateVenuePage(venue.id, {
      tagline,
      description,
      theme_color: themeColor,
      hours: parsedHours,
      menu_sections: parsedMenu,
    });

    if (pageResult.error) {
      setMsg(pageResult.error);
    } else {
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    }
    setSaving(false);
  }

  const inputStyle = {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.08)",
  };

  const labelStyle = { color: "rgba(255,255,255,0.5)" };

  return (
    <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <Link href="/">
            <Image src="/logo.png" alt="theKickBack" width={120} height={40} className="h-7 w-auto" />
          </Link>
          <div className="h-4 w-px" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span className="font-sans text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
            Edit Venue
          </span>
        </div>
        <div className="flex items-center gap-3">
          {page?.review_status && (
            <span
              className="rounded-full px-3 py-1 font-sans text-[11px] font-medium"
              style={{
                backgroundColor: page.review_status === "approved" ? "rgba(74,222,128,0.15)" : "rgba(249,115,22,0.15)",
                color: page.review_status === "approved" ? "#4ADE80" : "#F97316",
              }}
            >
              {page.review_status.toUpperCase()}
            </span>
          )}
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 font-sans text-[13px] font-medium"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
          >
            Back
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-5 py-8">
        <div className="flex flex-col gap-6">
          {/* Venue Fields */}
          <section className="flex flex-col gap-4">
            <h2 className="font-sans text-[11px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.3)" }}>VENUE</h2>

            <Field label="Name" labelStyle={labelStyle}>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle} />
            </Field>

            <Field label="Type" labelStyle={labelStyle}>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="rounded-lg border px-3 py-1.5 font-sans text-[13px] font-medium transition active:scale-95"
                    style={{
                      backgroundColor: type === t ? "rgba(249,115,22,0.15)" : "transparent",
                      borderColor: type === t ? "#F97316" : "rgba(255,255,255,0.08)",
                      color: type === t ? "#F97316" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Address" labelStyle={labelStyle}>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity" labelStyle={labelStyle}>
                <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle} />
              </Field>
              <Field label="Vibe" labelStyle={labelStyle}>
                <select value={vibe} onChange={(e) => setVibe(e.target.value)} className="w-full rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle}>
                  <option value="quiet">Quiet</option>
                  <option value="moderate">Moderate</option>
                  <option value="busy">Busy</option>
                  <option value="packed">Packed</option>
                </select>
              </Field>
            </div>

            <Field label="Rules (one per line)" labelStyle={labelStyle}>
              <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={3} className="w-full resize-none rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle} />
            </Field>
          </section>

          <div className="h-px" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />

          {/* Page Fields */}
          <section className="flex flex-col gap-4">
            <h2 className="font-sans text-[11px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.3)" }}>VENUE PAGE</h2>

            <Field label="Tagline" labelStyle={labelStyle}>
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} className="w-full rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle} />
            </Field>

            <Field label="Description" labelStyle={labelStyle}>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full resize-none rounded-xl border px-4 py-3 font-sans text-[14px] text-white focus:outline-none" style={inputStyle} />
            </Field>

            <Field label="Theme Color" labelStyle={labelStyle}>
              <div className="flex items-center gap-3">
                <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                <input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-full rounded-xl border px-4 py-3 font-mono text-[14px] text-white focus:outline-none" style={inputStyle} />
              </div>
            </Field>

            <Field label="Hours (one per line — Day: Open–Close)" labelStyle={labelStyle}>
              <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={3} placeholder={"Mon-Fri: 4pm–12am\nSat-Sun: 2pm–2am"} className="w-full resize-none rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/15 focus:outline-none" style={inputStyle} />
            </Field>

            <Field label="Menu (one section per line — Section: item, item, item)" labelStyle={labelStyle}>
              <textarea value={menuText} onChange={(e) => setMenuText(e.target.value)} rows={4} placeholder={"Drinks: espresso, matcha, cold brew\nFood: avocado toast, grain bowl"} className="w-full resize-none rounded-xl border px-4 py-3 font-sans text-[14px] text-white placeholder:text-white/15 focus:outline-none" style={inputStyle} />
            </Field>
          </section>

          {/* Save */}
          {msg && (
            <p
              className="rounded-lg px-3 py-2 text-center font-sans text-[13px]"
              style={{
                backgroundColor: msg === "Saved!" ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)",
                color: msg === "Saved!" ? "#4ADE80" : "#EF4444",
              }}
            >
              {msg}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl py-3.5 font-sans text-[15px] font-bold text-black active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: "#F97316" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          {page?.slug && (
            <a
              href={`https://join.thekickback.net/${page.slug}`}
              target="_blank"
              className="text-center font-sans text-[13px] underline"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Preview: join.thekickback.net/{page.slug}
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ label, labelStyle, children }: { label: string; labelStyle: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-sans text-[12px] font-medium" style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}
