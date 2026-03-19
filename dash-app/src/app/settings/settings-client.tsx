"use client";

import { useState } from "react";
import Link from "next/link";
import { updateVenue, updateVenuePage, addKnowledge, deleteKnowledge } from "./actions";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

// ─── Constants ───────────────────────────────────────────────────

const TYPES = ["bar", "restaurant", "lounge", "club", "cafe", "coworking", "other"];
const VIBES = ["quiet", "moderate", "busy", "packed"];

const KNOWLEDGE_CATEGORIES = [
    { id: "menu", label: "Menu & Drinks", icon: "🍸", placeholder: "We serve craft cocktails, local beers on tap, and a full espresso bar. Our signature drink is the Rooftop Sunset — mezcal, grapefruit, agave." },
    { id: "hours", label: "Hours & Policies", icon: "🕐", placeholder: "Open Wednesday through Saturday, 4 PM to midnight. Kitchen closes at 11 PM. Reservations recommended for groups of 6+." },
    { id: "events", label: "Events & Specials", icon: "🎵", placeholder: "Live DJ every Friday 9 PM–12 AM. Happy hour Mon–Thu 4–6 PM, half off wells and drafts." },
    { id: "location", label: "Location & Access", icon: "📍", placeholder: "Located on the 12th floor of the Meridian Building. Enter through the lobby, take the elevator to 12." },
    { id: "faq", label: "FAQ", icon: "❓", placeholder: "Yes, we have oat milk. No, we don't take reservations for the bar area. Dress code is smart casual." },
    { id: "general", label: "Custom", icon: "📝", placeholder: "Add any other information your AI should know about your venue..." },
];

const SECTIONS = [
    { id: "general", label: "General", icon: "◉" },
    { id: "location", label: "Location", icon: "◎" },
    { id: "branding", label: "Branding", icon: "◈" },
    { id: "hours", label: "Hours & Menu", icon: "◇" },
    { id: "rules", label: "Rules & Vibe", icon: "◆" },
    { id: "agent", label: "AI Agent", icon: "🤖" },
    { id: "members", label: "Members", icon: "👥" },
    { id: "account", label: "Account", icon: "⚙" },
];

// ─── Types ───────────────────────────────────────────────────────

interface Knowledge {
    id: string;
    content: string;
    category: string;
    created_at: string;
}

interface Membership {
    id: string;
    user_id: string;
    tier: string;
    created_at: string;
    profiles: { phone: string; email: string | null; display_name: string | null };
}

interface Props {
    user: { id: string; email: string };
    role: string;
    venue: {
        id: string;
        name: string;
        type: string;
        address: string;
        neighborhood: string;
        max_occupancy: number;
        vibe: string;
        rules: string[];
    };
    page: {
        slug: string;
        tagline: string;
        description: string;
        theme_color: string;
        hours: { day: string; open: string; close: string }[];
        menu_sections: { name: string; items: string[] }[];
        review_status: string;
        published: boolean;
    } | null;
    knowledge: Knowledge[];
    members: Membership[];
    memberCount: number;
}

// ─── Main Component ──────────────────────────────────────────────

export function SettingsClient({ user, role, venue, page, knowledge, members, memberCount }: Props) {
    const [activeSection, setActiveSection] = useState("general");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    // Venue fields
    const [name, setName] = useState(venue.name);
    const [type, setType] = useState(venue.type);
    const [address, setAddress] = useState(venue.address || "");
    const [capacity, setCapacity] = useState(String(venue.max_occupancy || ""));
    const [vibe, setVibe] = useState(venue.vibe || "quiet");
    const [rulesText, setRulesText] = useState((venue.rules || []).join("\n"));

    // Page fields
    const [tagline, setTagline] = useState(page?.tagline || "");
    const [description, setDescription] = useState(page?.description || "");
    const [themeColor, setThemeColor] = useState(page?.theme_color || "#F97316");
    const [hours, setHours] = useState(
        page?.hours?.map((h) => `${h.day}: ${h.open}${h.close ? `–${h.close}` : ""}`).join("\n") || ""
    );
    const [menuText, setMenuText] = useState(
        page?.menu_sections?.map((s) => `${s.name}: ${s.items.join(", ")}`).join("\n") || ""
    );

    // Agent fields
    const [activeKnowledgeCat, setActiveKnowledgeCat] = useState("menu");
    const [newKnowledge, setNewKnowledge] = useState("");
    const [savingKnowledge, setSavingKnowledge] = useState(false);
    const [deletingKnowledge, setDeletingKnowledge] = useState<string | null>(null);
    const [knowledgeMsg, setKnowledgeMsg] = useState("");

    const slug = page?.slug || venue.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const venueEmail = `${slug}@thekickback.net`;

    // ─── Save venue + page changes ─────────────────────────────────

    async function handleSave() {
        setSaving(true);
        setMsg("");

        const rules = rulesText.split("\n").map((r) => r.trim()).filter(Boolean);
        const venueResult = await updateVenue(venue.id, {
            name, type, address,
            max_occupancy: parseInt(capacity) || 100,
            vibe, rules,
        });
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

        const pageResult = await updateVenuePage(venue.id, {
            tagline, description, theme_color: themeColor,
            hours: parsedHours, menu_sections: parsedMenu,
        });
        if (pageResult.error) { setMsg(pageResult.error); }
        else { setMsg("Saved!"); setTimeout(() => setMsg(""), 3000); }
        setSaving(false);
    }

    // ─── Knowledge handlers ────────────────────────────────────────

    async function handleAddKnowledge() {
        if (!newKnowledge.trim()) return;
        setSavingKnowledge(true);
        setKnowledgeMsg("");
        const result = await addKnowledge(newKnowledge, activeKnowledgeCat);
        if (result.error) { setKnowledgeMsg(result.error); }
        else { setNewKnowledge(""); setKnowledgeMsg("Added!"); setTimeout(() => setKnowledgeMsg(""), 2000); }
        setSavingKnowledge(false);
    }

    async function handleDeleteKnowledge(id: string) {
        setDeletingKnowledge(id);
        await deleteKnowledge(id);
        setDeletingKnowledge(null);
    }

    // ─── Navigate to section ───────────────────────────────────────

    function goToSection(id: string) {
        setActiveSection(id);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ─── Derived data ──────────────────────────────────────────────

    const activeCat = KNOWLEDGE_CATEGORIES.find((c) => c.id === activeKnowledgeCat)!;
    const filteredKnowledge = knowledge.filter((k) => k.category === activeKnowledgeCat);

    return (
        <main className="min-h-svh" style={{ backgroundColor: "#0A0A0A" }}>
            {/* Header */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(10,10,10,0.9)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/"><img src="/logo.png" alt="theKickBack" className="h-6 w-auto" /></Link>
                    <div className="hidden h-4 w-px sm:block" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
                    <span className="hidden font-sans text-[13px] font-medium sm:block" style={{ color: "rgba(255,255,255,0.35)" }}>Settings</span>
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
                {/* Sidebar — desktop */}
                <nav className="sticky top-[57px] hidden h-fit w-48 shrink-0 flex-col gap-1 py-8 lg:flex">
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            onClick={() => goToSection(s.id)}
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
                    {/* Mobile tabs */}
                    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden" style={{ WebkitOverflowScrolling: "touch" as const }}>
                        {SECTIONS.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => goToSection(s.id)}
                                className="shrink-0 rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium"
                                style={{
                                    backgroundColor: activeSection === s.id ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                                    color: activeSection === s.id ? "#F97316" : "rgba(255,255,255,0.35)",
                                    border: `1px solid ${activeSection === s.id ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                                }}
                            >{s.icon} {s.label}</button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-8">

                        {/* ─── General ─────────────────────────────────────────── */}
                        <Card id="general" title="General" desc="Basic info and how guests reach you.">
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
                            <div className="flex flex-col gap-2 rounded-xl p-4" style={{ backgroundColor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "#F97316" }}>
                                        <span className="text-[16px]">✉</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-mono text-[14px] font-semibold text-white">{venueEmail}</p>
                                        <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Guests email here to interact</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Row label="Slug" value={slug} />
                                <Row label="Status" value={page?.published ? "Published" : "Pending review"} accent={page?.published ? "#4ADE80" : "#F97316"} />
                                <Row label="Public URL" value={`join.thekickback.net/${slug}`} link={`https://join.thekickback.net/${slug}`} />
                            </div>
                        </Card>

                        {/* ─── Location ────────────────────────────────────────── */}
                        <Card id="location" title="Location" desc="Where guests can find you.">
                            <Field label="Street Address">
                                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, State" className="input" />
                            </Field>
                            <Field label="Max Capacity">
                                <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="100" className="input" />
                            </Field>
                        </Card>

                        {/* ─── Branding ────────────────────────────────────────── */}
                        <Card id="branding" title="Branding" desc="How your venue appears to guests.">
                            <Field label="Tagline">
                                <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A rooftop for people who pay attention" maxLength={80} className="input" />
                                <span className="mt-1 text-right font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>{tagline.length}/80</span>
                            </Field>
                            <Field label="Description">
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Tell guests what to expect..." className="input resize-none" />
                            </Field>
                            <Field label="Theme Color">
                                <div className="flex items-center gap-3">
                                    <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                                    <input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="input flex-1 font-mono" />
                                    <div className="h-10 w-20 rounded-lg" style={{ backgroundColor: themeColor }} />
                                </div>
                            </Field>
                        </Card>

                        {/* ─── Hours & Menu ─────────────────────────────────────── */}
                        <Card id="hours" title="Hours & Menu" desc="What you serve and when you're open.">
                            <Field label="Hours" hint="One per line — Day: Open–Close">
                                <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={4} placeholder={"Mon-Fri: 4pm–12am\nSat-Sun: 2pm–2am"} className="input resize-none" />
                            </Field>
                            <Field label="Menu Sections" hint="One section per line — Section: item, item">
                                <textarea value={menuText} onChange={(e) => setMenuText(e.target.value)} rows={5} placeholder={"Drinks: espresso, matcha, cold brew\nFood: avocado toast, grain bowl"} className="input resize-none" />
                            </Field>
                        </Card>

                        {/* ─── Rules & Vibe ─────────────────────────────────────── */}
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

                        {/* ─── AI Agent ─────────────────────────────────────────── */}
                        <Card id="agent" title="AI Agent" desc={`Add knowledge that ${venue.name}'s AI will use when answering guests.`}>
                            {/* Category pills */}
                            <div className="flex flex-wrap gap-2">
                                {KNOWLEDGE_CATEGORIES.map((cat) => {
                                    const count = knowledge.filter((k) => k.category === cat.id).length;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveKnowledgeCat(cat.id)}
                                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition"
                                            style={{
                                                backgroundColor: activeKnowledgeCat === cat.id ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                                                color: activeKnowledgeCat === cat.id ? "#F97316" : "rgba(255,255,255,0.35)",
                                                border: `1px solid ${activeKnowledgeCat === cat.id ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                                            }}
                                        >
                                            <span>{cat.icon}</span> {cat.label}
                                            {count > 0 && (
                                                <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>{count}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Add new entry */}
                            <div className="rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                                <textarea
                                    value={newKnowledge}
                                    onChange={(e) => setNewKnowledge(e.target.value)}
                                    placeholder={activeCat.placeholder}
                                    rows={3}
                                    className="input mb-3 resize-none"
                                />
                                <div className="flex items-center justify-between">
                                    <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                                        Write naturally. The AI uses this when guests ask related questions.
                                    </p>
                                    <button
                                        onClick={handleAddKnowledge}
                                        disabled={savingKnowledge || !newKnowledge.trim()}
                                        className="shrink-0 rounded-xl px-5 py-2 font-sans text-[13px] font-bold text-black active:scale-[0.98] disabled:opacity-40"
                                        style={{ backgroundColor: "#F97316" }}
                                    >
                                        {savingKnowledge ? "Saving..." : "Add"}
                                    </button>
                                </div>
                                {knowledgeMsg && <p className="mt-2 font-sans text-[13px]" style={{ color: knowledgeMsg === "Added!" ? "#4ADE80" : "#EF4444" }}>{knowledgeMsg}</p>}
                            </div>

                            {/* Existing entries */}
                            {filteredKnowledge.length === 0 && (
                                <p className="py-4 text-center font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                                    No entries in {activeCat.label} yet.
                                </p>
                            )}
                            {filteredKnowledge.map((k) => (
                                <div key={k.id} className="group flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                                    <div className="min-w-0 flex-1">
                                        <p className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-white/70">{k.content}</p>
                                        <p className="mt-2 font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                                            {new Date(k.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteKnowledge(k.id)}
                                        disabled={deletingKnowledge === k.id}
                                        className="shrink-0 rounded-lg p-2 opacity-0 transition group-hover:opacity-100"
                                        style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                                    >
                                        {deletingKnowledge === k.id ? (
                                            <span className="font-sans text-[11px]" style={{ color: "#EF4444" }}>...</span>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                        )}
                                    </button>
                                </div>
                            ))}

                            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                                <span className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                                    {knowledge.length} total entries across all categories
                                </span>
                            </div>
                        </Card>

                        {/* ─── Members ──────────────────────────────────────────── */}
                        <Card id="members" title="Members" desc={`${memberCount} total members at ${venue.name}.`}>
                            {members.length === 0 ? (
                                <div className="rounded-xl py-8 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                                    <p className="font-sans text-[14px] text-white/40">No members yet.</p>
                                    <p className="mt-1 font-sans text-[12px] text-white/20">When guests reply YES to a membership offer, they&apos;ll appear here.</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                                    <div className="flex items-center justify-between px-4 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                                        <span className="font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>MEMBER</span>
                                        <span className="font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>SINCE</span>
                                    </div>
                                    {members.map((m) => {
                                        const identifier = m.profiles?.email || m.profiles?.phone || "Unknown";
                                        const displayName = m.profiles?.display_name;
                                        return (
                                            <div key={m.id} className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
                                                        <span className="font-sans text-[12px] font-bold" style={{ color: "#F97316" }}>
                                                            {(displayName || identifier).charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="font-sans text-[13px] font-medium text-white">{displayName || identifier}</p>
                                                        <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                                            {m.tier.toUpperCase()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="font-sans text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                                    {new Date(m.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        {/* ─── Account ──────────────────────────────────────────── */}
                        <Card id="account" title="Account" desc="Your account and access.">
                            <div className="flex flex-col gap-2">
                                <Row label="Email" value={user.email} />
                                <Row label="Role" value={role} />
                                <Row label="User ID" value={user.id.slice(0, 8) + "..."} />
                            </div>
                            <div className="pt-2">
                                <SignOutButton />
                            </div>
                        </Card>

                        {/* ─── Save bar ─────────────────────────────────────────── */}
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

// ─── Helper Components ───────────────────────────────────────────

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

function Row({ label, value, link, accent }: { label: string; value: string; link?: string; accent?: string }) {
    return (
        <div className="flex items-center justify-between py-1.5">
            <span className="font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
            {link ? (
                <a href={link} target="_blank" className="font-sans text-[13px] font-medium underline" style={{ color: "#F97316" }}>{value}</a>
            ) : (
                <span className="font-sans text-[13px] font-medium" style={{ color: accent || "rgba(255,255,255,0.7)" }}>{value}</span>
            )}
        </div>
    );
}
