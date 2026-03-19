"use client";

import { useState } from "react";
import { updateOwnSchedule, updateOwnProfile } from "./actions";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import Image from "next/image";

interface StaffProfile {
    id: string;
    venue_id: string;
    display_name: string;
    role_title: string | null;
    avatar_url: string | null;
    bio: string | null;
    specialties: string[];
    visible: boolean;
    schedule: { day: string; start: string; end: string }[];
    email: string;
    invite_status: string;
}

interface Props {
    profile: StaffProfile;
    venue: { id: string; name: string; type: string };
    userEmail: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StaffPortalClient({ profile, venue, userEmail }: Props) {
    // Schedule state
    const [schedule, setSchedule] = useState<{ day: string; start: string; end: string }[]>(
        Array.isArray(profile.schedule) ? profile.schedule : []
    );
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [scheduleMsg, setScheduleMsg] = useState("");

    // Profile state
    const [bio, setBio] = useState(profile.bio || "");
    const [specialties, setSpecialties] = useState((profile.specialties || []).join(", "));
    const [displayName, setDisplayName] = useState(profile.display_name || "");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState("");

    function toggleDay(day: string) {
        const existing = schedule.find((s) => s.day === day);
        if (existing) {
            setSchedule(schedule.filter((s) => s.day !== day));
        } else {
            setSchedule([...schedule, { day, start: "09:00", end: "17:00" }]);
        }
    }

    function updateTime(day: string, field: "start" | "end", value: string) {
        setSchedule(schedule.map((s) => s.day === day ? { ...s, [field]: value } : s));
    }

    async function handleSaveSchedule() {
        setSavingSchedule(true);
        setScheduleMsg("");
        const result = await updateOwnSchedule(profile.id, schedule);
        if (result.ok) {
            setScheduleMsg("Schedule saved!");
            setTimeout(() => setScheduleMsg(""), 2000);
        } else {
            setScheduleMsg(result.error || "Failed to save");
        }
        setSavingSchedule(false);
    }

    async function handleSaveProfile() {
        setSavingProfile(true);
        setProfileMsg("");
        const tags = specialties.split(",").map((s) => s.trim()).filter(Boolean);
        const result = await updateOwnProfile(profile.id, {
            display_name: displayName.trim() || undefined,
            bio: bio.trim() || undefined,
            specialties: tags.length > 0 ? tags : undefined,
        });
        if (result.ok) {
            setProfileMsg("Profile updated!");
            setTimeout(() => setProfileMsg(""), 2000);
        } else {
            setProfileMsg(result.error || "Failed to save");
        }
        setSavingProfile(false);
    }

    return (
        <main className="min-h-screen bg-[#FAFAFA]">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                {/* Header */}
                <header className="flex items-center justify-between pb-8">
                    <div>
                        <h1 className="font-sans text-2xl font-bold tracking-tight text-black">
                            Staff Portal
                        </h1>
                        <p className="font-sans text-sm text-black/40">
                            {venue.name} &middot; {userEmail}
                        </p>
                    </div>
                    <SignOutButton />
                </header>

                {/* Profile card */}
                <div className="mb-6 flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white p-5">
                    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.03]">
                        {profile.avatar_url ? (
                            <Image src={profile.avatar_url} alt={profile.display_name} fill className="object-cover" sizes="64px" />
                        ) : (
                            <span className="font-sans text-2xl font-bold text-black/20">
                                {profile.display_name.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div>
                        <p className="font-sans text-lg font-semibold text-black">{profile.display_name}</p>
                        {profile.role_title && <p className="font-sans text-sm text-black/40">{profile.role_title}</p>}
                        <div className="mt-1 flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${profile.visible ? "bg-green-400" : "bg-gray-300"}`} />
                            <span className="font-sans text-xs text-black/30">
                                {profile.visible ? "Visible on venue page" : "Hidden from venue page"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Schedule section */}
                <section className="mb-6 rounded-2xl border border-black/[0.06] bg-white p-5">
                    <h2 className="mb-1 font-sans text-base font-semibold text-black">My Schedule</h2>
                    <p className="mb-4 font-sans text-xs text-black/30">
                        Set your working hours. These appear on the venue page.
                    </p>

                    <div className="flex flex-col gap-2">
                        {DAYS.map((day) => {
                            const slot = schedule.find((s) => s.day === day);
                            return (
                                <div key={day} className="flex items-center gap-3">
                                    <button
                                        onClick={() => toggleDay(day)}
                                        className="flex h-8 w-14 items-center justify-center rounded-lg font-sans text-xs font-medium transition"
                                        style={{
                                            backgroundColor: slot ? "#F97316" : "rgba(0,0,0,0.04)",
                                            color: slot ? "white" : "rgba(0,0,0,0.3)",
                                        }}
                                    >
                                        {day}
                                    </button>
                                    {slot ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={slot.start}
                                                onChange={(e) => updateTime(day, "start", e.target.value)}
                                                className="rounded-lg border border-black/[0.08] bg-white px-2 py-1 font-mono text-xs"
                                            />
                                            <span className="font-sans text-xs text-black/20">to</span>
                                            <input
                                                type="time"
                                                value={slot.end}
                                                onChange={(e) => updateTime(day, "end", e.target.value)}
                                                className="rounded-lg border border-black/[0.08] bg-white px-2 py-1 font-mono text-xs"
                                            />
                                        </div>
                                    ) : (
                                        <span className="font-sans text-xs text-black/15">Off</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            onClick={handleSaveSchedule}
                            disabled={savingSchedule}
                            className="rounded-lg px-4 py-2 font-sans text-xs font-semibold text-white transition"
                            style={{ backgroundColor: "#F97316" }}
                        >
                            {savingSchedule ? "Saving..." : "Save Schedule"}
                        </button>
                        {scheduleMsg && (
                            <span className="font-sans text-xs font-medium" style={{ color: scheduleMsg.includes("!") ? "#16a34a" : "#dc2626" }}>
                                {scheduleMsg}
                            </span>
                        )}
                    </div>
                </section>

                {/* Profile section */}
                <section className="mb-6 rounded-2xl border border-black/[0.06] bg-white p-5">
                    <h2 className="mb-1 font-sans text-base font-semibold text-black">My Profile</h2>
                    <p className="mb-4 font-sans text-xs text-black/30">
                        This info appears on the venue page when guests tap your name.
                    </p>

                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="mb-1 block font-sans text-xs font-medium text-black/40">Display Name</label>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block font-sans text-xs font-medium text-black/40">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={3}
                                placeholder="Tell guests about yourself..."
                                className="w-full resize-none rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-sm"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block font-sans text-xs font-medium text-black/40">Specialties</label>
                            <input
                                value={specialties}
                                onChange={(e) => setSpecialties(e.target.value)}
                                placeholder="Comma-separated, e.g. Espresso, Latte Art, Pour Over"
                                className="w-full rounded-lg border border-black/[0.08] bg-white px-3 py-2 font-sans text-sm"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                        <button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            className="rounded-lg px-4 py-2 font-sans text-xs font-semibold text-white transition"
                            style={{ backgroundColor: "#F97316" }}
                        >
                            {savingProfile ? "Saving..." : "Update Profile"}
                        </button>
                        {profileMsg && (
                            <span className="font-sans text-xs font-medium" style={{ color: profileMsg.includes("!") ? "#16a34a" : "#dc2626" }}>
                                {profileMsg}
                            </span>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
