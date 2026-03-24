"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { updateVenue, updateVenuePage, addKnowledge, deleteKnowledge, addOffering, deleteOffering, toggleOffering, uploadOfferingImage, addXpAction, deleteXpAction, toggleXpAction, addXpMilestone, deleteXpMilestone, applyXpTemplate, saveCustomTemplate, deleteCustomTemplate, updateAiLimits, getAiUsageStats, addDigitalAsset, toggleDigitalAsset, deleteDigitalAsset, addMenuItem, toggleMenuItemStock, deleteMenuItem } from "./actions";
import type { DigitalAsset } from "@/lib/dashboard";
import { uploadGalleryImage, deleteGalleryImage, updateHeroImage, removeHeroImage } from "../../app/edit/gallery-actions";
import { addStaffMember, updateStaffMember, deleteStaffMember, uploadStaffAvatar, toggleStaffVisibility } from "./staff-actions";
import { linkStaffToOffering, unlinkStaffFromOffering } from "./staff-offering-actions";
import { StripeConnect } from "@/components/dashboard/stripe-connect";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

// ─── Constants ───────────────────────────────────────────────────

const TYPES = ["bar", "restaurant", "lounge", "club", "cafe", "coworking", "barbershop", "nail_salon", "group", "community", "league", "org", "artist", "musician", "creator", "other"];
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

// ─── Venue-Type Offering Templates ───────────────────────────────

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
            { type: "reservation", name: "Dedicated Desk", description: "Your own desk, locked storage, 24/7 access", price_cents: 0, recurring: false },
            { type: "membership", name: "Flex Member", description: "10 days/month, any desk, all amenities", price_cents: 15000, recurring: true, interval: "month", perks: ["10 days per month", "Any open desk", "Meeting room credits (2hrs/mo)", "Printer access", "Community events"] },
            { type: "membership", name: "Unlimited", description: "Daily access, dedicated desk, mail handling", price_cents: 30000, recurring: true, interval: "month", perks: ["Unlimited daily access", "Dedicated desk", "Mail handling", "5hrs meeting room/mo", "Guest passes (2/mo)"] },
            { type: "event", name: "Networking Mixer", description: "Monthly community networking event", price_cents: 0, recurring: false, duration_minutes: 120 },
        ],
    },
    {
        id: "lounge", label: "Lounge", icon: "🛋️", description: "Hookah lounge, wine bar, or members club",
        offerings: [
            { type: "product", name: "Hookah Session", description: "Premium shisha, choice of flavor", price_cents: 2500, recurring: false, duration_minutes: 90 },
            { type: "product", name: "Wine by the Glass", description: "House red, white, or rosé", price_cents: 1400, recurring: false },
            { type: "reservation", name: "VIP Section", description: "Private corner with bottle service", price_cents: 8000, recurring: false, duration_minutes: 180, add_ons: [{ name: "Extra Hookah", price_cents: 2000 }, { name: "Fruit Plate", price_cents: 1500 }] },
            { type: "membership", name: "Inner Circle", description: "Members-only access after 9 PM, priority everything", price_cents: 5000, recurring: true, interval: "month", perks: ["Access after 9 PM", "Priority seating", "10% off all orders", "Members-only events", "Birthday VIP package"] },
            { type: "event", name: "Vinyl Night", description: "Guest DJ spinning records, no cover for members", price_cents: 1000, recurring: false },
            { type: "package", name: "Date Night Package", description: "Reserved couch, bottle of wine, charcuterie board", price_cents: 7500, recurring: false, perks: ["Reserved couch for 2", "Bottle of wine (your pick)", "Charcuterie board", "Dessert"] },
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
        id: "running_club", label: "Running Club", icon: "🏃", description: "Running group, cycling club, or outdoor fitness",
        offerings: [
            { type: "event", name: "Weekly Group Run", description: "Show up, warm up, run together", price_cents: 0, recurring: false, duration_minutes: 60 },
            { type: "event", name: "Saturday Long Run", description: "8+ miles, all paces welcome", price_cents: 0, recurring: false, duration_minutes: 120 },
            { type: "membership", name: "Club Member", description: "Access to all runs, group chat, merch discounts", price_cents: 1000, recurring: true, interval: "month", perks: ["All group runs", "Members-only Strava group", "20% off merch", "Race entry discounts"] },
            { type: "product", name: "Club Tee", description: "Dri-fit crew shirt with logo", price_cents: 2800, recurring: false },
            { type: "event", name: "Race Entry", description: "Club-organized 5K/10K/half", price_cents: 3500, recurring: false },
            { type: "package", name: "Season Pass", description: "3-month all-access + race entry + tee", price_cents: 6000, recurring: false, perks: ["3 months membership", "One race entry", "Club tee", "Training plan"] },
        ],
    },
    {
        id: "book_club", label: "Book Club", icon: "📚", description: "Book club, reading group, or literary society",
        offerings: [
            { type: "event", name: "Monthly Meeting", description: "Discuss this month's pick over drinks", price_cents: 0, recurring: false, duration_minutes: 120 },
            { type: "membership", name: "Member", description: "Vote on picks, attend all meetings, early access to author events", price_cents: 500, recurring: true, interval: "month", perks: ["Vote on monthly picks", "All meetings", "Author event access", "Reading list archive"] },
            { type: "event", name: "Author Talk", description: "Live Q&A with a visiting author", price_cents: 1500, recurring: false, duration_minutes: 90 },
            { type: "product", name: "Book of the Month", description: "Pre-ordered copy of this month's pick", price_cents: 1600, recurring: false },
            { type: "package", name: "Annual Bundle", description: "12 months + all 12 books shipped", price_cents: 18000, recurring: false, perks: ["12 months membership", "All 12 books", "Priority seating at events", "Tote bag"] },
        ],
    },
    {
        id: "tech_meetup", label: "Tech Meetup", icon: "💻", description: "Tech meetup, hackathon, or developer community",
        offerings: [
            { type: "event", name: "Monthly Meetup", description: "Talks, demos, networking, pizza", price_cents: 0, recurring: false, duration_minutes: 150 },
            { type: "event", name: "Workshop", description: "Hands-on technical workshop, limited seats", price_cents: 2500, recurring: false, duration_minutes: 180 },
            { type: "event", name: "Hackathon", description: "24-hour build sprint with prizes", price_cents: 5000, recurring: false },
            { type: "membership", name: "Community Member", description: "Slack access, job board, speaker priority", price_cents: 0, recurring: false, perks: ["Slack community", "Job board access", "Speaker submissions", "Early event access"] },
            { type: "reservation", name: "Sponsor Table", description: "Branded table at next meetup — recruit, demo, network", price_cents: 25000, recurring: false },
            { type: "product", name: "Conference Tee", description: "Limited edition event shirt", price_cents: 2500, recurring: false },
        ],
    },
    {
        id: "sports_league", label: "Sports League", icon: "⚽", description: "Recreational league, pickup games, or team sports",
        offerings: [
            { type: "membership", name: "Season Registration", description: "Full season — games, jersey, playoffs", price_cents: 8000, recurring: false, perks: ["8-game season", "Team jersey", "Playoffs eligible", "End-of-season party"] },
            { type: "event", name: "Pickup Game", description: "Drop-in game, all skill levels", price_cents: 1000, recurring: false, duration_minutes: 90 },
            { type: "event", name: "Tournament", description: "Single-day tournament with brackets", price_cents: 5000, recurring: false },
            { type: "product", name: "League Jersey", description: "Custom team jersey", price_cents: 3500, recurring: false },
            { type: "package", name: "Team Registration", description: "Register a full team (8-10 players)", price_cents: 50000, recurring: false, perks: ["8-10 player spots", "Team jerseys", "Guaranteed season spot", "Team photo"] },
            { type: "reservation", name: "Field Rental", description: "Private field for 2 hours", price_cents: 15000, recurring: false, duration_minutes: 120 },
        ],
    },
    {
        id: "community_org", label: "Community Org", icon: "🏘️", description: "Neighborhood group, nonprofit, or community org",
        offerings: [
            { type: "membership", name: "Annual Membership", description: "Support the community, get a voice", price_cents: 2500, recurring: true, interval: "year", perks: ["Voting rights", "Newsletter", "Event discounts", "Member directory"] },
            { type: "event", name: "Community Meeting", description: "Monthly town hall — everyone welcome", price_cents: 0, recurring: false, duration_minutes: 90 },
            { type: "event", name: "Fundraiser", description: "Annual fundraising event", price_cents: 5000, recurring: false },
            { type: "event", name: "Volunteer Day", description: "Community cleanup / build day", price_cents: 0, recurring: false, duration_minutes: 240 },
            { type: "reservation", name: "Community Space", description: "Reserve the space for your event (members only)", price_cents: 5000, recurring: false, duration_minutes: 180 },
            { type: "product", name: "Donation", description: "One-time contribution to the community fund", price_cents: 1000, recurring: false },
        ],
    },
    {
        id: "touring_artist", label: "Touring Artist", icon: "🎤", description: "Musician, DJ, band, or performing artist",
        offerings: [
            { type: "event", name: "General Admission", description: "Entry to tonight's show", price_cents: 2500, recurring: false },
            { type: "event", name: "VIP Experience", description: "Early entry, front row, meet & greet after", price_cents: 7500, recurring: false, perks: ["Early entry", "Front row access", "Meet & greet", "Signed poster"] },
            { type: "membership", name: "Fan Club", description: "Early access to tickets, unreleased tracks, group chat", price_cents: 500, recurring: true, interval: "month", perks: ["Pre-sale tickets", "Unreleased music", "Fan-only chat", "Birthday shoutout"] },
            { type: "product", name: "Tour Tee", description: "Limited edition tour shirt", price_cents: 3500, recurring: false },
            { type: "package", name: "Tour Bundle", description: "Tee + poster + digital download", price_cents: 4500, recurring: false, perks: ["Tour tee", "Signed poster", "Digital EP download", "Sticker pack"] },
            { type: "service", name: "Meet & Greet", description: "20 min — photo, conversation, signed merch", price_cents: 10000, recurring: false, duration_minutes: 20 },
            { type: "product", name: "Signed Vinyl", description: "Limited press, hand-signed", price_cents: 4000, recurring: false },
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

const SECTION_GROUPS = [
    {
        group: "SET UP YOUR SPOT",
        sections: [
            { id: "general", label: "Basics", icon: "◉" },
            { id: "location", label: "Where You Are", icon: "◎" },
            { id: "branding", label: "Look & Feel", icon: "◈" },
            { id: "photos", label: "Photos", icon: "📷" },
        ],
    },
    {
        group: "WHAT YOU OFFER",
        sections: [
            { id: "hours", label: "Hours", icon: "◇" },
            { id: "offerings", label: "What You Sell", icon: "💰" },
            { id: "staff", label: "Your Team", icon: "👤" },
        ],
    },
    {
        group: "ENGAGE GUESTS",
        sections: [
            { id: "rules", label: "Vibe & Rules", icon: "◆" },
            { id: "xp", label: "Loyalty Rewards", icon: "⚡" },
            { id: "digital_assets", label: "Digital Assets", icon: "🎨" },
            { id: "agent", label: "AI Chat", icon: "🤖" },
            { id: "qr", label: "QR Codes", icon: "▣" },
        ],
    },
    {
        group: "MANAGE",
        sections: [
            { id: "payments", label: "Payments", icon: "💳" },
            { id: "members", label: "Members", icon: "👥" },
            { id: "account", label: "Account", icon: "⚙" },
        ],
    },
];

const SECTIONS = SECTION_GROUPS.flatMap((g) => g.sections);

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
    image_url: string | null;
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

export interface SettingsClientProps {
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
        hero_image: string | null;
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
    gallery: { id: string; image_url: string; caption: string | null; sort_order: number }[];
    staff: { id: string; display_name: string; role_title: string | null; avatar_url: string | null; bio: string | null; specialties: string[]; visible: boolean; sort_order: number; schedule: unknown[]; created_at: string }[];
    staffOfferingLinks: { staff_id: string; offering_id: string }[];
    aiLimits: { free_messages_per_day: number; require_membership: boolean; gate_message: string } | null;
    digitalAssets: DigitalAsset[];
    menuItems?: { id: string; venue_id: string; category: string; name: string; description: string | null; price_cents: number; in_stock: boolean; inventory_count: number | null }[];
    embedded?: boolean;
}

type Props = SettingsClientProps;

// ─── Main Component ──────────────────────────────────────────────

export function SettingsClient({ user, role, venue, page, knowledge, members, memberCount, offerings, xpActions, xpMilestones, customTemplates, gallery: initialGallery = [], staff: initialStaff = [], staffOfferingLinks: initialLinks = [], aiLimits: initialAiLimits, digitalAssets, menuItems: initialMenuItems = [], embedded = false }: Props) {
    const [activeSection, setActiveSection] = useState("general");
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    // Deep link: scroll to hash section on mount
    useEffect(() => {
        const hash = window.location.hash.replace("#", "");
        if (hash) {
            const validSection = SECTIONS.find((s) => s.id === hash);
            if (validSection) {
                setActiveSection(hash);
                setTimeout(() => {
                    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
                }, 100);
            }
        }
    }, []);

    // Gallery state
    const [galleryImages, setGalleryImages] = useState(initialGallery);
    const [heroImage, setHeroImage] = useState(page?.hero_image || null);
    const [uploadingHero, setUploadingHero] = useState(false);
    const [uploadingGallery, setUploadingGallery] = useState(false);
    const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
    const [photoMsg, setPhotoMsg] = useState("");

    // Staff state
    const [staffList, setStaffList] = useState(initialStaff);
    const [showAddStaff, setShowAddStaff] = useState(false);
    const [newStaffName, setNewStaffName] = useState("");
    const [newStaffEmail, setNewStaffEmail] = useState("");
    const [newStaffTitle, setNewStaffTitle] = useState("");
    const [newStaffBio, setNewStaffBio] = useState("");
    const [newStaffSpecialties, setNewStaffSpecialties] = useState("");
    const [addingStaff, setAddingStaff] = useState(false);
    const [staffMsg, setStaffMsg] = useState("");
    const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
    const [editStaffName, setEditStaffName] = useState("");
    const [editStaffTitle, setEditStaffTitle] = useState("");
    const [editStaffBio, setEditStaffBio] = useState("");
    const [editStaffSpecialties, setEditStaffSpecialties] = useState("");
    const [editStaffSchedule, setEditStaffSchedule] = useState<{ day: string; working: boolean; start: string; end: string }[]>([]);
    const [savingStaff, setSavingStaff] = useState(false);

    // Menu items state
    const [menuItemsList, setMenuItemsList] = useState(initialMenuItems);
    const [showAddMenuItem, setShowAddMenuItem] = useState(false);
    const [newMenuCategory, setNewMenuCategory] = useState("");
    const [newMenuName, setNewMenuName] = useState("");
    const [newMenuDesc, setNewMenuDesc] = useState("");
    const [newMenuPrice, setNewMenuPrice] = useState("");
    const [newMenuInventory, setNewMenuInventory] = useState("");
    const [addingMenuItem, setAddingMenuItem] = useState(false);
    const [menuMsg, setMenuMsg] = useState("");

    // Staff-offering links
    const [soLinks, setSoLinks] = useState(initialLinks);
    const [expandedOfferingStaff, setExpandedOfferingStaff] = useState<string | null>(null);

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

    // AI usage limits
    const [aiLimitEnabled, setAiLimitEnabled] = useState(initialAiLimits !== null);
    const [aiFreeMessages, setAiFreeMessages] = useState(String(initialAiLimits?.free_messages_per_day ?? 10));
    const [aiRequireMembership, setAiRequireMembership] = useState(initialAiLimits?.require_membership ?? false);
    const [aiGateMessage, setAiGateMessage] = useState(initialAiLimits?.gate_message ?? "You've used your free messages for today. Sign up to keep chatting!");
    const [aiLimitsMsg, setAiLimitsMsg] = useState("");
    const [savingAiLimits, setSavingAiLimits] = useState(false);
    const [aiUsageStats, setAiUsageStats] = useState<{ todayMessages: number; todayGuests: number; weekMessages: number } | null>(null);

    // Offering fields
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
    const [offeringStartsAt, setOfferingStartsAt] = useState("");
    const [offeringEndsAt, setOfferingEndsAt] = useState("");
    const [offeringLocationName, setOfferingLocationName] = useState("");
    const [offeringLocationAddress, setOfferingLocationAddress] = useState("");
    const [offeringMaxAttendees, setOfferingMaxAttendees] = useState("");
    const [savingOffering, setSavingOffering] = useState(false);
    const [offeringMsg, setOfferingMsg] = useState("");
    const [togglingOffering, setTogglingOffering] = useState<string | null>(null);
    const [deletingOfferingId, setDeletingOfferingId] = useState<string | null>(null);

    // Digital asset fields
    const [showAddAsset, setShowAddAsset] = useState(false);
    const [assetName, setAssetName] = useState("");
    const [assetType, setAssetType] = useState("sticker");
    const [assetCategory, setAssetCategory] = useState("vibe");
    const [assetDesc, setAssetDesc] = useState("");
    const [assetXpCost, setAssetXpCost] = useState("");
    const [assetWalletPrice, setAssetWalletPrice] = useState("");
    const [assetCashPrice, setAssetCashPrice] = useState("");
    const [assetMinTier, setAssetMinTier] = useState("");
    const [assetAnimated, setAssetAnimated] = useState(false);
    const [assetDuration, setAssetDuration] = useState("");
    const [savingAsset, setSavingAsset] = useState(false);
    const [assetMsg, setAssetMsg] = useState("");
    const [togglingAsset, setTogglingAsset] = useState<string | null>(null);
    const [deletingAsset, setDeletingAsset] = useState<string | null>(null);

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
            capacity: offeringCapacity ? parseInt(offeringCapacity) : undefined,
            add_ons: parsedAddOns.length > 0 ? parsedAddOns : undefined,
            starts_at: offeringStartsAt || undefined,
            ends_at: offeringEndsAt || undefined,
            location_name: offeringLocationName.trim() || undefined,
            location_address: offeringLocationAddress.trim() || undefined,
            max_attendees: offeringMaxAttendees ? parseInt(offeringMaxAttendees) : undefined,
        });
        if (result.error) { setOfferingMsg(result.error); }
        else {
            setOfferingMsg("Added!");
            setShowAddOffering(false);
            setOfferingName(""); setOfferingDesc(""); setOfferingPrice(""); setOfferingPerks(""); setOfferingDuration(""); setOfferingAddOns(""); setOfferingCapacity("");
            setOfferingStartsAt(""); setOfferingEndsAt(""); setOfferingLocationName(""); setOfferingLocationAddress(""); setOfferingMaxAttendees("");
            setTimeout(() => setOfferingMsg(""), 2000);
        }
        setSavingOffering(false);
    }

    async function handleToggleOffering(id: string, active: boolean) {
        setTogglingOffering(id);
        await toggleOffering(id, active);
        setTogglingOffering(null);
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
            if (!result.error) added++;
        }
        setApplyingTemplate(false);
        setShowTemplatePicker(false);
        setOfferingMsg(`Added ${added} offerings from "${template.label}" template`);
        setTimeout(() => setOfferingMsg(""), 3000);
    }

    async function handleDeleteOffering(id: string) {
        setDeletingOfferingId(id);
        await deleteOffering(id);
        setDeletingOfferingId(null);
    }

    // ─── Digital Asset handlers ─────────────────────────────────────

    async function handleAddAsset() {
        if (!assetName.trim()) return;
        setSavingAsset(true);
        setAssetMsg("");
        const result = await addDigitalAsset({
            name: assetName.trim(),
            asset_type: assetType,
            category: assetCategory,
            description: assetDesc.trim() || undefined,
            xp_cost: assetXpCost ? parseInt(assetXpCost) : undefined,
            wallet_price_cents: assetWalletPrice ? Math.round(parseFloat(assetWalletPrice) * 100) : undefined,
            cash_price_cents: assetCashPrice ? Math.round(parseFloat(assetCashPrice) * 100) : undefined,
            min_tier: assetMinTier || undefined,
            is_animated: assetAnimated,
            duration_hours: assetDuration ? parseInt(assetDuration) : undefined,
        });
        if (result.error) { setAssetMsg(result.error); }
        else {
            setAssetMsg("Added!");
            setShowAddAsset(false);
            setAssetName(""); setAssetDesc(""); setAssetXpCost(""); setAssetWalletPrice(""); setAssetCashPrice(""); setAssetMinTier(""); setAssetAnimated(false); setAssetDuration("");
            setTimeout(() => setAssetMsg(""), 2000);
        }
        setSavingAsset(false);
    }

    async function handleToggleAsset(id: string, active: boolean) {
        setTogglingAsset(id);
        await toggleDigitalAsset(id, active);
        setTogglingAsset(null);
    }

    async function handleDeleteAsset(id: string) {
        setDeletingAsset(id);
        await deleteDigitalAsset(id);
        setDeletingAsset(null);
    }

    // ─── Navigate to section ───────────────────────────────────────

    function goToSection(id: string) {
        setActiveSection(id);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ─── Derived data ──────────────────────────────────────────────

    const activeCat = KNOWLEDGE_CATEGORIES.find((c) => c.id === activeKnowledgeCat)!;
    const filteredKnowledge = knowledge.filter((k) => k.category === activeKnowledgeCat);

    const headerAndNav = !embedded;

    return (
        <main className={embedded ? "min-h-0 h-full" : "min-h-svh"} style={{ backgroundColor: "#0A0A0A" }}>
            {/* Header — hidden in embedded mode */}
            {headerAndNav && (
            <header className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl sm:px-6" style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(10,10,10,0.9)" }}>
                <div className="flex items-center gap-3">
                    <Link href="/" className="flex items-center gap-1.5 text-white/40 hover:text-white/60 text-[13px] font-medium transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        Back to Chat
                    </Link>
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
            )}

            <div className={`mx-auto flex ${embedded ? "h-full" : "max-w-5xl"} gap-0 lg:gap-8`}>
                {/* Sidebar — desktop */}
                <nav className={`sticky ${embedded ? "top-0" : "top-[57px]"} hidden h-fit w-52 shrink-0 flex-col gap-0.5 py-8 lg:flex`}>
                    {SECTION_GROUPS.map((g) => (
                        <div key={g.group} className="mb-3">
                            <p className="mb-1.5 px-3 font-sans text-[9px] font-bold tracking-[2px]" style={{ color: "rgba(255,255,255,0.15)" }}>{g.group}</p>
                            {g.sections.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => goToSection(s.id)}
                                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-sans text-[13px] font-medium transition"
                                    style={{
                                        backgroundColor: activeSection === s.id ? "rgba(255,255,255,0.06)" : "transparent",
                                        color: activeSection === s.id ? "#fff" : "rgba(255,255,255,0.35)",
                                    }}
                                >
                                    <span style={{ color: activeSection === s.id ? "#F97316" : "rgba(255,255,255,0.2)" }}>{s.icon}</span>
                                    {s.label}
                                </button>
                            ))}
                        </div>
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
                        <Card id="general" title="Basics" desc="What's your spot called and what kind of place is it?">
                            <Field label="What's your venue called?">
                                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Rooftop, Blue Bottle Coffee" className="input" />
                            </Field>
                            <Field label="What kind of place is it?">
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
                                        <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>Guests can email this address to chat with your AI</p>
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
                        <Card id="location" title="Where You Are" desc="Where should guests go to find you?">
                            <Field label="Address" hint="Where guests show up">
                                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, Austin, TX" className="input" />
                            </Field>
                            <Field label="How many people can you fit?" hint="Approximate is fine">
                                <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="100" className="input" />
                            </Field>
                        </Card>

                        {/* ─── Branding ────────────────────────────────────────── */}
                        <Card id="branding" title="Look & Feel" desc="Give your page some personality — tagline, colors, and a short description.">
                            <Field label="Tagline" hint="One short line that captures your vibe">
                                <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. A rooftop for people who pay attention" maxLength={80} className="input" />
                                <span className="mt-1 text-right font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>{tagline.length}/80</span>
                            </Field>
                            <Field label="Tell guests what to expect" hint="2-3 sentences is plenty">
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="We're a rooftop bar in downtown Austin with craft cocktails, city views, and live DJs on weekends." className="input resize-none" />
                            </Field>
                            <Field label="Your color" hint="Pick a color that matches your brand">
                                <div className="flex items-center gap-3">
                                    <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                                    <input value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="input flex-1 font-mono" />
                                    <div className="h-10 w-20 rounded-lg" style={{ backgroundColor: themeColor }} />
                                </div>
                            </Field>
                        </Card>

                        {/* ─── Photos ──────────────────────────────────────────── */}
                        <Card id="photos" title="Photos" desc="Show off your space. Add a cover photo and up to 10 gallery shots.">
                            {/* Hero Image */}
                            <Field label="Cover Photo" hint="The big image at the top of your page">
                                {heroImage ? (
                                    <div className="group relative overflow-hidden rounded-xl" style={{ height: 180 }}>
                                        <img src={heroImage} alt="Hero" className="h-full w-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition group-hover:opacity-100" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
                                            <label className="cursor-pointer rounded-lg px-3 py-2 font-sans text-[12px] font-medium text-white" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                                                Change
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        setUploadingHero(true);
                                                        setPhotoMsg("");
                                                        const fd = new FormData();
                                                        fd.append("file", file);
                                                        const result = await updateHeroImage(venue.id, fd);
                                                        if (result.error) { setPhotoMsg(result.error); }
                                                        else if (result.url) { setHeroImage(result.url); setPhotoMsg("Hero updated!"); setTimeout(() => setPhotoMsg(""), 2000); }
                                                        setUploadingHero(false);
                                                    }}
                                                />
                                            </label>
                                            <button
                                                onClick={async () => {
                                                    setUploadingHero(true);
                                                    await removeHeroImage(venue.id);
                                                    setHeroImage(null);
                                                    setUploadingHero(false);
                                                }}
                                                className="rounded-lg px-3 py-2 font-sans text-[12px] font-medium"
                                                style={{ backgroundColor: "rgba(239,68,68,0.2)", color: "#EF4444" }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        {uploadingHero && (
                                            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
                                                <span className="font-sans text-[13px] text-white/60">Uploading...</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition hover:border-solid" style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                            <circle cx="9" cy="9" r="2" />
                                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                        </svg>
                                        <span className="font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                                            {uploadingHero ? "Uploading..." : "Click to upload hero image"}
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={uploadingHero}
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                setUploadingHero(true);
                                                setPhotoMsg("");
                                                const fd = new FormData();
                                                fd.append("file", file);
                                                const result = await updateHeroImage(venue.id, fd);
                                                if (result.error) { setPhotoMsg(result.error); }
                                                else if (result.url) { setHeroImage(result.url); setPhotoMsg("Hero uploaded!"); setTimeout(() => setPhotoMsg(""), 2000); }
                                                setUploadingHero(false);
                                            }}
                                        />
                                    </label>
                                )}
                            </Field>

                            {/* Gallery */}
                            <Field label="More Photos" hint={`${galleryImages.length}/10 — show guests what it's like inside`}>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                    {galleryImages.map((img) => (
                                        <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                                            <img src={img.image_url} alt={img.caption || "Gallery photo"} className="h-full w-full object-cover" />
                                            <button
                                                onClick={async () => {
                                                    setDeletingImageId(img.id);
                                                    const result = await deleteGalleryImage(venue.id, img.id);
                                                    if (!result.error) {
                                                        setGalleryImages((prev) => prev.filter((g) => g.id !== img.id));
                                                    }
                                                    setDeletingImageId(null);
                                                }}
                                                disabled={deletingImageId === img.id}
                                                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100"
                                                style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
                                            >
                                                {deletingImageId === img.id ? (
                                                    <span className="text-[10px] text-white/50">...</span>
                                                ) : (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
                                                        <path d="M18 6 6 18M6 6l12 12" />
                                                    </svg>
                                                )}
                                            </button>
                                            {img.caption && (
                                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
                                                    <span className="font-sans text-[9px] text-white/70 line-clamp-1">{img.caption}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Add photo button */}
                                    {galleryImages.length < 10 && (
                                        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition hover:border-solid" style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.02)" }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round">
                                                <line x1="12" y1="5" x2="12" y2="19" />
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            <span className="font-sans text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                                                {uploadingGallery ? "..." : "Add"}
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingGallery}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    setUploadingGallery(true);
                                                    setPhotoMsg("");
                                                    const fd = new FormData();
                                                    fd.append("file", file);
                                                    const result = await uploadGalleryImage(venue.id, fd);
                                                    if (result.error) { setPhotoMsg(result.error); }
                                                    else if (result.url) {
                                                        setGalleryImages((prev) => [...prev, { id: Date.now().toString(), image_url: result.url!, caption: null, sort_order: prev.length }]);
                                                        setPhotoMsg("Photo added!"); setTimeout(() => setPhotoMsg(""), 2000);
                                                    }
                                                    setUploadingGallery(false);
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </Field>

                            {photoMsg && (
                                <p className="font-sans text-[13px] font-medium" style={{ color: photoMsg.includes("!") ? "#4ADE80" : "#EF4444" }}>{photoMsg}</p>
                            )}
                        </Card>

                        {/* ─── Hours ─────────────────────────────────────── */}
                        <Card id="hours" title="Operating Hours" desc="Set your hours for each day of the week.">
                            <div className="flex flex-col gap-2">
                                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => {
                                    const existing = page?.hours?.find((h) => h.day === day);
                                    const dayKey = `hours_${day}`;
                                    return (
                                        <div key={day} className="flex items-center gap-2 rounded-lg p-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                                            <span className="w-16 shrink-0 font-sans text-[12px] font-medium text-white/60">{day.slice(0, 3)}</span>
                                            <input
                                                id={`${dayKey}_open`}
                                                type="time"
                                                defaultValue={existing?.open || ""}
                                                className="rounded-md px-2 py-1 font-mono text-[12px] text-white/80 outline-none"
                                                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                                            />
                                            <span className="font-sans text-[11px] text-white/30">to</span>
                                            <input
                                                id={`${dayKey}_close`}
                                                type="time"
                                                defaultValue={existing?.close || ""}
                                                className="rounded-md px-2 py-1 font-mono text-[12px] text-white/80 outline-none"
                                                style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="mt-2 font-sans text-[10px] text-white/20">Leave blank for closed days. Hours are saved when you hit Save at the top.</p>
                            <Field label="Quick text override" hint="Or type it manually — overrides the grid above">
                                <textarea value={hours} onChange={(e) => setHours(e.target.value)} rows={2} placeholder={"Mon-Fri: 4pm–12am\nSat-Sun: 2pm–2am"} className="input resize-none" />
                            </Field>
                        </Card>

                        {/* ─── Menu Text ─────────────────────────────────────── */}
                        <Card id="menu_text" title="Menu Overview" desc="Quick summary of what you serve — the AI uses this to answer questions.">
                            <Field label="What do you serve?" hint="Group by category, one line each. The AI reads this.">
                                <textarea value={menuText} onChange={(e) => setMenuText(e.target.value)} rows={6} placeholder={"Drinks: espresso, matcha, cold brew, chai\nFood: avocado toast, grain bowl, pastries\nSpecials: seasonal latte, soup of the day"} className="input resize-none" />
                            </Field>
                        </Card>

                        {/* ─── Rules & Vibe ─────────────────────────────────────── */}
                        <Card id="rules" title="Vibe & Rules" desc="What's the energy like right now? Any rules guests should know?">
                            <Field label="How's the vibe right now?" hint="You can change this anytime">
                                <div className="flex gap-2">
                                    {VIBES.map((v) => (
                                        <Chip key={v} label={v} active={vibe === v} onClick={() => setVibe(v)} />
                                    ))}
                                </div>
                            </Field>
                            <Field label="Any rules guests should know?" hint="One per line">
                                <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={4} placeholder={"Quiet after 10 PM\nMembers get priority\n21+ only"} className="input resize-none" />
                            </Field>
                        </Card>

                        {/* ─── Staff ───────────────────────────────────────────── */}
                        <Card id="staff" title="Your Team" desc="Add your people. Guests can see who's working when they visit your page.">
                            {/* Existing staff */}
                            {staffList.length === 0 && !showAddStaff && (
                                <p className="font-sans text-[13px] text-white/20">No staff added yet.</p>
                            )}

                            <div className="flex flex-col gap-3">
                                {staffList.map((member) => (
                                    <div key={member.id}>
                                    <div
                                        className="group flex items-center gap-3 rounded-xl p-3"
                                        style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                            {member.avatar_url ? (
                                                <img src={member.avatar_url} alt={member.display_name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="font-sans text-[16px] font-bold" style={{ color: page?.theme_color || "#F97316" }}>
                                                    {member.display_name.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                            {/* Avatar upload overlay */}
                                            <label className="absolute inset-0 flex cursor-pointer items-center justify-center opacity-0 transition group-hover:opacity-100" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                    <circle cx="12" cy="13" r="4" />
                                                </svg>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const fd = new FormData();
                                                        fd.append("file", file);
                                                        const result = await uploadStaffAvatar(venue.id, member.id, fd);
                                                        if (result.url) {
                                                            setStaffList((prev) => prev.map((s) => s.id === member.id ? { ...s, avatar_url: result.url! } : s));
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        {/* Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-sans text-[13px] font-medium text-white/80">{member.display_name}</p>
                                                {(member as Record<string, unknown>).invite_status === "pending" ? (
                                                    <span className="rounded-full px-1.5 py-0.5 font-sans text-[8px] font-bold tracking-wider" style={{ backgroundColor: "rgba(250,204,21,0.15)", color: "#FACC15" }}>PENDING</span>
                                                ) : (member as Record<string, unknown>).invite_status === "accepted" ? (
                                                    <span className="rounded-full px-1.5 py-0.5 font-sans text-[8px] font-bold tracking-wider" style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ADE80" }}>LINKED</span>
                                                ) : null}
                                            </div>
                                            {(() => { const e = (member as Record<string, unknown>).email; return e ? <p className="font-sans text-[10px] text-white/20">{String(e)}</p> : null; })()}
                                            {member.role_title && <p className="font-sans text-[11px] text-white/30">{member.role_title}</p>}
                                            {member.specialties && member.specialties.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {member.specialties.map((tag) => (
                                                        <span key={tag} className="rounded-full px-2 py-0.5 font-sans text-[9px]" style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}>{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                                            {/* Edit */}
                                            <button
                                                onClick={() => {
                                                    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                                                    const existingSchedule = (member.schedule || []) as { day: string; start: string; end: string }[];
                                                    setEditingStaffId(member.id);
                                                    setEditStaffName(member.display_name);
                                                    setEditStaffTitle(member.role_title || "");
                                                    setEditStaffBio(member.bio || "");
                                                    setEditStaffSpecialties((member.specialties || []).join(", "));
                                                    setEditStaffSchedule(DAYS.map((day) => {
                                                        const existing = existingSchedule.find((s) => s.day === day);
                                                        return { day, working: !!existing, start: existing?.start || "9:00", end: existing?.end || "17:00" };
                                                    }));
                                                }}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg"
                                                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                                title="Edit"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </button>

                                            {/* Visibility toggle */}
                                            <button
                                                onClick={async () => {
                                                    const newVisible = !member.visible;
                                                    await toggleStaffVisibility(venue.id, member.id, newVisible);
                                                    setStaffList((prev) => prev.map((s) => s.id === member.id ? { ...s, visible: newVisible } : s));
                                                }}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg"
                                                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                                title={member.visible ? "Hide from page" : "Show on page"}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={member.visible ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)"} strokeWidth="2" strokeLinecap="round">
                                                    {member.visible ? (
                                                        <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                                                    ) : (
                                                        <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                                                    )}
                                                </svg>
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={async () => {
                                                    const result = await deleteStaffMember(venue.id, member.id);
                                                    if (!result.error) {
                                                        setStaffList((prev) => prev.filter((s) => s.id !== member.id));
                                                    }
                                                }}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg"
                                                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round">
                                                    <path d="M18 6 6 18M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Staff Edit Form (inline) */}
                                    {editingStaffId === member.id && (
                                        <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                            <div className="flex flex-col gap-3">
                                                <input value={editStaffName} onChange={(e) => setEditStaffName(e.target.value)} placeholder="Display name" className="input" />
                                                <input value={editStaffTitle} onChange={(e) => setEditStaffTitle(e.target.value)} placeholder="Role title" className="input" />
                                                <textarea value={editStaffBio} onChange={(e) => setEditStaffBio(e.target.value)} placeholder="Bio" rows={2} className="input" style={{ resize: "none" }} />
                                                <input value={editStaffSpecialties} onChange={(e) => setEditStaffSpecialties(e.target.value)} placeholder="Specialties (comma-separated)" className="input" />

                                                {/* Schedule grid */}
                                                <div>
                                                    <label className="font-sans text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Schedule</label>
                                                    <div className="mt-2 flex flex-col gap-1.5">
                                                        {editStaffSchedule.map((slot, idx) => (
                                                            <div key={slot.day} className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setEditStaffSchedule((prev) => prev.map((s, i) => i === idx ? { ...s, working: !s.working } : s))}
                                                                    className="flex h-7 w-12 shrink-0 items-center justify-center rounded-lg font-sans text-[11px] font-bold"
                                                                    style={{
                                                                        backgroundColor: slot.working ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
                                                                        color: slot.working ? "#4ADE80" : "rgba(255,255,255,0.2)",
                                                                        border: `1px solid ${slot.working ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"}`,
                                                                    }}
                                                                >
                                                                    {slot.day}
                                                                </button>
                                                                {slot.working ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <input
                                                                            type="time"
                                                                            value={slot.start}
                                                                            onChange={(e) => setEditStaffSchedule((prev) => prev.map((s, i) => i === idx ? { ...s, start: e.target.value } : s))}
                                                                            className="input"
                                                                            style={{ width: "auto", padding: "4px 8px", fontSize: "12px" }}
                                                                        />
                                                                        <span className="font-sans text-[11px] text-white/20">to</span>
                                                                        <input
                                                                            type="time"
                                                                            value={slot.end}
                                                                            onChange={(e) => setEditStaffSchedule((prev) => prev.map((s, i) => i === idx ? { ...s, end: e.target.value } : s))}
                                                                            className="input"
                                                                            style={{ width: "auto", padding: "4px 8px", fontSize: "12px" }}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="font-sans text-[11px] text-white/15">Off</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 mt-1">
                                                    <button
                                                        onClick={async () => {
                                                            setSavingStaff(true);
                                                            const schedule = editStaffSchedule
                                                                .filter((s) => s.working)
                                                                .map((s) => ({ day: s.day, start: s.start, end: s.end }));
                                                            const specialties = editStaffSpecialties.split(",").map((s) => s.trim()).filter(Boolean);
                                                            const result = await updateStaffMember(venue.id, member.id, {
                                                                display_name: editStaffName.trim(),
                                                                role_title: editStaffTitle.trim() || undefined,
                                                                bio: editStaffBio.trim() || undefined,
                                                                specialties,
                                                                schedule,
                                                            });
                                                            if (!result.error) {
                                                                setStaffList((prev) => prev.map((s) => s.id === member.id ? {
                                                                    ...s,
                                                                    display_name: editStaffName.trim(),
                                                                    role_title: editStaffTitle.trim() || null,
                                                                    bio: editStaffBio.trim() || null,
                                                                    specialties,
                                                                    schedule,
                                                                } : s));
                                                                setEditingStaffId(null);
                                                                setStaffMsg("Saved!"); setTimeout(() => setStaffMsg(""), 2000);
                                                            } else {
                                                                setStaffMsg(result.error);
                                                            }
                                                            setSavingStaff(false);
                                                        }}
                                                        disabled={savingStaff}
                                                        className="rounded-lg px-4 py-2 font-sans text-[12px] font-semibold text-white"
                                                        style={{ backgroundColor: page?.theme_color || "#F97316" }}
                                                    >
                                                        {savingStaff ? "Saving..." : "Save"}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingStaffId(null)}
                                                        className="rounded-lg px-4 py-2 font-sans text-[12px] text-white/40"
                                                        style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                ))}
                            </div>

                            {/* Add staff form */}
                            {showAddStaff ? (
                                <div className="flex flex-col gap-3 rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                    <input value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="Email *" type="email" className="input" />
                                    <input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="Display name (optional — auto-syncs from their profile)" className="input" />
                                    <input value={newStaffTitle} onChange={(e) => setNewStaffTitle(e.target.value)} placeholder="Role title (e.g. Lead Barista)" className="input" />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (!newStaffEmail.trim() || !newStaffEmail.includes("@")) return;
                                                setAddingStaff(true);
                                                const result = await addStaffMember(venue.id, {
                                                    email: newStaffEmail.trim(),
                                                    display_name: newStaffName.trim() || undefined,
                                                    role_title: newStaffTitle.trim() || undefined,
                                                });
                                                if (result.staff) {
                                                    setStaffList((prev) => [...prev, result.staff!]);
                                                    setNewStaffEmail(""); setNewStaffName(""); setNewStaffTitle(""); setNewStaffBio(""); setNewStaffSpecialties("");
                                                    setShowAddStaff(false);
                                                    setStaffMsg("Staff added!"); setTimeout(() => setStaffMsg(""), 2000);
                                                } else if (result.error) {
                                                    setStaffMsg(result.error);
                                                }
                                                setAddingStaff(false);
                                            }}
                                            disabled={addingStaff || !newStaffEmail.trim() || !newStaffEmail.includes("@")}
                                            className="rounded-lg px-4 py-2 font-sans text-[12px] font-semibold text-white"
                                            style={{ backgroundColor: page?.theme_color || "#F97316" }}
                                        >
                                            {addingStaff ? "Adding..." : "Add"}
                                        </button>
                                        <button
                                            onClick={() => { setShowAddStaff(false); setNewStaffEmail(""); setNewStaffName(""); setNewStaffTitle(""); setNewStaffBio(""); setNewStaffSpecialties(""); }}
                                            className="rounded-lg px-4 py-2 font-sans text-[12px] text-white/40"
                                            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowAddStaff(true)}
                                    className="flex items-center gap-2 rounded-xl px-4 py-3 font-sans text-[12px] font-medium transition"
                                    style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    Add team member
                                </button>
                            )}

                            {staffMsg && (
                                <p className="font-sans text-[13px] font-medium" style={{ color: staffMsg.includes("!") ? "#4ADE80" : "#EF4444" }}>{staffMsg}</p>
                            )}
                        </Card>

                        {/* ─── Offerings ───────────────────────────────────────── */}
                        <Card id="offerings" title="What You Sell" desc="Memberships, reservations, products, events — anything guests can buy or book. Pick a template to get started fast.">
                            {/* Existing offerings */}
                            {offerings.length === 0 && !showAddOffering && !showTemplatePicker && (
                                <div className="rounded-xl py-8 text-center" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                                    <p className="font-sans text-[14px] text-white/40">No offerings configured yet.</p>
                                    <p className="mt-1 font-sans text-[12px] text-white/20">Start with a template or create your own.</p>
                                </div>
                            )}

                            {/* Template Picker */}
                            {showTemplatePicker && (
                                <div className="rounded-xl border p-4" style={{ borderColor: "rgba(167,139,250,0.2)", backgroundColor: "rgba(167,139,250,0.04)" }}>
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="font-sans text-[13px] font-semibold text-white/60">Choose a template for your venue type</p>
                                        <button onClick={() => setShowTemplatePicker(false)} className="font-sans text-[12px] text-white/30">Cancel</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {VENUE_TEMPLATES.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleApplyTemplate(t)}
                                                disabled={applyingTemplate}
                                                className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                                style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                                            >
                                                <span className="text-[24px]">{t.icon}</span>
                                                <span className="font-sans text-[12px] font-semibold text-white/70">{t.label}</span>
                                                <span className="font-sans text-[9px] text-white/25">{t.offerings.length} offerings</span>
                                            </button>
                                        ))}
                                    </div>
                                    {applyingTemplate && (
                                        <p className="mt-3 text-center font-sans text-[12px] text-[#a78bfa]">Adding offerings...</p>
                                    )}
                                </div>
                            )}
                            {offerings.map((o) => {
                                const typeInfo = OFFERING_TYPES.find((t) => t.id === o.type);
                                return (
                                    <div key={o.id} className="group flex items-start gap-4 rounded-xl border p-4" style={{ borderColor: o.active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)", backgroundColor: "rgba(255,255,255,0.02)", opacity: o.active ? 1 : 0.5 }}>
                                        {/* Image or icon */}
                                        <label className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl" style={{ backgroundColor: "rgba(249,115,22,0.15)" }}>
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
                                                await uploadOfferingImage(o.id, fd);
                                            }} />
                                        </label>
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

                                            {/* Staff assigned to this offering */}
                                            {staffList.length > 0 && ["service", "reservation", "event", "custom"].includes(o.type) && (
                                                <div className="mt-2">
                                                    <button
                                                        onClick={() => setExpandedOfferingStaff(expandedOfferingStaff === o.id ? null : o.id)}
                                                        className="flex items-center gap-1.5 font-sans text-[11px] transition"
                                                        style={{ color: "rgba(255,255,255,0.3)" }}
                                                    >
                                                        {(() => {
                                                            const linked = soLinks.filter((l) => l.offering_id === o.id);
                                                            if (linked.length === 0) return "+ Assign staff";
                                                            const names = linked.map((l) => staffList.find((s) => s.id === l.staff_id)?.display_name).filter(Boolean);
                                                            return `👤 ${names.join(", ")}`;
                                                        })()}
                                                    </button>
                                                    {expandedOfferingStaff === o.id && (
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {staffList.map((s) => {
                                                                const isLinked = soLinks.some((l) => l.staff_id === s.id && l.offering_id === o.id);
                                                                return (
                                                                    <button
                                                                        key={s.id}
                                                                        onClick={async () => {
                                                                            if (isLinked) {
                                                                                await unlinkStaffFromOffering(venue.id, s.id, o.id);
                                                                                setSoLinks((prev) => prev.filter((l) => !(l.staff_id === s.id && l.offering_id === o.id)));
                                                                            } else {
                                                                                await linkStaffToOffering(venue.id, s.id, o.id);
                                                                                setSoLinks((prev) => [...prev, { staff_id: s.id, offering_id: o.id }]);
                                                                            }
                                                                        }}
                                                                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-[10px] font-medium transition"
                                                                        style={{
                                                                            backgroundColor: isLinked ? `${page?.theme_color || "#F97316"}20` : "rgba(255,255,255,0.04)",
                                                                            color: isLinked ? (page?.theme_color || "#F97316") : "rgba(255,255,255,0.3)",
                                                                            border: `1px solid ${isLinked ? `${page?.theme_color || "#F97316"}40` : "rgba(255,255,255,0.08)"}`,
                                                                        }}
                                                                    >
                                                                        {s.avatar_url ? (
                                                                            <img src={s.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                                                                        ) : (
                                                                            <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>{s.display_name.charAt(0)}</span>
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
                                        <Field label="How long does it take?" hint="In minutes — skip if not applicable">
                                            <input type="number" value={offeringDuration} onChange={(e) => setOfferingDuration(e.target.value)} placeholder="60" className="input" />
                                        </Field>
                                        <Field label="How many can you book at the same time?" hint="e.g. 1 for a barber chair, 10 for a group class">
                                            <input type="number" min="1" value={offeringCapacity} onChange={(e) => setOfferingCapacity(e.target.value)} placeholder="1" className="input" style={{ maxWidth: 120 }} />
                                        </Field>
                                        {(offeringType === "service" || offeringType === "reservation" || offeringType === "event") && (
                                            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)" }}>
                                                <p className="font-sans text-[11px] font-semibold" style={{ color: "#8B5CF6" }}>Availability</p>
                                                <p className="mt-1 font-sans text-[10px] text-white/40 leading-relaxed">
                                                    {offeringType === "service"
                                                        ? "Time slots come from staff schedules. Link staff members to this offering after creating it, and set their working hours in the Staff section."
                                                        : offeringType === "event"
                                                        ? "Set the event date, time, and location below. Guests will see this on the map and can RSVP or buy tickets."
                                                        : "Time slots come from your venue hours. Set your operating hours in the Hours section — guests will see available slots within those times."
                                                    }
                                                </p>
                                                {offeringType === "reservation" && (
                                                    <p className="mt-1 font-sans text-[10px] text-white/25">
                                                        Capacity controls how many of these can be booked in the same time slot.
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {/* Event-specific fields */}
                                        {offeringType === "event" && (
                                            <>
                                                <Field label="Event start" hint="Date and time">
                                                    <input type="datetime-local" value={offeringStartsAt} onChange={(e) => setOfferingStartsAt(e.target.value)} className="input" />
                                                </Field>
                                                <Field label="Event end" hint="Optional">
                                                    <input type="datetime-local" value={offeringEndsAt} onChange={(e) => setOfferingEndsAt(e.target.value)} className="input" />
                                                </Field>
                                                <Field label="Location name" hint="e.g. Central Park, Studio B">
                                                    <input value={offeringLocationName} onChange={(e) => setOfferingLocationName(e.target.value)} placeholder="Where is the event?" className="input" />
                                                </Field>
                                                <Field label="Location address" hint="Full address — shows on the map">
                                                    <input value={offeringLocationAddress} onChange={(e) => setOfferingLocationAddress(e.target.value)} placeholder="123 Main St, Austin TX" className="input" />
                                                </Field>
                                                <Field label="Max attendees" hint="Leave empty for unlimited">
                                                    <input type="number" min="1" value={offeringMaxAttendees} onChange={(e) => setOfferingMaxAttendees(e.target.value)} placeholder="100" className="input" style={{ maxWidth: 120 }} />
                                                </Field>
                                            </>
                                        )}
                                        <Field label="What's included?" hint="One perk per line">
                                            <textarea value={offeringPerks} onChange={(e) => setOfferingPerks(e.target.value)} rows={3} placeholder={"Priority seating\n10% off drinks\nExclusive events"} className="input resize-none" />
                                        </Field>
                                        <Field label="Optional add-ons" hint="Name - Price, one per line">
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
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowTemplatePicker(true)}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed py-3 font-sans text-[13px] font-medium transition hover:border-solid"
                                        style={{ borderColor: "rgba(167,139,250,0.2)", color: "rgba(167,139,250,0.6)" }}
                                    >
                                        📋 Use Template
                                    </button>
                                    <button
                                        onClick={() => { setShowAddOffering(true); loadOfferingTemplate("membership"); }}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed py-3 font-sans text-[13px] font-medium transition hover:border-solid"
                                        style={{ borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }}
                                    >
                                        + Add Custom
                                    </button>
                                </div>
                            )}

                            {offerings.length > 0 && (
                                <button
                                    onClick={() => setActiveSection("payments")}
                                    className="w-full rounded-lg px-3 py-2 text-left transition hover:opacity-80"
                                    style={{ backgroundColor: "rgba(99,91,255,0.06)" }}
                                >
                                    <span className="font-sans text-[11px]" style={{ color: "rgba(99,91,255,0.6)" }}>
                                        💳 Set up Stripe in the Payments section to start accepting payments.
                                    </span>
                                </button>
                            )}
                        </Card>

                        {/* ─── XP Roadmap ───────────────────────────────────────── */}
                        <Card id="xp" title="Loyalty Rewards" desc="Guests earn points when they visit, order, or do stuff at your spot. Set up what earns points and what they unlock.">
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
                                    <h3 className="font-sans text-[13px] font-semibold text-white/60">How guests earn points</h3>
                                    <span className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                                        {xpActions.length} active
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
                                <p className="mt-3 mb-2 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">TAP TO ADD</p>
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
                                    <h3 className="font-sans text-[13px] font-semibold text-white/60">Levels guests unlock</h3>
                                    <span className="rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold" style={{ backgroundColor: "rgba(167,139,250,0.12)", color: "#a78bfa" }}>
                                        {xpMilestones.length} levels
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
                                    <p className="mb-3 font-sans text-[10px] font-semibold tracking-[1.5px] text-white/20">ADD A LEVEL</p>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input id="ms-name" placeholder="Level name (e.g. Regular, VIP)" className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                            <input id="ms-threshold" type="number" placeholder="Points needed" className="w-28 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                        </div>
                                        <input id="ms-reward" placeholder="What do they get? (e.g. Free coffee every visit)" className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
                                        <input id="ms-perks" placeholder="Extra perks, separated by commas (e.g. Priority seating, 10% off)" className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none" />
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
                                            {saving ? "Saving..." : "Add Level"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        {/* ─── QR Codes ──────────────────────────────────────────── */}
                        <Card id="qr" title="QR Codes" desc="Print these and put them around your venue. Guests scan to check in and start earning points.">
                            {/* Venue-wide QR */}
                            <div className="mb-6">
                                <h3 className="mb-3 font-sans text-[13px] font-semibold text-white/60">Main Check-In QR</h3>
                                <div className="flex flex-col items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                                    <div id="qr-venue" className="rounded-xl bg-white p-3" />
                                    <p className="font-sans text-[12px] text-white/30 text-center">
                                        join.thekickback.net/checkin/{venue.id}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                import("qrcode").then((QRCode) => {
                                                    const el = document.getElementById("qr-venue");
                                                    if (!el) return;
                                                    el.innerHTML = "";
                                                    QRCode.toCanvas(
                                                        `https://join.thekickback.net/checkin/${venue.id}`,
                                                        { width: 200, margin: 1, color: { dark: "#000", light: "#fff" } },
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        (err: any, canvas: any) => {
                                                            if (!err && canvas) el.appendChild(canvas);
                                                        }
                                                    );
                                                });
                                            }}
                                            className="rounded-lg px-4 py-2 font-sans text-[12px] font-semibold text-black active:scale-95"
                                            style={{ backgroundColor: "#F97316" }}
                                        >
                                            Generate QR
                                        </button>
                                        <button
                                            onClick={() => {
                                                const canvas = document.querySelector("#qr-venue canvas") as HTMLCanvasElement;
                                                if (!canvas) return;
                                                const link = document.createElement("a");
                                                link.download = `${venue.name.replace(/\s+/g, "-").toLowerCase()}-checkin-qr.png`;
                                                link.href = canvas.toDataURL();
                                                link.click();
                                            }}
                                            className="rounded-lg border border-white/[0.08] px-4 py-2 font-sans text-[12px] font-medium text-white/40 active:scale-95"
                                        >
                                            Download
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Table-specific QR codes */}
                            <div>
                                <h3 className="mb-3 font-sans text-[13px] font-semibold text-white/60">One QR per table</h3>
                                <div className="flex gap-2 mb-4">
                                    <input
                                        id="qr-table-count"
                                        type="number"
                                        min="1"
                                        max="50"
                                        defaultValue="10"
                                        placeholder="Number of tables"
                                        className="w-32 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 font-sans text-[13px] text-white placeholder:text-white/20 focus:outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            import("qrcode").then((QRCode) => {
                                                const count = parseInt((document.getElementById("qr-table-count") as HTMLInputElement).value) || 10;
                                                const grid = document.getElementById("qr-table-grid");
                                                if (!grid) return;
                                                grid.innerHTML = "";
                                                for (let i = 1; i <= Math.min(count, 50); i++) {
                                                    const wrapper = document.createElement("div");
                                                    wrapper.className = "flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3";
                                                    wrapper.innerHTML = `<div class="rounded-lg bg-white p-2" id="qr-t-${i}"></div><span class="font-sans text-[11px] font-semibold text-white/40">Table ${i}</span>`;
                                                    grid.appendChild(wrapper);

                                                    setTimeout(() => {
                                                        const el = document.getElementById(`qr-t-${i}`);
                                                        if (!el) return;
                                                        QRCode.toCanvas(
                                                            `https://join.thekickback.net/checkin/${venue.id}?table=${i}`,
                                                            { width: 120, margin: 1, color: { dark: "#000", light: "#fff" } },
                                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                            (err: any, canvas: any) => {
                                                                if (!err && canvas) el.appendChild(canvas);
                                                            }
                                                        );
                                                    }, i * 50);
                                                }
                                            });
                                        }}
                                        className="rounded-lg px-4 py-2 font-sans text-[12px] font-semibold text-black active:scale-95"
                                        style={{ backgroundColor: "#F97316" }}
                                    >
                                        Generate All
                                    </button>
                                    <button
                                        onClick={() => {
                                            const grid = document.getElementById("qr-table-grid");
                                            if (!grid) return;
                                            const w = window.open("", "_blank");
                                            if (!w) return;
                                            const canvases = grid.querySelectorAll("canvas");
                                            let html = `<html><head><title>${venue.name} — Table QR Codes</title><style>
                                                body { font-family: system-ui, sans-serif; background: #fff; padding: 20px; }
                                                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
                                                .card { text-align: center; page-break-inside: avoid; padding: 16px; border: 1px solid #eee; border-radius: 12px; }
                                                .card img { width: 150px; height: 150px; }
                                                .card p { margin: 8px 0 0; font-size: 14px; font-weight: 600; }
                                                .card small { color: #999; font-size: 10px; }
                                                @media print { .grid { gap: 16px; } }
                                            </style></head><body><h2>${venue.name} — Table QR Codes</h2><div class="grid">`;
                                            canvases.forEach((canvas, i) => {
                                                html += `<div class="card"><img src="${canvas.toDataURL()}" /><p>Table ${i + 1}</p><small>Scan to check in</small></div>`;
                                            });
                                            html += `</div></body></html>`;
                                            w.document.write(html);
                                            w.document.close();
                                            setTimeout(() => w.print(), 500);
                                        }}
                                        className="rounded-lg border border-white/[0.08] px-4 py-2 font-sans text-[12px] font-medium text-white/40 active:scale-95"
                                    >
                                        Print All
                                    </button>
                                </div>
                                <div id="qr-table-grid" className="grid grid-cols-3 gap-3 sm:grid-cols-4" />
                            </div>
                        </Card>

                        {/* ─── AI Agent ─────────────────────────────────────────── */}
                        <Card id="agent" title="AI Chat" desc={`Teach your AI about ${venue.name}. Just write like you're explaining to a friend — the AI uses this to answer guest questions.`}>
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
                                        Just write like you're texting a friend. The AI will use this to answer guest questions.
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

                            {/* ── Chat Limits ── */}
                            <div className="mt-2 border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="font-sans text-[14px] font-semibold text-white">Chat Limits</h3>
                                        <p className="font-sans text-[12px] text-white/35">Control how many free AI messages guests get before they need to sign up.</p>
                                    </div>
                                    <button
                                        onClick={() => setAiLimitEnabled(!aiLimitEnabled)}
                                        className="relative h-6 w-11 rounded-full transition"
                                        style={{ backgroundColor: aiLimitEnabled ? "#F97316" : "rgba(255,255,255,0.1)" }}
                                    >
                                        <div
                                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                                            style={{ left: aiLimitEnabled ? 22 : 2 }}
                                        />
                                    </button>
                                </div>

                                {aiLimitEnabled && (
                                    <div className="flex flex-col gap-4 rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        <Field label="Free messages per day" hint="After this many, guests see your gate message">
                                            <input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={aiFreeMessages}
                                                onChange={(e) => setAiFreeMessages(e.target.value)}
                                                className="input"
                                                style={{ maxWidth: 120 }}
                                            />
                                        </Field>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-sans text-[12px] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Members get unlimited</p>
                                                <p className="font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>Guests with a membership skip the limit</p>
                                            </div>
                                            <button
                                                onClick={() => setAiRequireMembership(!aiRequireMembership)}
                                                className="relative h-6 w-11 shrink-0 rounded-full transition"
                                                style={{ backgroundColor: aiRequireMembership ? "#4ADE80" : "rgba(255,255,255,0.1)" }}
                                            >
                                                <div
                                                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                                                    style={{ left: aiRequireMembership ? 22 : 2 }}
                                                />
                                            </button>
                                        </div>

                                        <Field label="What guests see when they hit the limit" hint="Make it friendly — offer a reason to sign up">
                                            <textarea
                                                value={aiGateMessage}
                                                onChange={(e) => setAiGateMessage(e.target.value)}
                                                rows={2}
                                                className="input resize-none"
                                                placeholder="You've used your free messages for today. Sign up to keep chatting!"
                                            />
                                        </Field>

                                        <div className="flex items-center justify-between">
                                            <button
                                                onClick={async () => {
                                                    const stats = await getAiUsageStats();
                                                    if (!("error" in stats)) setAiUsageStats(stats);
                                                }}
                                                className="font-sans text-[11px] font-medium underline"
                                                style={{ color: "rgba(255,255,255,0.3)" }}
                                            >
                                                View today&apos;s usage
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setSavingAiLimits(true);
                                                    setAiLimitsMsg("");
                                                    const result = await updateAiLimits({
                                                        free_messages_per_day: parseInt(aiFreeMessages) || 10,
                                                        require_membership: aiRequireMembership,
                                                        gate_message: aiGateMessage,
                                                    });
                                                    if (result.error) setAiLimitsMsg(result.error);
                                                    else { setAiLimitsMsg("Saved!"); setTimeout(() => setAiLimitsMsg(""), 2000); }
                                                    setSavingAiLimits(false);
                                                }}
                                                disabled={savingAiLimits}
                                                className="rounded-lg px-4 py-2 font-sans text-[12px] font-semibold text-black active:scale-95 disabled:opacity-40"
                                                style={{ backgroundColor: "#F97316" }}
                                            >
                                                {savingAiLimits ? "Saving..." : "Save Limits"}
                                            </button>
                                        </div>

                                        {aiLimitsMsg && (
                                            <p className="font-sans text-[12px] font-medium" style={{ color: aiLimitsMsg === "Saved!" ? "#4ADE80" : "#EF4444" }}>{aiLimitsMsg}</p>
                                        )}

                                        {aiUsageStats && (
                                            <div className="flex gap-3">
                                                <div className="flex-1 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                                                    <p className="font-mono text-[18px] font-bold" style={{ color: "#F97316" }}>{aiUsageStats.todayMessages}</p>
                                                    <p className="font-sans text-[10px] text-white/30">messages today</p>
                                                </div>
                                                <div className="flex-1 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)" }}>
                                                    <p className="font-mono text-[18px] font-bold" style={{ color: "#4ADE80" }}>{aiUsageStats.todayGuests}</p>
                                                    <p className="font-sans text-[10px] text-white/30">guests today</p>
                                                </div>
                                                <div className="flex-1 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                                                    <p className="font-mono text-[18px] font-bold" style={{ color: "#a78bfa" }}>{aiUsageStats.weekMessages}</p>
                                                    <p className="font-sans text-[10px] text-white/30">this week</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* ─── Payments ─────────────────────────────────────────── */}
                        <Card id="payments" title="Payments" desc="Connect Stripe to accept payments from guests and receive payouts.">
                            {/* Platform plan */}
                            <div className="mb-5">
                                <p className="mb-2 font-sans text-[11px] font-semibold tracking-[1.5px]" style={{ color: "rgba(255,255,255,0.25)" }}>YOUR PLAN</p>
                                <div className="flex flex-col gap-2">
                                    {([
                                        { id: "free", label: "Free", fee: "15%", desc: "No monthly cost. 15% platform fee on all transactions.", price: "$0/mo", color: "#94a3b8" },
                                        { id: "pro", label: "Pro", fee: "10%", desc: "Lower fees, priority support. 10% platform fee.", price: "$29/mo", color: "#F97316" },
                                        { id: "business", label: "Business", fee: "5%", desc: "Lowest fees, dedicated support. 5% platform fee.", price: "$79/mo", color: "#A78BFA" },
                                    ] as const).map((p) => {
                                        const current = (venue as Record<string, unknown>).plan as string || "free";
                                        const isActive = current === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                onClick={async () => {
                                                    if (isActive) return;
                                                    const feeMap: Record<string, number> = { free: 0.15, pro: 0.10, business: 0.05 };
                                                    setSaving(true);
                                                    await updateVenue(venue.id, { plan: p.id, platform_fee_rate: feeMap[p.id] } as Record<string, unknown>);
                                                    setSaving(false);
                                                    setMsg(`Switched to ${p.label} plan`);
                                                    setTimeout(() => setMsg(""), 2000);
                                                }}
                                                className="flex items-center gap-3 rounded-xl p-3 text-left transition"
                                                style={{
                                                    backgroundColor: isActive ? `${p.color}10` : "rgba(255,255,255,0.02)",
                                                    border: `1px solid ${isActive ? `${p.color}30` : "rgba(255,255,255,0.06)"}`,
                                                }}
                                            >
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${p.color}15` }}>
                                                    <span className="font-sans text-[14px] font-bold" style={{ color: p.color }}>{p.fee}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-sans text-[13px] font-semibold" style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.6)" }}>{p.label}</span>
                                                        <span className="font-mono text-[11px]" style={{ color: p.color }}>{p.price}</span>
                                                        {isActive && <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold" style={{ backgroundColor: `${p.color}20`, color: p.color }}>CURRENT</span>}
                                                    </div>
                                                    <p className="mt-0.5 font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{p.desc}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-2 font-sans text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                                    The platform fee is deducted from each transaction. The rest goes directly to your Stripe account.
                                </p>
                            </div>
                            <StripeConnect />
                        </Card>

                        {/* ─── Members ──────────────────────────────────────────── */}
                        <Card id="members" title="Members" desc={`${memberCount} people have joined ${venue.name}. They show up here when they sign up.`}>
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

                        {/* ─── Digital Assets ──────────────────────────────── */}
                        <Card id="digital_assets" title="Digital Assets" desc="Create stickers, badges, and 3D pins your guests can earn or buy to decorate the map.">
                            {/* Stats */}
                            <div className="flex gap-4">
                                <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                                    <p className="font-sans text-[20px] font-bold" style={{ color: "#F97316" }}>{digitalAssets.length}</p>
                                    <p className="font-sans text-[10px] tracking-[1px]" style={{ color: "rgba(255,255,255,0.35)" }}>TOTAL</p>
                                </div>
                                <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
                                    <p className="font-sans text-[20px] font-bold" style={{ color: "#4ADE80" }}>{digitalAssets.filter(a => a.active).length}</p>
                                    <p className="font-sans text-[10px] tracking-[1px]" style={{ color: "rgba(255,255,255,0.35)" }}>ACTIVE</p>
                                </div>
                                <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: "rgba(168,139,250,0.08)", border: "1px solid rgba(168,139,250,0.2)" }}>
                                    <p className="font-sans text-[20px] font-bold" style={{ color: "#A78BFA" }}>{digitalAssets.filter(a => a.asset_type === "3d_pin").length}</p>
                                    <p className="font-sans text-[10px] tracking-[1px]" style={{ color: "rgba(255,255,255,0.35)" }}>3D PINS</p>
                                </div>
                            </div>

                            {assetMsg && <p className="font-sans text-[12px] font-medium" style={{ color: assetMsg === "Added!" ? "#4ADE80" : "#EF4444" }}>{assetMsg}</p>}

                            {/* Asset List */}
                            {digitalAssets.length === 0 && !showAddAsset ? (
                                <div className="rounded-xl border border-dashed p-6 text-center" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                                    <p className="font-sans text-[14px] font-medium text-white/60">No digital assets yet</p>
                                    <p className="mt-1 font-sans text-[12px] text-white/25">Create stickers and badges for your guests to earn or buy.</p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                                    <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
                                        <span className="flex-1 font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>ASSET</span>
                                        <span className="w-16 text-center font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>TYPE</span>
                                        <span className="w-14 text-center font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>XP</span>
                                        <span className="w-14 text-center font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>PRICE</span>
                                        <span className="w-20 text-center font-sans text-[10px] font-medium tracking-[2px]" style={{ color: "rgba(255,255,255,0.3)" }}>ACTIONS</span>
                                    </div>
                                    {digitalAssets.map((asset) => (
                                        <div key={asset.id} className="flex items-center gap-2 border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.04)", opacity: asset.active ? 1 : 0.4 }}>
                                            <div className="flex flex-1 items-center gap-3 min-w-0">
                                                <span className="text-[18px]">
                                                    {asset.asset_type === "sticker" ? "🏷️" : asset.asset_type === "badge" ? "🏅" : "📌"}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="truncate font-sans text-[13px] font-medium text-white">{asset.name}</p>
                                                    {asset.description && <p className="truncate font-sans text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{asset.description}</p>}
                                                </div>
                                            </div>
                                            <span className="w-16 shrink-0 rounded-full px-2 py-0.5 text-center font-sans text-[10px] font-bold tracking-wide" style={{
                                                backgroundColor: asset.asset_type === "sticker" ? "rgba(74,222,128,0.15)" : asset.asset_type === "badge" ? "rgba(249,115,22,0.15)" : "rgba(168,139,250,0.15)",
                                                color: asset.asset_type === "sticker" ? "#4ADE80" : asset.asset_type === "badge" ? "#F97316" : "#A78BFA",
                                            }}>{asset.asset_type === "3d_pin" ? "3D" : asset.asset_type.toUpperCase()}</span>
                                            <span className="w-14 shrink-0 text-center font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                                                {asset.xp_cost ?? "—"}
                                            </span>
                                            <span className="w-14 shrink-0 text-center font-sans text-[12px] font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                                                {asset.cash_price_cents ? `$${(asset.cash_price_cents / 100).toFixed(2)}` : "—"}
                                            </span>
                                            <div className="flex w-20 shrink-0 items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleToggleAsset(asset.id, !asset.active)}
                                                    disabled={togglingAsset === asset.id}
                                                    className="rounded-lg px-2 py-1 font-sans text-[10px] font-medium transition active:scale-95 disabled:opacity-50"
                                                    style={{ backgroundColor: asset.active ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)", color: asset.active ? "#4ADE80" : "rgba(255,255,255,0.4)" }}
                                                >{asset.active ? "ON" : "OFF"}</button>
                                                <button
                                                    onClick={() => handleDeleteAsset(asset.id)}
                                                    disabled={deletingAsset === asset.id}
                                                    className="rounded-lg px-2 py-1 font-sans text-[10px] font-medium transition active:scale-95 disabled:opacity-50"
                                                    style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}
                                                >{deletingAsset === asset.id ? "..." : "✕"}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Add Asset Toggle */}
                            {!showAddAsset ? (
                                <button
                                    onClick={() => setShowAddAsset(true)}
                                    className="w-full rounded-xl border border-dashed py-3 font-sans text-[13px] font-medium transition active:scale-[0.99]"
                                    style={{ borderColor: "rgba(249,115,22,0.3)", color: "#F97316" }}
                                >+ Add Digital Asset</button>
                            ) : (
                                <div className="rounded-xl border p-4" style={{ borderColor: "rgba(249,115,22,0.3)", backgroundColor: "rgba(249,115,22,0.04)" }}>
                                    <p className="mb-4 font-sans text-[12px] font-bold tracking-[1px]" style={{ color: "#F97316" }}>NEW DIGITAL ASSET</p>

                                    <div className="flex flex-col gap-4">
                                        <Field label="Name">
                                            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="e.g. Fire Sticker, VIP Crown" className="input" />
                                        </Field>

                                        <Field label="Type">
                                            <div className="flex gap-2">
                                                {(["sticker", "badge", "3d_pin"] as const).map((t) => (
                                                    <Chip key={t} label={t === "3d_pin" ? "3D Pin" : t} active={assetType === t} onClick={() => setAssetType(t)} />
                                                ))}
                                            </div>
                                        </Field>

                                        <Field label="Category">
                                            <div className="flex flex-wrap gap-2">
                                                {["vibe", "shoutout", "love", "event", "trophy", "custom"].map((c) => (
                                                    <Chip key={c} label={c} active={assetCategory === c} onClick={() => setAssetCategory(c)} />
                                                ))}
                                            </div>
                                        </Field>

                                        <Field label="Description" hint="Optional">
                                            <input value={assetDesc} onChange={(e) => setAssetDesc(e.target.value)} placeholder="Show love for this spot" className="input" />
                                        </Field>

                                        <div className="grid grid-cols-3 gap-3">
                                            <Field label="XP Cost">
                                                <input type="number" value={assetXpCost} onChange={(e) => setAssetXpCost(e.target.value)} placeholder="50" className="input" />
                                            </Field>
                                            <Field label="Wallet ($)">
                                                <input type="number" step="0.01" value={assetWalletPrice} onChange={(e) => setAssetWalletPrice(e.target.value)} placeholder="0.99" className="input" />
                                            </Field>
                                            <Field label="Cash ($)">
                                                <input type="number" step="0.01" value={assetCashPrice} onChange={(e) => setAssetCashPrice(e.target.value)} placeholder="1.49" className="input" />
                                            </Field>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <Field label="Min Tier" hint="Optional">
                                                <div className="flex flex-wrap gap-2">
                                                    {["", "explorer", "regular", "member", "vip"].map((t) => (
                                                        <Chip key={t || "any"} label={t || "Any"} active={assetMinTier === t} onClick={() => setAssetMinTier(t)} />
                                                    ))}
                                                </div>
                                            </Field>
                                            <Field label="Duration (hrs)" hint="Leave blank = permanent">
                                                <input type="number" value={assetDuration} onChange={(e) => setAssetDuration(e.target.value)} placeholder="24" className="input" />
                                            </Field>
                                        </div>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" checked={assetAnimated} onChange={(e) => setAssetAnimated(e.target.checked)} className="h-4 w-4 rounded" />
                                            <span className="font-sans text-[13px]" style={{ color: "rgba(255,255,255,0.6)" }}>Animated asset</span>
                                        </label>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleAddAsset}
                                                disabled={savingAsset || !assetName.trim()}
                                                className="rounded-xl px-6 py-2.5 font-sans text-[13px] font-bold text-black active:scale-[0.98] disabled:opacity-50"
                                                style={{ backgroundColor: "#F97316" }}
                                            >{savingAsset ? "Saving..." : "Create Asset"}</button>
                                            <button
                                                onClick={() => setShowAddAsset(false)}
                                                className="rounded-xl px-4 py-2.5 font-sans text-[13px] font-medium active:scale-[0.98]"
                                                style={{ color: "rgba(255,255,255,0.4)" }}
                                            >Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* ─── Account ──────────────────────────────────────────── */}
                        <Card id="account" title="Account" desc="Your login and role at this venue.">
                            <div className="flex flex-col gap-2">
                                <Row label="Email" value={user.email} />
                                <Row label="Role" value={role} />
                                <Row label="User ID" value={user.id.slice(0, 8) + "..."} />
                            </div>
                            <div className="pt-2">
                                <SignOutButton />
                            </div>
                            {typeof window !== "undefined" && window.location.hostname.startsWith("sanddash.") && (
                                <SeedDemoButton />
                            )}
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

function SeedDemoButton() {
    const [seeding, setSeeding] = useState(false);
    const [result, setResult] = useState<{ ok?: boolean; seeded?: number; claimed?: number; unclaimed?: number; error?: string } | null>(null);

    async function handleSeed() {
        setSeeding(true);
        setResult(null);
        try {
            const res = await fetch("/api/seed-demo", { method: "POST" });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ error: err instanceof Error ? err.message : "Failed to seed" });
        } finally {
            setSeeding(false);
        }
    }

    return (
        <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "rgba(234,179,8,0.3)", backgroundColor: "rgba(234,179,8,0.05)" }}>
            <h3 className="font-sans text-[13px] font-bold text-yellow-400">Sandbox Demo Data</h3>
            <p className="mt-1 font-sans text-[11px] text-white/40">
                Seed ~30 real Milwaukee venues from Foursquare — 10 fully set up, 20 unclaimed on the map. All financial data is test-mode.
            </p>
            <button
                onClick={handleSeed}
                disabled={seeding}
                className="mt-3 rounded-xl px-5 py-2.5 font-sans text-[13px] font-bold text-black transition active:scale-[0.97] disabled:opacity-50"
                style={{ backgroundColor: "#EAB308" }}
            >
                {seeding ? "Seeding..." : "Seed Demo Data"}
            </button>
            {result && (
                <p className="mt-2 font-sans text-[11px]" style={{ color: result.ok ? "#4ADE80" : "#EF4444" }}>
                    {result.ok
                        ? `Seeded ${result.seeded} venues (${result.claimed} claimed, ${result.unclaimed} unclaimed)`
                        : result.error}
                </p>
            )}
        </div>
    );
}
