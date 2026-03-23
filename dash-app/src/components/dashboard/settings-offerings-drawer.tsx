"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { addOffering, updateOffering, deleteOffering, toggleOffering, uploadOfferingImage } from "@/app/settings/actions";
import { linkStaffToOffering, unlinkStaffFromOffering } from "@/app/settings/staff-offering-actions";

// ─── Constants ───────────────────────────────────────────────────

const OFFERING_TYPES = [
    { id: "membership", label: "Membership", icon: "👑", recurring: true, defaultPrice: 2500, defaultName: "Membership", defaultDesc: "Exclusive access and perks" },
    { id: "reservation", label: "Reservation", icon: "🪑", recurring: false, defaultPrice: 5000, defaultName: "Table / Booth", defaultDesc: "Reserve a spot for your group" },
    { id: "service", label: "Service", icon: "✂️", recurring: false, defaultPrice: 3500, defaultName: "Service", defaultDesc: "A priced service with a set duration" },
    { id: "product", label: "Product", icon: "☕", recurring: false, defaultPrice: 500, defaultName: "Item", defaultDesc: "A physical good available for purchase" },
    { id: "event", label: "Event", icon: "🎟️", recurring: false, defaultPrice: 1500, defaultName: "Event Ticket", defaultDesc: "Entry to a special event" },
    { id: "package", label: "Package", icon: "📦", recurring: false, defaultPrice: 10000, defaultName: "Package", defaultDesc: "A bundle of services and access" },
    { id: "custom", label: "Custom", icon: "✦", recurring: false, defaultPrice: 0, defaultName: "", defaultDesc: "" },
];

interface OfferingTemplate {
    type: string;
    name: string;
    description: string;
    price_cents: number;
    recurring: boolean;
    interval?: string;
    perks?: string[];
    duration_minutes?: number;
    add_ons?: { name: string; price_cents: number }[];
}

interface VenueTemplate {
    id: string;
    label: string;
    icon: string;
    description: string;
    offerings: OfferingTemplate[];
}

const VENUE_TEMPLATES: VenueTemplate[] = [
    {
        id: "cafe", label: "Cafe", icon: "☕", description: "Coffee shop, bakery, or tea house",
        offerings: [
            { type: "product", name: "Drip Coffee", description: "House blend, any size", price_cents: 400, recurring: false },
            { type: "product", name: "Latte", description: "Espresso with steamed milk — any milk", price_cents: 550, recurring: false },
            { type: "product", name: "Pastry Box", description: "Pick any 2 pastries", price_cents: 800, recurring: false },
            { type: "reservation", name: "Power Outlet Spot", description: "Reserved desk near an outlet for 2 hours", price_cents: 500, recurring: false, duration_minutes: 120 },
            { type: "membership", name: "Regular", description: "Free drip coffee daily, 10% off everything else", price_cents: 2500, recurring: true, interval: "month", perks: ["Free drip coffee daily", "10% off food & drinks", "Priority seating"] },
            { type: "event", name: "Latte Art Class", description: "Learn to pour rosettas with our head barista", price_cents: 3500, recurring: false, duration_minutes: 60 },
        ],
    },
    {
        id: "bar", label: "Bar", icon: "🍸", description: "Cocktail bar, pub, or wine bar",
        offerings: [
            { type: "product", name: "House Cocktail", description: "Bartender's choice — changes weekly", price_cents: 1400, recurring: false },
            { type: "product", name: "Beer Flight", description: "4 local taps, 5oz each", price_cents: 1200, recurring: false },
            { type: "reservation", name: "Booth Reservation", description: "Reserved booth for your group, 2-hour hold", price_cents: 5000, recurring: false, duration_minutes: 120, add_ons: [{ name: "Bottle Service", price_cents: 12000 }, { name: "Champagne Add-On", price_cents: 8000 }] },
            { type: "package", name: "VIP Table + Bottle", description: "Premium booth with a bottle of your choice", price_cents: 15000, recurring: false, perks: ["Reserved booth all night", "1 premium bottle", "Dedicated server", "Skip the line"] },
            { type: "membership", name: "Bar Member", description: "Skip the line, tab priority, members-only happy hour", price_cents: 3000, recurring: true, interval: "month", perks: ["Skip the line", "Members-only happy hour (half off)", "Tab priority", "Birthday bottle on the house"] },
            { type: "event", name: "Live Music Night", description: "Cover for tonight's live performance", price_cents: 1500, recurring: false },
        ],
    },
    {
        id: "restaurant", label: "Restaurant", icon: "🍽️", description: "Sit-down dining, fast casual, or bistro",
        offerings: [
            { type: "reservation", name: "Table for 2", description: "Indoor seating, 90-minute window", price_cents: 0, recurring: false, duration_minutes: 90 },
            { type: "reservation", name: "Table for 4-6", description: "Group seating, 2-hour window", price_cents: 0, recurring: false, duration_minutes: 120 },
            { type: "reservation", name: "Private Dining Room", description: "Enclosed space for up to 12 guests", price_cents: 10000, recurring: false, duration_minutes: 180 },
            { type: "package", name: "Chef's Tasting Menu", description: "5-course seasonal tasting with wine pairing", price_cents: 8500, recurring: false, perks: ["5 courses", "Wine pairing", "Amuse-bouche", "Dessert & coffee"] },
            { type: "membership", name: "Dining Club", description: "Priority reservations, complimentary appetizer, member events", price_cents: 5000, recurring: true, interval: "month", perks: ["Priority reservations", "Complimentary appetizer each visit", "Quarterly wine dinner invite", "15% off takeout"] },
            { type: "event", name: "Wine Dinner", description: "Themed multi-course dinner with sommelier", price_cents: 12000, recurring: false, duration_minutes: 180 },
        ],
    },
    {
        id: "coworking", label: "Coworking", icon: "💻", description: "Shared workspace, study spot, or hot desk",
        offerings: [
            { type: "product", name: "Day Pass", description: "Full-day access to open desks and Wi-Fi", price_cents: 2500, recurring: false },
            { type: "reservation", name: "Meeting Room (1hr)", description: "Private room with screen and whiteboard", price_cents: 3000, recurring: false, duration_minutes: 60 },
            { type: "membership", name: "Flex Member", description: "10 days/month, any desk, all amenities", price_cents: 15000, recurring: true, interval: "month", perks: ["10 days per month", "Any open desk", "Meeting room credits (2hrs/mo)", "Printer access", "Community events"] },
            { type: "membership", name: "Unlimited", description: "Daily access, dedicated desk, mail handling", price_cents: 30000, recurring: true, interval: "month", perks: ["Unlimited daily access", "Dedicated desk", "Mail handling", "5hrs meeting room/mo", "Guest passes (2/mo)"] },
            { type: "event", name: "Networking Mixer", description: "Monthly community networking event", price_cents: 0, recurring: false, duration_minutes: 120 },
        ],
    },
    {
        id: "salon", label: "Salon / Barbershop", icon: "✂️", description: "Hair, nails, grooming, or spa",
        offerings: [
            { type: "service", name: "Haircut", description: "Cut, wash, and style", price_cents: 3500, recurring: false, duration_minutes: 45 },
            { type: "service", name: "Beard Trim", description: "Shape, line, and hot towel", price_cents: 1500, recurring: false, duration_minutes: 20 },
            { type: "service", name: "Color Treatment", description: "Full color or highlights — consultation included", price_cents: 8000, recurring: false, duration_minutes: 90 },
            { type: "package", name: "The Works", description: "Cut + beard + hot towel + scalp massage", price_cents: 5500, recurring: false, duration_minutes: 60, perks: ["Haircut & style", "Beard trim", "Hot towel treatment", "Scalp massage"] },
            { type: "membership", name: "Monthly Cut", description: "One haircut per month, priority booking", price_cents: 2500, recurring: true, interval: "month", perks: ["1 haircut/month", "Priority booking", "10% off products", "Free beard trim add-on"] },
            { type: "product", name: "Pomade", description: "House-brand styling product", price_cents: 1800, recurring: false },
        ],
    },
    {
        id: "fitness", label: "Gym / Studio", icon: "🏋️", description: "Yoga, CrossFit, boxing, or fitness studio",
        offerings: [
            { type: "service", name: "Drop-In Class", description: "Single class — any on today's schedule", price_cents: 2500, recurring: false, duration_minutes: 60 },
            { type: "package", name: "10-Class Pack", description: "10 classes, use anytime within 3 months", price_cents: 18000, recurring: false },
            { type: "membership", name: "Unlimited Monthly", description: "Unlimited classes, open gym, member perks", price_cents: 12000, recurring: true, interval: "month", perks: ["Unlimited classes", "Open gym access", "Guest pass (1/mo)", "10% off retail", "Priority booking"] },
            { type: "service", name: "Personal Training", description: "1-on-1 session with a certified trainer", price_cents: 7500, recurring: false, duration_minutes: 60 },
            { type: "event", name: "Workshop", description: "Special technique or wellness workshop", price_cents: 4000, recurring: false, duration_minutes: 120 },
            { type: "product", name: "Protein Shake", description: "Post-workout shake from the bar", price_cents: 800, recurring: false },
        ],
    },
    {
        id: "club", label: "Club / Nightlife", icon: "🎧", description: "Nightclub, dance venue, or live music hall",
        offerings: [
            { type: "event", name: "General Admission", description: "Entry for tonight", price_cents: 2000, recurring: false },
            { type: "event", name: "VIP Entry", description: "Skip the line, access to VIP area", price_cents: 5000, recurring: false },
            { type: "reservation", name: "Table Service", description: "Reserved table with 1 bottle", price_cents: 25000, recurring: false, add_ons: [{ name: "Extra Bottle", price_cents: 15000 }, { name: "Sparkler Show", price_cents: 5000 }] },
            { type: "package", name: "Birthday Package", description: "Table + 2 bottles + cake + sparklers", price_cents: 50000, recurring: false, perks: ["Reserved table all night", "2 premium bottles", "Custom cake", "Sparkler entrance", "Photographer"] },
            { type: "membership", name: "Guest List", description: "Free entry every night, skip the line, plus-one included", price_cents: 5000, recurring: true, interval: "month", perks: ["Free entry every night", "Skip the line", "Plus-one included", "Early access to events", "Members-only pre-parties"] },
            { type: "product", name: "Merch — Tour Tee", description: "Limited edition venue t-shirt", price_cents: 3500, recurring: false },
        ],
    },
    {
        id: "running_club", label: "Running Club", icon: "🏃", description: "Running group, cycling club, or outdoor fitness",
        offerings: [
            { type: "event", name: "Weekly Group Run", description: "Show up, warm up, run together", price_cents: 0, recurring: false, duration_minutes: 60 },
            { type: "membership", name: "Club Member", description: "Access to all runs, group chat, merch discounts", price_cents: 1000, recurring: true, interval: "month", perks: ["All group runs", "Members-only Strava group", "20% off merch", "Race entry discounts"] },
            { type: "product", name: "Club Tee", description: "Dri-fit crew shirt with logo", price_cents: 2800, recurring: false },
            { type: "event", name: "Race Entry", description: "Club-organized 5K/10K/half", price_cents: 3500, recurring: false },
            { type: "package", name: "Season Pass", description: "3-month all-access + race entry + tee", price_cents: 6000, recurring: false, perks: ["3 months membership", "One race entry", "Club tee", "Training plan"] },
        ],
    },
    {
        id: "community_org", label: "Community Org", icon: "🏘️", description: "Neighborhood group, nonprofit, or community org",
        offerings: [
            { type: "membership", name: "Annual Membership", description: "Support the community, get a voice", price_cents: 2500, recurring: true, interval: "year", perks: ["Voting rights", "Newsletter", "Event discounts", "Member directory"] },
            { type: "event", name: "Community Meeting", description: "Monthly town hall — everyone welcome", price_cents: 0, recurring: false, duration_minutes: 90 },
            { type: "event", name: "Fundraiser", description: "Annual fundraising event", price_cents: 5000, recurring: false },
            { type: "event", name: "Volunteer Day", description: "Community cleanup / build day", price_cents: 0, recurring: false, duration_minutes: 240 },
            { type: "product", name: "Donation", description: "One-time contribution to the community fund", price_cents: 1000, recurring: false },
        ],
    },
    {
        id: "creator", label: "Creator / Brand", icon: "✨", description: "Content creator, influencer, or personal brand",
        offerings: [
            { type: "event", name: "Community Meetup", description: "IRL hangout with the community", price_cents: 0, recurring: false, duration_minutes: 120 },
            { type: "event", name: "Workshop", description: "Learn from the creator — limited seats", price_cents: 5000, recurring: false, duration_minutes: 180 },
            { type: "membership", name: "Inner Circle", description: "Exclusive content, early access, direct chat", price_cents: 1000, recurring: true, interval: "month", perks: ["Exclusive content", "Early access to drops", "Direct chat access", "Monthly AMA"] },
            { type: "product", name: "Merch Drop", description: "Limited edition merchandise", price_cents: 3000, recurring: false },
            { type: "package", name: "Founding Member", description: "Lifetime access + all merch drops + events", price_cents: 25000, recurring: false, perks: ["Lifetime membership", "All future merch free", "VIP at every event", "Name in credits"] },
            { type: "service", name: "1-on-1 Session", description: "Private consultation or coaching call", price_cents: 15000, recurring: false, duration_minutes: 60 },
        ],
    },
];

// ─── Types ───────────────────────────────────────────────────────

interface Offering {
    id: string;
    type: string;
    name: string;
    description?: string | null;
    price_cents: number;
    recurring?: boolean;
    interval?: string | null;
    perks?: string[];
    active?: boolean;
    sort_order?: number;
    stripe_price_id?: string | null;
    image_url?: string | null;
    created_at?: string;
}

interface StaffMember {
    id: string;
    display_name: string;
    role_title: string | null;
    avatar_url: string | null;
}

interface SettingsOfferingsDrawerProps {
    venueId: string;
    initialOfferings: Offering[];
    staff?: StaffMember[];
    staffOfferingLinks?: { staff_id: string; offering_id: string }[];
    onClose: () => void;
    onOfferingsChange?: (offerings: Offering[]) => void;
}

// ─── Component ───────────────────────────────────────────────────

export function SettingsOfferingsDrawer({
    venueId,
    initialOfferings,
    staff = [],
    staffOfferingLinks: initialLinks = [],
    onClose,
    onOfferingsChange,
}: SettingsOfferingsDrawerProps) {
    const [offerings, setOfferings] = useState<Offering[]>(initialOfferings);
    const [soLinks, setSoLinks] = useState(initialLinks);
    const [expandedOfferingStaff, setExpandedOfferingStaff] = useState<string | null>(null);

    // Form state
    const [showAddOffering, setShowAddOffering] = useState(false);
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [applyingTemplate, setApplyingTemplate] = useState(false);
    const [offeringType, setOfferingType] = useState("membership");
    const [offeringName, setOfferingName] = useState("");
    const [offeringDesc, setOfferingDesc] = useState("");
    const [offeringPrice, setOfferingPrice] = useState("");
    const [offeringPerks, setOfferingPerks] = useState("");
    const [offeringDuration, setOfferingDuration] = useState("");
    const [offeringAddOns, setOfferingAddOns] = useState("");
    const [offeringCapacity, setOfferingCapacity] = useState("");
    const [offeringStartDate, setOfferingStartDate] = useState("");
    const [offeringStartTime, setOfferingStartTime] = useState("");
    const [offeringEndTime, setOfferingEndTime] = useState("");
    const [savingOffering, setSavingOffering] = useState(false);
    const [offeringMsg, setOfferingMsg] = useState("");
    const [togglingOffering, setTogglingOffering] = useState<string | null>(null);
    const [deletingOfferingId, setDeletingOfferingId] = useState<string | null>(null);

    // ─── Helpers ──────────────────────────────────────────────────

    function syncOfferings(next: Offering[]) {
        setOfferings(next);
        onOfferingsChange?.(next);
    }

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

        // Build event date ISO strings
        let starts_at: string | undefined;
        let ends_at: string | undefined;
        if (offeringType === "event" && offeringStartDate) {
            starts_at = offeringStartTime
                ? new Date(`${offeringStartDate}T${offeringStartTime}`).toISOString()
                : new Date(`${offeringStartDate}T00:00:00`).toISOString();
            if (offeringEndTime) {
                ends_at = new Date(`${offeringStartDate}T${offeringEndTime}`).toISOString();
            }
        }

        const result = await addOffering({
            name: offeringName.trim(),
            type: offeringType,
            description: offeringDesc.trim() || undefined,
            price_cents: Math.round(parseFloat(offeringPrice || "0") * 100),
            recurring: template?.recurring || false,
            interval: template?.recurring ? "month" : undefined,
            perks: offeringPerks.split("\n").map((p) => p.trim()).filter(Boolean),
            duration_minutes: offeringDuration ? parseInt(offeringDuration) : undefined,
            capacity: offeringCapacity ? parseInt(offeringCapacity) : undefined,
            add_ons: parsedAddOns.length > 0 ? parsedAddOns : undefined,
            starts_at,
            ends_at,
        });
        if (result.error) {
            setOfferingMsg(result.error);
        } else {
            setOfferingMsg("Added!");
            setShowAddOffering(false);
            setOfferingName(""); setOfferingDesc(""); setOfferingPrice(""); setOfferingPerks(""); setOfferingDuration(""); setOfferingAddOns(""); setOfferingCapacity(""); setOfferingStartDate(""); setOfferingStartTime(""); setOfferingEndTime("");
            // Optimistic: add a placeholder offering to local state — page reload will get real data
            const newOffering: Offering = {
                id: `temp-${Date.now()}`,
                type: offeringType,
                name: offeringName.trim(),
                description: offeringDesc.trim() || null,
                price_cents: Math.round(parseFloat(offeringPrice || "0") * 100),
                recurring: template?.recurring || false,
                interval: template?.recurring ? "month" : null,
                perks: offeringPerks.split("\n").map((p) => p.trim()).filter(Boolean),
                active: true,
                sort_order: offerings.length,
                stripe_price_id: null,
                image_url: null,
                created_at: new Date().toISOString(),
            };
            syncOfferings([...offerings, newOffering]);
            setTimeout(() => setOfferingMsg(""), 2000);
        }
        setSavingOffering(false);
    }

    async function handleToggleOffering(id: string, active: boolean) {
        setTogglingOffering(id);
        await toggleOffering(id, active);
        syncOfferings(offerings.map((o) => o.id === id ? { ...o, active } : o));
        setTogglingOffering(null);
    }

    async function handleDeleteOffering(id: string) {
        setDeletingOfferingId(id);
        await deleteOffering(id);
        syncOfferings(offerings.filter((o) => o.id !== id));
        setDeletingOfferingId(null);
    }

    async function handleApplyTemplate(template: VenueTemplate) {
        setApplyingTemplate(true);
        let added = 0;
        for (const o of template.offerings) {
            const result = await addOffering({
                name: o.name,
                type: o.type,
                description: o.description,
                price_cents: o.price_cents,
                recurring: o.recurring,
                interval: o.interval,
                perks: o.perks,
                duration_minutes: o.duration_minutes,
                add_ons: o.add_ons,
            });
            if (!result.error) {
                added++;
                const newOff: Offering = {
                    id: `temp-${Date.now()}-${added}`,
                    type: o.type,
                    name: o.name,
                    description: o.description || null,
                    price_cents: o.price_cents,
                    recurring: o.recurring,
                    interval: o.interval || null,
                    perks: o.perks || [],
                    active: true,
                    sort_order: offerings.length + added,
                    stripe_price_id: null,
                    image_url: null,
                    created_at: new Date().toISOString(),
                };
                setOfferings((prev) => [...prev, newOff]);
            }
        }
        setApplyingTemplate(false);
        setShowTemplatePicker(false);
        setOfferingMsg(`Added ${added} offerings from "${template.label}" template`);
        // Sync final state to parent
        onOfferingsChange?.(offerings);
        setTimeout(() => setOfferingMsg(""), 3000);
    }

    // ─── Render ───────────────────────────────────────────────────

    return (
        <>
            <motion.div
                key="offerings-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-50 bg-black/30"
            />
            <motion.div
                key="offerings-drawer"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed right-0 top-0 z-50 flex h-full w-[90vw] max-w-lg flex-col border-l border-gray-200 bg-white shadow-xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <p className="font-sans text-[16px] font-bold text-gray-900">Offerings</p>
                        <p className="font-sans text-[12px] text-gray-400">Memberships, reservations, products, events</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                    {/* Empty state */}
                    {offerings.length === 0 && !showAddOffering && !showTemplatePicker && (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 py-8 text-center">
                            <p className="font-sans text-[14px] text-gray-400">No offerings configured yet.</p>
                            <p className="mt-1 font-sans text-[12px] text-gray-300">Start with a template or create your own.</p>
                        </div>
                    )}

                    {/* Template Picker */}
                    {showTemplatePicker && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                            <div className="flex items-center justify-between mb-3">
                                <p className="font-sans text-[13px] font-semibold text-gray-600">Choose a template for your venue type</p>
                                <button onClick={() => setShowTemplatePicker(false)} className="font-sans text-[12px] text-gray-400 hover:text-gray-600">Cancel</button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {VENUE_TEMPLATES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleApplyTemplate(t)}
                                        disabled={applyingTemplate}
                                        className="flex flex-col items-center gap-2 rounded-xl bg-white px-3 py-4 text-center border border-gray-100 transition hover:scale-[1.02] hover:border-violet-200 active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <span className="text-[24px]">{t.icon}</span>
                                        <span className="font-sans text-[12px] font-semibold text-gray-700">{t.label}</span>
                                        <span className="font-sans text-[9px] text-gray-300">{t.offerings.length} offerings</span>
                                    </button>
                                ))}
                            </div>
                            {applyingTemplate && (
                                <p className="mt-3 text-center font-sans text-[12px] text-violet-500">Adding offerings...</p>
                            )}
                        </div>
                    )}

                    {/* Offering Cards */}
                    {offerings.map((o) => {
                        const typeInfo = OFFERING_TYPES.find((t) => t.id === o.type);
                        return (
                            <div
                                key={o.id}
                                className="group flex items-start gap-4 rounded-xl border border-gray-100 bg-white p-4 transition"
                                style={{ opacity: o.active ? 1 : 0.5 }}
                            >
                                {/* Image or icon */}
                                <label className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-orange-50">
                                    {o.image_url ? (
                                        <img src={o.image_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <span className="text-[18px]">{typeInfo?.icon || "✦"}</span>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    </div>
                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const fd = new FormData();
                                        fd.append("file", file);
                                        const result = await uploadOfferingImage(o.id, fd);
                                        if ("url" in result && result.url) {
                                            syncOfferings(offerings.map((off) => off.id === o.id ? { ...off, image_url: result.url! } : off));
                                        }
                                    }} />
                                </label>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-sans text-[14px] font-semibold text-gray-900">{o.name}</p>
                                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-sans text-[10px] font-medium text-gray-400">
                                            {typeInfo?.label || o.type}
                                        </span>
                                    </div>
                                    {o.description && <p className="mt-1 font-sans text-[12px] text-gray-400">{o.description}</p>}
                                    <div className="mt-2 flex items-center gap-3">
                                        <span className="font-mono text-[14px] font-bold text-orange-500">
                                            ${(o.price_cents / 100).toFixed(2)}
                                            {o.recurring && <span className="font-sans text-[11px] font-normal text-gray-300">/{o.interval || "mo"}</span>}
                                        </span>
                                        {o.perks && o.perks.length > 0 && (
                                            <span className="font-sans text-[11px] text-gray-300">{o.perks.length} perks</span>
                                        )}
                                        {o.stripe_price_id && (
                                            <span className="rounded-full bg-green-50 px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider text-green-500">STRIPE</span>
                                        )}
                                    </div>

                                    {/* Staff assigned to this offering */}
                                    {staff.length > 0 && ["service", "reservation", "event", "custom"].includes(o.type) && (
                                        <div className="mt-2">
                                            <button
                                                onClick={() => setExpandedOfferingStaff(expandedOfferingStaff === o.id ? null : o.id)}
                                                className="flex items-center gap-1.5 font-sans text-[11px] text-gray-400 transition hover:text-gray-600"
                                            >
                                                {(() => {
                                                    const linked = soLinks.filter((l) => l.offering_id === o.id);
                                                    if (linked.length === 0) return "+ Assign staff";
                                                    const names = linked.map((l) => staff.find((s) => s.id === l.staff_id)?.display_name).filter(Boolean);
                                                    return `Staff: ${names.join(", ")}`;
                                                })()}
                                            </button>
                                            {expandedOfferingStaff === o.id && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {staff.map((s) => {
                                                        const isLinked = soLinks.some((l) => l.staff_id === s.id && l.offering_id === o.id);
                                                        return (
                                                            <button
                                                                key={s.id}
                                                                onClick={async () => {
                                                                    if (isLinked) {
                                                                        await unlinkStaffFromOffering(venueId, s.id, o.id);
                                                                        setSoLinks((prev) => prev.filter((l) => !(l.staff_id === s.id && l.offering_id === o.id)));
                                                                    } else {
                                                                        await linkStaffToOffering(venueId, s.id, o.id);
                                                                        setSoLinks((prev) => [...prev, { staff_id: s.id, offering_id: o.id }]);
                                                                    }
                                                                }}
                                                                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10px] font-medium transition"
                                                                style={{
                                                                    backgroundColor: isLinked ? "rgba(249,115,22,0.08)" : "rgba(0,0,0,0.02)",
                                                                    color: isLinked ? "#F97316" : "#9CA3AF",
                                                                    border: `1px solid ${isLinked ? "rgba(249,115,22,0.25)" : "rgba(0,0,0,0.06)"}`,
                                                                }}
                                                            >
                                                                {s.avatar_url ? (
                                                                    <img src={s.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                                                                ) : (
                                                                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-[8px] font-bold text-gray-500">{s.display_name.charAt(0)}</span>
                                                                )}
                                                                {s.display_name.split(" ")[0]}
                                                                {isLinked && " ✓"}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        onClick={() => handleToggleOffering(o.id, !o.active)}
                                        disabled={togglingOffering === o.id}
                                        className="rounded-lg px-3 py-1.5 font-sans text-[11px] font-medium transition"
                                        style={{
                                            backgroundColor: o.active ? "rgba(74,222,128,0.1)" : "rgba(0,0,0,0.03)",
                                            color: o.active ? "#16A34A" : "#9CA3AF",
                                        }}
                                    >
                                        {togglingOffering === o.id ? "..." : o.active ? "Active" : "Paused"}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteOffering(o.id)}
                                        disabled={deletingOfferingId === o.id}
                                        className="rounded-lg bg-red-50 p-1.5 opacity-0 transition group-hover:opacity-100"
                                    >
                                        {deletingOfferingId === o.id ? (
                                            <span className="font-sans text-[11px] text-red-500">...</span>
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
                        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
                            <p className="mb-3 font-sans text-[12px] font-semibold text-gray-500">Type</p>
                            <div className="mb-4 flex flex-wrap gap-2">
                                {OFFERING_TYPES.map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => loadOfferingTemplate(t.id)}
                                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-[12px] font-medium transition"
                                        style={{
                                            backgroundColor: offeringType === t.id ? "rgba(249,115,22,0.1)" : "rgba(0,0,0,0.02)",
                                            color: offeringType === t.id ? "#F97316" : "#9CA3AF",
                                            border: `1px solid ${offeringType === t.id ? "rgba(249,115,22,0.25)" : "rgba(0,0,0,0.06)"}`,
                                        }}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-col gap-3">
                                <FormField label="Name">
                                    <input value={offeringName} onChange={(e) => setOfferingName(e.target.value)} placeholder="e.g. VIP Membership" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                </FormField>
                                <FormField label="Description">
                                    <input value={offeringDesc} onChange={(e) => setOfferingDesc(e.target.value)} placeholder="Short description for guests" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                </FormField>
                                <FormField label={OFFERING_TYPES.find((t) => t.id === offeringType)?.recurring ? "Price ($/month)" : "Price ($)"}>
                                    <input type="number" step="0.01" value={offeringPrice} onChange={(e) => setOfferingPrice(e.target.value)} placeholder="25.00" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-mono text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                </FormField>
                                <FormField label="How long does it take?" hint="In minutes — skip if not applicable">
                                    <input type="number" value={offeringDuration} onChange={(e) => setOfferingDuration(e.target.value)} placeholder="60" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                </FormField>
                                <FormField label="How many can you book at the same time?" hint="e.g. 1 for a barber chair, 10 for a group class">
                                    <input type="number" min="1" value={offeringCapacity} onChange={(e) => setOfferingCapacity(e.target.value)} placeholder="1" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" style={{ maxWidth: 120 }} />
                                </FormField>
                                {(offeringType === "service" || offeringType === "reservation" || offeringType === "event") && (
                                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                                        <p className="font-sans text-[11px] font-semibold text-violet-600">Availability</p>
                                        <p className="mt-1 font-sans text-[10px] text-gray-500 leading-relaxed">
                                            {offeringType === "service"
                                                ? "Time slots come from staff schedules. Link staff members to this offering after creating it, and set their working hours in the Staff section."
                                                : "Time slots come from your venue hours. Set your operating hours in the Hours section — guests will see available slots within those times."
                                            }
                                        </p>
                                        {offeringType === "reservation" && (
                                            <p className="mt-1 font-sans text-[10px] text-gray-400">
                                                Capacity controls how many of these can be booked in the same time slot.
                                            </p>
                                        )}
                                    </div>
                                )}
                                {offeringType === "event" && (
                                    <>
                                        <FormField label="Event Date">
                                            <input type="date" value={offeringStartDate} onChange={(e) => setOfferingStartDate(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                        </FormField>
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField label="Start Time">
                                                <input type="time" value={offeringStartTime} onChange={(e) => setOfferingStartTime(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                            </FormField>
                                            <FormField label="End Time" hint="Optional">
                                                <input type="time" value={offeringEndTime} onChange={(e) => setOfferingEndTime(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                            </FormField>
                                        </div>
                                    </>
                                )}
                                <FormField label="What's included?" hint="One perk per line">
                                    <textarea value={offeringPerks} onChange={(e) => setOfferingPerks(e.target.value)} rows={3} placeholder={"Priority seating\n10% off drinks\nExclusive events"} className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                </FormField>
                                <FormField label="Optional add-ons" hint="Name - Price, one per line">
                                    <textarea value={offeringAddOns} onChange={(e) => setOfferingAddOns(e.target.value)} rows={2} placeholder={"Bottle Service - 120.00\nSkip the Line - 25.00"} className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-sans text-[14px] text-gray-900 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200" />
                                </FormField>
                            </div>
                            <div className="mt-4 flex items-center justify-end gap-2">
                                <button onClick={() => setShowAddOffering(false)} className="rounded-xl px-4 py-2 font-sans text-[13px] font-medium text-gray-400 hover:text-gray-600">Cancel</button>
                                <button
                                    onClick={handleAddOffering}
                                    disabled={savingOffering || !offeringName.trim()}
                                    className="rounded-xl bg-orange-500 px-5 py-2 font-sans text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
                                >
                                    {savingOffering ? "Saving..." : "Add Offering"}
                                </button>
                            </div>
                            {offeringMsg && <p className="mt-2 font-sans text-[13px]" style={{ color: offeringMsg === "Added!" ? "#16A34A" : "#EF4444" }}>{offeringMsg}</p>}
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowTemplatePicker(true)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 py-3 font-sans text-[13px] font-medium text-violet-400 transition hover:border-solid hover:border-violet-300 hover:text-violet-500"
                            >
                                Use Template
                            </button>
                            <button
                                onClick={() => { setShowAddOffering(true); loadOfferingTemplate("membership"); }}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-3 font-sans text-[13px] font-medium text-gray-400 transition hover:border-solid hover:border-gray-300 hover:text-gray-600"
                            >
                                + Add Custom
                            </button>
                        </div>
                    )}

                    {/* Status message */}
                    {offeringMsg && !showAddOffering && (
                        <p className="font-sans text-[13px] text-center" style={{ color: offeringMsg.includes("Added") ? "#16A34A" : "#EF4444" }}>{offeringMsg}</p>
                    )}
                </div>
            </motion.div>
        </>
    );
}

// ─── Local sub-components ────────────────────────────────────────

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
                <label className="font-sans text-[12px] font-semibold text-gray-500">{label}</label>
                {hint && <span className="font-sans text-[11px] text-gray-300">{hint}</span>}
            </div>
            {children}
        </div>
    );
}
