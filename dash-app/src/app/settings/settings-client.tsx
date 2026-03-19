"use client";

import { useState } from "react";
import Link from "next/link";
import { updateVenue, updateVenuePage, addKnowledge, deleteKnowledge, addOffering, deleteOffering, toggleOffering, addXpAction, deleteXpAction, toggleXpAction, addXpMilestone, deleteXpMilestone, applyXpTemplate, saveCustomTemplate, deleteCustomTemplate } from "./actions";
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

const OFFERING_TYPES = [
    { id: "membership", label: "Membership", icon: "👑", recurring: true, defaultPrice: 2500, defaultName: "Membership", defaultDesc: "Exclusive access and perks" },
    { id: "reservation", label: "Reservation", icon: "🪑", recurring: false, defaultPrice: 5000, defaultName: "Table / Booth", defaultDesc: "Reserve a spot for your group" },
    { id: "service", label: "Service", icon: "✂️", recurring: false, defaultPrice: 3500, defaultName: "Service", defaultDesc: "A priced service with a set duration" },
    { id: "product", label: "Product", icon: "☕", recurring: false, defaultPrice: 500, defaultName: "Item", defaultDesc: "A physical good available for purchase" },
    { id: "event", label: "Event", icon: "🎟️", recurring: false, defaultPrice: 1500, defaultName: "Event Ticket", defaultDesc: "Entry to a special event" },
    { id: "package", label: "Package", icon: "📦", recurring: false, defaultPrice: 10000, defaultName: "Package", defaultDesc: "A bundle of services and access" },
    { id: "custom", label: "Custom", icon: "✦", recurring: false, defaultPrice: 0, defaultName: "", defaultDesc: "" },
];

const SECTIONS = [
    { id: "general", label: "General", icon: "◉" },
    { id: "location", label: "Location", icon: "◎" },
    { id: "branding", label: "Branding", icon: "◈" },
    { id: "hours", label: "Hours & Menu", icon: "◇" },
    { id: "rules", label: "Rules & Vibe", icon: "◆" },
    { id: "offerings", label: "Offerings", icon: "💰" },
    { id: "xp", label: "XP Roadmap", icon: "⚡" },
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

interface Offering {
    id: string;
    type: string;
    name: string;
    description: string | null;
    price_cents: number;
    recurring: boolean;
    interval: string | null;
    perks: string[];
    active: boolean;
    sort_order: number;
    stripe_price_id: string | null;
    created_at: string;
}

interface XpAction {
    id: string;
    action: string;
    label: string;
    points: number;
    description: string | null;
    max_per_day: number | null;
    active: boolean;
    sort_order: number;
}

interface XpMilestone {
    id: string;
    name: string;
    threshold: number;
    color: string;
    reward: string | null;
    perks: string[];
}

const XP_ACTION_PRESETS = [
    { action: "visit", label: "Visit", points: 50, description: "Earn XP every time you visit" },
    { action: "first_visit", label: "First Visit", points: 100, description: "Bonus XP for your first visit" },
    { action: "order", label: "Place an Order", points: 25, description: "Earn XP when you order" },
    { action: "referral", label: "Refer a Friend", points: 200, description: "Bring someone new" },
    { action: "event_attend", label: "Attend an Event", points: 75, description: "Show up to a venue event" },
    { action: "review", label: "Leave a Review", points: 50, description: "Share your experience" },
    { action: "membership", label: "Become a Member", points: 300, description: "Join the membership program" },
    { action: "challenge", label: "Complete a Challenge", points: 150, description: "Finish a venue challenge" },
    { action: "custom", label: "Custom Action", points: 10, description: "" },
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

// Get templates matching the venue type, plus all others
function getTemplatesForType(venueType: string): { primary: XpTemplate[]; others: XpTemplate[] } {
    const primary = XP_TEMPLATES.filter((t) => t.venueType === venueType);
    const others = XP_TEMPLATES.filter((t) => t.venueType !== venueType);
    return { primary, others };
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
    offerings: Offering[];
    xpActions: XpAction[];
    xpMilestones: XpMilestone[];
    customTemplates: { id: string; name: string; actions: unknown[]; milestones: unknown[] }[];
}

// ─── Main Component ──────────────────────────────────────────────

export function SettingsClient({ user, role, venue, page, knowledge, members, memberCount, offerings, xpActions, xpMilestones, customTemplates }: Props) {
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

    // Offering fields
    const [showAddOffering, setShowAddOffering] = useState(false);
    const [offeringType, setOfferingType] = useState("membership");
    const [offeringName, setOfferingName] = useState("");
    const [offeringDesc, setOfferingDesc] = useState("");
    const [offeringPrice, setOfferingPrice] = useState("");
    const [offeringPerks, setOfferingPerks] = useState("");
    const [offeringDuration, setOfferingDuration] = useState("");
    const [offeringAddOns, setOfferingAddOns] = useState("");
    const [savingOffering, setSavingOffering] = useState(false);
    const [offeringMsg, setOfferingMsg] = useState("");
    const [togglingOffering, setTogglingOffering] = useState<string | null>(null);
    const [deletingOfferingId, setDeletingOfferingId] = useState<string | null>(null);

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

    // ─── Offering handlers ────────────────────────────────────────

    function loadOfferingTemplate(typeId: string) {
        setOfferingType(typeId);
        const t = OFFERING_TYPES.find((o) => o.id === typeId);
        if (t) {
            setOfferingName(t.defaultName);
            setOfferingDesc(t.defaultDesc);
            setOfferingPrice(String(t.defaultPrice / 100));
        }
    }

    async function handleAddOffering() {
        if (!offeringName.trim()) return;
        setSavingOffering(true);
        setOfferingMsg("");
        const template = OFFERING_TYPES.find((o) => o.id === offeringType);
        // Parse add-ons from "Name - Price" format
        const parsedAddOns = offeringAddOns
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const parts = line.split("-").map((s) => s.trim());
                const name = parts[0] || line;
                const price = parts[1] ? Math.round(parseFloat(parts[1]) * 100) : 0;
                return { name, price_cents: price };
            })
            .filter((a) => a.name);

        const result = await addOffering({
            name: offeringName.trim(),
            type: offeringType,
            description: offeringDesc.trim() || undefined,
            price_cents: Math.round(parseFloat(offeringPrice || "0") * 100),
            recurring: template?.recurring || false,
            interval: template?.recurring ? "month" : undefined,
            perks: offeringPerks.split("\n").map((p) => p.trim()).filter(Boolean),
            duration_minutes: offeringDuration ? parseInt(offeringDuration) : undefined,
            add_ons: parsedAddOns.length > 0 ? parsedAddOns : undefined,
        });
        if (result.error) { setOfferingMsg(result.error); }
        else {
            setOfferingMsg("Added!");
            setShowAddOffering(false);
            setOfferingName(""); setOfferingDesc(""); setOfferingPrice(""); setOfferingPerks(""); setOfferingDuration(""); setOfferingAddOns("");
            setTimeout(() => setOfferingMsg(""), 2000);
        }
        setSavingOffering(false);
    }

    async function handleToggleOffering(id: string, active: boolean) {
        setTogglingOffering(id);
        await toggleOffering(id, active);
        setTogglingOffering(null);
    }

    async function handleDeleteOffering(id: string) {
        setDeletingOfferingId(id);
        await deleteOffering(id);
        setDeletingOfferingId(null);
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

                        {/* ─── Offerings ───────────────────────────────────────── */}
                        <Card id="offerings" title="Offerings" desc="Memberships, booth holds, space rentals, and more. These appear on your venue page.">
                            {/* Existing offerings */}
                            {offerings.length === 0 && !showAddOffering && (
                                <div className="rounded-xl py-8 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                                    <p className="font-sans text-[14px] text-white/40">No offerings configured yet.</p>
                                    <p className="mt-1 font-sans text-[12px] text-white/20">Add a membership, booth hold, or space rental to start earning.</p>
                                </div>
                            )}
                            {offerings.map((o) => {
                                const typeInfo = OFFERING_TYPES.find((t) => t.id === o.type);
                                return (
                                    <div key={o.id} className="group flex items-start gap-4 rounded-xl border p-4" style={{ borderColor: o.active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", backgroundColor: "rgba(255,255,255,0.02)", opacity: o.active ? 1 : 0.5 }}>
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
                                            <span className="text-[18px]">{typeInfo?.icon || "✦"}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-sans text-[14px] font-semibold text-white">{o.name}</p>
                                                <span className="rounded-full px-2 py-0.5 font-sans text-[10px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.35)" }}>
                                                    {typeInfo?.label || o.type}
                                                </span>
                                            </div>
                                            {o.description && <p className="mt-1 font-sans text-[12px] text-white/40">{o.description}</p>}
                                            <div className="mt-2 flex items-center gap-3">
                                                <span className="font-mono text-[14px] font-bold" style={{ color: "#F97316" }}>
                                                    ${(o.price_cents / 100).toFixed(2)}
                                                    {o.recurring && <span className="font-sans text-[11px] font-normal text-white/30">/{o.interval || "mo"}</span>}
                                                </span>
                                                {o.perks && o.perks.length > 0 && (
                                                    <span className="font-sans text-[11px] text-white/25">{o.perks.length} perks</span>
                                                )}
                                                {o.stripe_price_id && (
                                                    <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider" style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>STRIPE</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <button
                                                onClick={() => handleToggleOffering(o.id, !o.active)}
                                                disabled={togglingOffering === o.id}
                                                className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium transition"
                                                style={{ backgroundColor: o.active ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.06)", color: o.active ? "#4ADE80" : "rgba(255,255,255,0.3)" }}
                                            >
                                                {togglingOffering === o.id ? "..." : o.active ? "Active" : "Paused"}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteOffering(o.id)}
                                                disabled={deletingOfferingId === o.id}
                                                className="rounded-lg p-1.5 opacity-0 transition group-hover:opacity-100"
                                                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                                            >
                                                {deletingOfferingId === o.id ? (
                                                    <span className="font-sans text-[11px]" style={{ color: "#EF4444" }}>...</span>
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Add offering form */}
                            {showAddOffering ? (
                                <div className="rounded-xl border p-4" style={{ borderColor: "rgba(249,115,22,0.2)", backgroundColor: "rgba(249,115,22,0.04)" }}>
                                    <p className="mb-3 font-sans text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Type</p>
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        {OFFERING_TYPES.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => loadOfferingTemplate(t.id)}
                                                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition"
                                                style={{
                                                    backgroundColor: offeringType === t.id ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                                                    color: offeringType === t.id ? "#F97316" : "rgba(255,255,255,0.35)",
                                                    border: `1px solid ${offeringType === t.id ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)"}`,
                                                }}
                                            >
                                                {t.icon} {t.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <Field label="Name">
                                            <input value={offeringName} onChange={(e) => setOfferingName(e.target.value)} placeholder="e.g. VIP Membership" className="input" />
                                        </Field>
                                        <Field label="Description">
                                            <input value={offeringDesc} onChange={(e) => setOfferingDesc(e.target.value)} placeholder="Short description for guests" className="input" />
                                        </Field>
                                        <Field label={OFFERING_TYPES.find((t) => t.id === offeringType)?.recurring ? "Price ($/month)" : "Price ($)"}>
                                            <input type="number" step="0.01" value={offeringPrice} onChange={(e) => setOfferingPrice(e.target.value)} placeholder="25.00" className="input" />
                                        </Field>
                                        <Field label="Duration (minutes)" hint="For services and reservations">
                                            <input type="number" value={offeringDuration} onChange={(e) => setOfferingDuration(e.target.value)} placeholder="60" className="input" />
                                        </Field>
                                        <Field label="Perks / Includes" hint="One per line">
                                            <textarea value={offeringPerks} onChange={(e) => setOfferingPerks(e.target.value)} rows={3} placeholder={"Priority seating\n10% off drinks\nExclusive events"} className="input resize-none" />
                                        </Field>
                                        <Field label="Add-ons" hint="Format: Name - Price (one per line)">
                                            <textarea value={offeringAddOns} onChange={(e) => setOfferingAddOns(e.target.value)} rows={2} placeholder={"Bottle Service - 120.00\nSkip the Line - 25.00"} className="input resize-none" />
                                        </Field>
                                    </div>
                                    <div className="mt-4 flex items-center justify-end gap-2">
                                        <button onClick={() => setShowAddOffering(false)} className="rounded-xl px-4 py-2 font-sans text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Cancel</button>
                                        <button
                                            onClick={handleAddOffering}
                                            disabled={savingOffering || !offeringName.trim()}
                                            className="rounded-xl px-5 py-2 font-sans text-[13px] font-bold text-black active:scale-[0.98] disabled:opacity-40"
                                            style={{ backgroundColor: "#F97316" }}
                                        >
                                            {savingOffering ? "Saving..." : "Add Offering"}
                                        </button>
                                    </div>
                                    {offeringMsg && <p className="mt-2 font-sans text-[13px]" style={{ color: offeringMsg === "Added!" ? "#4ADE80" : "#EF4444" }}>{offeringMsg}</p>}
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setShowAddOffering(true); loadOfferingTemplate("membership"); }}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 font-sans text-[13px] font-medium transition hover:border-solid"
                                    style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }}
                                >
                                    + Add Offering
                                </button>
                            )}

                            {!offerings.some((o) => o.stripe_price_id) && offerings.length > 0 && (
                                <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(249,115,22,0.06)" }}>
                                    <span className="font-sans text-[11px]" style={{ color: "rgba(249,115,22,0.6)" }}>
                                        💳 Stripe not connected yet — offerings will show on your page but payments won&apos;t process until connected.
                                    </span>
                                </div>
                            )}
                        </Card>

                        {/* ─── XP Roadmap ───────────────────────────────────────── */}
                        <Card id="xp" title="XP Roadmap" desc="Define how guests earn XP at your venue and what milestones they unlock.">
                            {/* ── Templates ── */}
                            {(() => {
                                const { primary, others } = getTemplatesForType(venue.type);
                                const allTemplates = [...primary, ...others];
                                const hasRoadmap = xpActions.length > 0 || xpMilestones.length > 0;

                                return (
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-sans text-[13px] font-semibold text-white/60">
                                                {hasRoadmap ? "Templates" : "Start with a template"}
                                            </h3>
                                            {hasRoadmap && (
                                                <button
                                                    onClick={async () => {
                                                        const name = prompt("Name this template:");
                                                        if (!name) return;
                                                        setSaving(true);
                                                        await saveCustomTemplate(
                                                            name,
                                                            xpActions.map((a) => ({ action: a.action, label: a.label, points: a.points, description: a.description, max_per_day: a.max_per_day })),
                                                            xpMilestones.map((m) => ({ name: m.name, threshold: m.threshold, color: m.color, reward: m.reward, perks: m.perks }))
                                                        );
                                                        setSaving(false);
                                                        setMsg("Template saved!");
                                                        setTimeout(() => setMsg(""), 2000);
                                                    }}
                                                    disabled={saving}
                                                    className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-semibold active:scale-95"
                                                    style={{ backgroundColor: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}
                                                >
                                                    Save as Template
                                                </button>
                                            )}
                                        </div>

                                        {/* Custom saved templates */}
                                        {customTemplates.length > 0 && (
                                            <div className="mb-3">
                                                <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">YOUR TEMPLATES</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {customTemplates.map((t) => (
                                                        <div key={t.id} className="flex items-center gap-1">
                                                            <button
                                                                onClick={async () => {
                                                                    if (!confirm(`Apply "${t.name}"? This will replace your current roadmap.`)) return;
                                                                    setSaving(true);
                                                                    await applyXpTemplate(
                                                                        t.actions as XpTemplate["actions"],
                                                                        t.milestones as XpTemplate["milestones"]
                                                                    );
                                                                    setSaving(false);
                                                                }}
                                                                className="rounded-xl border px-3 py-2 font-sans text-[12px] font-medium transition active:scale-95"
                                                                style={{ borderColor: "rgba(167,139,250,0.3)", backgroundColor: "rgba(167,139,250,0.06)", color: "#a78bfa" }}
                                                            >
                                                                ⚡ {t.name}
                                                            </button>
                                                            <button
                                                                onClick={async () => { await deleteCustomTemplate(t.id); }}
                                                                className="rounded p-1 opacity-30 hover:opacity-100"
                                                            >
                                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Built-in templates */}
                                        <p className="mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">
                                            {primary.length > 0 ? "RECOMMENDED FOR YOUR VENUE" : "ALL TEMPLATES"}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {allTemplates.map((t) => {
                                                const isRecommended = primary.includes(t);
                                                return (
                                                    <button
                                                        key={t.name}
                                                        onClick={async () => {
                                                            if (hasRoadmap && !confirm(`Apply "${t.name}" template? This will replace your current roadmap.`)) return;
                                                            setSaving(true);
                                                            await applyXpTemplate(t.actions, t.milestones);
                                                            setSaving(false);
                                                        }}
                                                        disabled={saving}
                                                        className="flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition active:scale-95 disabled:opacity-40"
                                                        style={{
                                                            borderColor: isRecommended ? "rgba(249,115,22,0.3)" : "rgba(255,255,255,0.06)",
                                                            backgroundColor: isRecommended ? "rgba(249,115,22,0.04)" : "rgba(255,255,255,0.02)",
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-sans text-[13px] font-semibold" style={{ color: isRecommended ? "#F97316" : "rgba(255,255,255,0.6)" }}>
                                                                {t.name}
                                                            </span>
                                                            {isRecommended && (
                                                                <span className="rounded px-1 py-0.5 font-sans text-[8px] font-bold" style={{ backgroundColor: "rgba(249,115,22,0.15)", color: "#F97316" }}>
                                                                    MATCH
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <span className="rounded-md px-1.5 py-0.5 font-sans text-[9px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                                                                {t.actions.length} actions
                                                            </span>
                                                            <span className="rounded-md px-1.5 py-0.5 font-sans text-[9px] text-white/30" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                                                                {t.milestones.length} tiers
                                                            </span>
                                                        </div>
                                                        {/* Mini milestone preview */}
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
                                );
                            })()}

                            {/* Actions section */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-sans text-[13px] font-semibold text-white/60">Actions that earn XP</h3>
                                    <span className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                                        {xpActions.length} actions
                                    </span>
                                </div>

                                {/* Existing actions */}
                                {xpActions.map((a) => (
                                    <div key={a.id} className="mb-2 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: a.active ? "rgba(249,115,22,0.1)" : "rgba(255,255,255,0.04)" }}>
                                            <span className="font-mono text-[13px] font-bold" style={{ color: a.active ? "#F97316" : "rgba(255,255,255,0.2)" }}>
                                                +{a.points}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-sans text-[13px] font-semibold text-white/80">{a.label}</p>
                                            {a.description && <p className="font-sans text-[11px] text-white/30">{a.description}</p>}
                                            {a.max_per_day && <p className="font-sans text-[10px] text-white/20">Max {a.max_per_day}x per day</p>}
                                        </div>
                                        <button
                                            onClick={async () => { await toggleXpAction(a.id, !a.active); }}
                                            className="shrink-0 rounded-lg px-2.5 py-1 font-sans text-[10px] font-semibold"
                                            style={{
                                                backgroundColor: a.active ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.04)",
                                                color: a.active ? "#4ADE80" : "rgba(255,255,255,0.3)",
                                                border: `1px solid ${a.active ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"}`,
                                            }}
                                        >
                                            {a.active ? "Active" : "Paused"}
                                        </button>
                                        <button
                                            onClick={async () => { await deleteXpAction(a.id); }}
                                            className="shrink-0 rounded-lg p-1.5 opacity-40 hover:opacity-100"
                                            style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                        </button>
                                    </div>
                                ))}

                                {/* Add action — preset grid */}
                                <p className="mt-3 mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">ADD AN ACTION</p>
                                <div className="grid grid-cols-3 gap-2">
                                    {XP_ACTION_PRESETS.map((preset) => {
                                        const exists = xpActions.some((a) => a.action === preset.action);
                                        return (
                                            <button
                                                key={preset.action}
                                                disabled={exists && preset.action !== "custom"}
                                                onClick={async () => {
                                                    setSaving(true);
                                                    await addXpAction(preset);
                                                    setSaving(false);
                                                }}
                                                className="flex flex-col items-center gap-1 rounded-xl border p-3 font-sans text-[11px] font-medium transition active:scale-95 disabled:opacity-30"
                                                style={{
                                                    borderColor: exists ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)",
                                                    backgroundColor: exists ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.02)",
                                                    color: exists ? "#4ADE80" : "rgba(255,255,255,0.4)",
                                                }}
                                            >
                                                <span className="font-mono text-[12px] font-bold" style={{ color: "#F97316" }}>+{preset.points}</span>
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Milestones section */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-sans text-[13px] font-semibold text-white/60">Milestones</h3>
                                    <span className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold" style={{ backgroundColor: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                                        {xpMilestones.length} tiers
                                    </span>
                                </div>

                                {/* Visual roadmap */}
                                {xpMilestones.length > 0 && (
                                    <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                        <div className="relative">
                                            {/* Track line */}
                                            <div className="absolute left-4 top-0 bottom-0 w-0.5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                                            {xpMilestones.map((m, i) => (
                                                <div key={m.id} className="relative flex items-start gap-4 pb-5 last:pb-0">
                                                    {/* Node */}
                                                    <div
                                                        className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                                                        style={{ backgroundColor: `${m.color}20`, border: `2px solid ${m.color}50` }}
                                                    >
                                                        <span className="font-mono text-[10px] font-bold" style={{ color: m.color }}>{i + 1}</span>
                                                    </div>
                                                    {/* Content */}
                                                    <div className="flex-1 pt-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-sans text-[14px] font-bold" style={{ color: m.color }}>{m.name}</span>
                                                            <span className="font-mono text-[11px] text-white/25">{m.threshold.toLocaleString()} XP</span>
                                                        </div>
                                                        {m.reward && <p className="mt-0.5 font-sans text-[12px] text-white/40">{m.reward}</p>}
                                                        {m.perks.length > 0 && (
                                                            <div className="mt-1.5 flex flex-wrap gap-1">
                                                                {m.perks.map((p) => (
                                                                    <span key={p} className="rounded-md px-2 py-0.5 font-sans text-[10px]" style={{ backgroundColor: `${m.color}10`, color: `${m.color}cc`, border: `1px solid ${m.color}20` }}>
                                                                        {p}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Delete */}
                                                    <button
                                                        onClick={async () => { await deleteXpMilestone(m.id); }}
                                                        className="shrink-0 rounded-lg p-1.5 opacity-30 hover:opacity-100"
                                                        style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Add milestone form */}
                                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                                    <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">ADD A MILESTONE</p>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input id="ms-name" placeholder="Tier name (e.g. Regular)" className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                            <input id="ms-threshold" type="number" placeholder="XP needed" className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                        </div>
                                        <input id="ms-reward" placeholder="Reward (e.g. Free coffee on every visit)" className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                        <input id="ms-perks" placeholder="Perks (comma-separated, e.g. Priority seating, 10% off)" className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                        {/* Color picker */}
                                        <div className="flex items-center gap-2">
                                            <span className="font-sans text-[11px] text-white/25">Color:</span>
                                            {MILESTONE_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    id={`ms-color-${c}`}
                                                    onClick={() => {
                                                        document.querySelectorAll("[id^=ms-color-]").forEach((el) => el.classList.remove("ring-2"));
                                                        document.getElementById(`ms-color-${c}`)?.classList.add("ring-2");
                                                    }}
                                                    className="h-5 w-5 rounded-full ring-white/50 ring-offset-1 ring-offset-black"
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                const nameEl = document.getElementById("ms-name") as HTMLInputElement;
                                                const thresholdEl = document.getElementById("ms-threshold") as HTMLInputElement;
                                                const rewardEl = document.getElementById("ms-reward") as HTMLInputElement;
                                                const perksEl = document.getElementById("ms-perks") as HTMLInputElement;
                                                const selectedColor = document.querySelector("[id^=ms-color-].ring-2") as HTMLElement;
                                                if (!nameEl.value || !thresholdEl.value) return;
                                                setSaving(true);
                                                await addXpMilestone({
                                                    name: nameEl.value,
                                                    threshold: parseInt(thresholdEl.value),
                                                    color: selectedColor?.style.backgroundColor || "#F97316",
                                                    reward: rewardEl.value || undefined,
                                                    perks: perksEl.value ? perksEl.value.split(",").map((p) => p.trim()).filter(Boolean) : undefined,
                                                });
                                                nameEl.value = "";
                                                thresholdEl.value = "";
                                                rewardEl.value = "";
                                                perksEl.value = "";
                                                setSaving(false);
                                            }}
                                            disabled={saving}
                                            className="mt-1 rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98] disabled:opacity-40"
                                            style={{ backgroundColor: "#F97316" }}
                                        >
                                            {saving ? "Saving..." : "Add Milestone"}
                                        </button>
                                    </div>
                                </div>
                            </div>
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
