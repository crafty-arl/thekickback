"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { updateVenue, updateVenuePage } from "./actions";

const TYPES = ["bar", "restaurant", "lounge", "club", "cafe", "coworking", "other"];
const VIBES = ["quiet", "moderate", "busy", "packed"];

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
  const [activeSection, setActiveSection] = useState("basics");

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
    const venueResult = await updateVenue(venue.id, { name, type, address, max_occupancy: parseInt(capacity) || 100, vibe, rules });
    if (venueResult.error) { setMsg(venueResult.error); setSaving(false); return; }

    const parsedHours = hours.split("\n").filter(Boolean).map((line) => {
      const [day, ...rest] = line.split(":");
      const times = rest.join(":").trim();
      const [open, close] = times.split("–").map((t) => t.trim());
      return { day: day?.trim() || "Daily", open: open || times, close: close || "" };
    });
    const parsedMenu = menuText.split("\n").filter(Boolean).map((line) => {
      const [sectionName, ...rest] = line.split(":");
      const items = rest.join(":").split(",").map((i) => i.trim()).filter(Boolean);
      return { name: sectionName?.trim() || "Menu", items };
    });

    const pageResult = await updateVenuePage(venue.id, { tagline, description, theme_color: themeColor, hours: parsedHours, menu_sections: parsedMenu });
    if (pageResult.error) { setMsg(pageResult.error); } else { setMsg("Saved!"); setTimeout(() => setMsg(""), 3000); }
    setSaving(false);
  }

  const sections = [
    { id: "basics", label: "Basics", icon: "◉" },
    { id: "location", label: "Location", icon: "◎" },
    { id: "page", label: "Page & Branding", icon: "◈" },
    { id: "menu", label: "Menu & Hours", icon: "◇" },
    { id: "rules", label: "Rules & Vibe", icon: "◆" },
  ];

  return (
    <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(10,10,10,0.9)" }}>
        <div className="flex items-center gap-3">
          <Link href="/"><Image src="/logo.png" alt="theKickBack" width={100} height={33} className="h-6 w-auto" /></Link>
          <div className="hidden h-4 w-px sm:block" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          <span className="hidden font-sans text-[13px] font-medium sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>Edit Venue</span>
        </div>
        <div className="flex items-center gap-2">
          {page?.review_status && (
            <span className="rounded-full px-2.5 py-1 font-sans text-[10px] font-semibold tracking-wide" style={{
              backgroundColor: page.review_status === "approved" ? "rgba(74,222,128,0.15)" : "rgba(249,115,22,0.15)",
              color: page.review_status === "approved" ? "#4ADE80" : "#F97316",
            }}>{page.review_status.toUpperCase()}</span>
          )}
          {page?.slug && (
            <a href={`https://join.thekickback.net/${page.slug}`} target="_blank" className="hidden rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium sm:block" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Preview</a>
          )}
          <Link href="/" className="rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-0 lg:gap-8">
        {/* Sidebar nav — desktop only */}
        <nav className="sticky top-[57px] hidden h-fit w-48 shrink-0 flex-col gap-1 py-8 lg:flex">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left font-sans text-[13px] font-medium transition"
              style={{
                backgroundColor: activeSection === s.id ? "rgba(255,255,255,0.06)" : "transparent",
                color: activeSection === s.id ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            >
              <span style={{ color: activeSection === s.id ? "#F97316" : "rgba(255,255,255,0.2)" }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-0 lg:py-8">
          {/* Mobile section tabs */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden" style={{ WebkitOverflowScrolling: "touch" as const }}>
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveSection(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                className="shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium"
                style={{
                  backgroundColor: activeSection === s.id ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                  color: activeSection === s.id ? "#F97316" : "rgba(255,255,255,0.35)",
                  border: `1px solid ${activeSection === s.id ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >{s.label}</button>
            ))}
          </div>

          <div className="flex flex-col gap-8">
            {/* Basics */}
            <Card id="basics" title="Basics" desc="Name and type of your venue.">
              <Field label="Venue Name">
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
              </Field>
              <Field label="Type">
                <div className="flex flex-wrap gap-2">
                  {TYPES.map((t) => (
                    <Chip key={t} label={t} active={type === t} onClick={() => setType(t)} />
                  ))}
                </div>
              </Field>
            </Card>

            {/* Location */}
            <Card id="location" title="Location" desc="Where guests can find you.">
              <Field label="Street Address">
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" className="input" />
              </Field>
              <Field label="Max Capacity">
                <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="100" className="input" />
              </Field>
            </Card>

            {/* Page & Branding */}
            <Card id="page" title="Page & Branding" desc="How your venue appears to guests.">
              <Field label="Tagline">
                <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A rooftop for people who pay attention" maxLength={80} className="input" />
                <span className="mt-1 text-right font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>{tagline.length}/80</span>
              </Field>
              <Field label="Description">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell guests what to expect..." className="input resize-none" />
              </Field>
              <Field label="Theme Color">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                  </div>
                  <input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="input flex-1 font-mono" />
                  <div className="h-10 w-20 rounded-lg" style={{ backgroundColor: themeColor }} />
                </div>
              </Field>
              {page?.slug && (
                <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <span className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Live at: join.thekickback.net/<strong style={{ color: "rgba(255,255,255,0.5)" }}>{page.slug}</strong>
                  </span>
                </div>
              )}
            </Card>

            {/* Menu & Hours */}
            <Card id="menu" title="Menu & Hours" desc="What you serve and when you're open.">
              <Field label="Hours" hint="One per line — Day: Open–Close">
                <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={4} placeholder={"Mon-Fri: 4pm–12am\nSat-Sun: 2pm–2am"} className="input resize-none" />
              </Field>
              <Field label="Menu Sections" hint="One section per line — Section: item, item, item">
                <textarea value={menuText} onChange={(e) => setMenuText(e.target.value)} rows={5} placeholder={"Drinks: espresso, matcha, cold brew\nFood: avocado toast, grain bowl"} className="input resize-none" />
              </Field>
            </Card>

            {/* Rules & Vibe */}
            <Card id="rules" title="Rules & Vibe" desc="Set expectations for your guests.">
              <Field label="Current Vibe">
                <div className="flex gap-2">
                  {VIBES.map((v) => (
                    <Chip key={v} label={v} active={vibe === v} onClick={() => setVibe(v)} />
                  ))}
                </div>
              </Field>
              <Field label="House Rules" hint="One rule per line">
                <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={4} placeholder={"Quiet after 10 PM\nMembers get priority\n21+ only"} className="input resize-none" />
              </Field>
            </Card>

            {/* Save bar */}
            <div className="sticky bottom-0 flex items-center gap-3 rounded-t-2xl border-t py-4" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#0A0A0A" }}>
              {msg && (
                <span className="flex-1 font-sans text-[13px] font-medium" style={{ color: msg === "Saved!" ? "#4ADE80" : "#EF4444" }}>{msg}</span>
              )}
              {!msg && <span className="flex-1" />}
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl px-8 py-3 font-sans text-[14px] font-bold text-black active:scale-[0.98] disabled:opacity-50"
                style={{ backgroundColor: "#F97316" }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          padding: 12px 16px;
          font-family: inherit;
          font-size: 14px;
          color: #fff;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: rgba(249,115,22,0.5); }
        .input::placeholder { color: rgba(255,255,255,0.15); }
      `}</style>
    </main>
  );
}

function Card({ id, title, desc, children }: { id: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 rounded-2xl border p-5 sm:p-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
      <h2 className="font-sans text-[16px] font-semibold text-white">{title}</h2>
      <p className="mb-5 font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.35)" }}>{desc}</p>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="font-sans text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</label>
        {hint && <span className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-1.5 font-sans text-[13px] font-medium capitalize transition active:scale-95"
      style={{
        backgroundColor: active ? "rgba(249,115,22,0.15)" : "transparent",
        borderColor: active ? "#F97316" : "rgba(255,255,255,0.08)",
        color: active ? "#F97316" : "rgba(255,255,255,0.4)",
      }}
    >{label}</button>
  );
}
