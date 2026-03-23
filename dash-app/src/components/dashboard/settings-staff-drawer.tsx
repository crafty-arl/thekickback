"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  addStaffMember,
  updateStaffMember,
  deleteStaffMember,
  toggleStaffVisibility,
  uploadStaffAvatar,
} from "@/app/settings/staff-actions";

// ─── Types ──────────────────────────────────────────────────────────

interface StaffMember {
  id: string;
  display_name: string | null;
  role_title: string | null;
  avatar_url: string | null;
  bio: string | null;
  specialties: string[] | null;
  visible: boolean;
  schedule: unknown;
}

interface ScheduleSlot {
  day: string;
  working: boolean;
  start: string;
  end: string;
}

interface SettingsStaffDrawerProps {
  venueId: string;
  initialStaff: StaffMember[];
  onClose: () => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function blankSchedule(): ScheduleSlot[] {
  return DAYS.map((day) => ({ day, working: false, start: "09:00", end: "17:00" }));
}

function scheduleFromExisting(raw: unknown): ScheduleSlot[] {
  const existing = (Array.isArray(raw) ? raw : []) as { day: string; start: string; end: string }[];
  return DAYS.map((day) => {
    const found = existing.find((s) => s.day === day);
    return { day, working: !!found, start: found?.start || "09:00", end: found?.end || "17:00" };
  });
}

// ─── Component ──────────────────────────────────────────────────────

export function SettingsStaffDrawer({ venueId, initialStaff, onClose }: SettingsStaffDrawerProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSpecialties, setEditSpecialties] = useState("");
  const [editSchedule, setEditSchedule] = useState<ScheduleSlot[]>(blankSchedule());
  const [saving, setSaving] = useState(false);

  const [msg, setMsg] = useState("");

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  }

  function startEdit(m: StaffMember) {
    setEditingId(m.id);
    setEditName(m.display_name || "");
    setEditTitle(m.role_title || "");
    setEditBio(m.bio || "");
    setEditSpecialties((m.specialties || []).join(", "));
    setEditSchedule(scheduleFromExisting(m.schedule));
  }

  async function handleAdd() {
    if (!newEmail.trim() || !newEmail.includes("@")) return;
    setAdding(true);
    const result = await addStaffMember(venueId, {
      email: newEmail.trim(),
      display_name: newName.trim() || undefined,
      role_title: newTitle.trim() || undefined,
    });
    if (result.staff) {
      setStaffList((prev) => [...prev, result.staff as unknown as StaffMember]);
      setNewEmail("");
      setNewName("");
      setNewTitle("");
      setShowAdd(false);
      flash("Staff added!");
    } else if (result.error) {
      flash(result.error);
    }
    setAdding(false);
  }

  async function handleSaveEdit(memberId: string) {
    setSaving(true);
    const schedule = editSchedule.filter((s) => s.working).map((s) => ({ day: s.day, start: s.start, end: s.end }));
    const specialties = editSpecialties.split(",").map((s) => s.trim()).filter(Boolean);
    const result = await updateStaffMember(venueId, memberId, {
      display_name: editName.trim(),
      role_title: editTitle.trim() || undefined,
      bio: editBio.trim() || undefined,
      specialties,
      schedule,
    });
    if (!result.error) {
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === memberId
            ? { ...s, display_name: editName.trim(), role_title: editTitle.trim() || null, bio: editBio.trim() || null, specialties, schedule }
            : s,
        ),
      );
      setEditingId(null);
      flash("Saved!");
    } else {
      flash(result.error);
    }
    setSaving(false);
  }

  async function handleDelete(memberId: string) {
    const result = await deleteStaffMember(venueId, memberId);
    if (!result.error) {
      setStaffList((prev) => prev.filter((s) => s.id !== memberId));
    }
  }

  async function handleToggleVisibility(m: StaffMember) {
    const next = !m.visible;
    await toggleStaffVisibility(venueId, m.id, next);
    setStaffList((prev) => prev.map((s) => (s.id === m.id ? { ...s, visible: next } : s)));
  }

  async function handleAvatarUpload(memberId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadStaffAvatar(venueId, memberId, fd);
    if (result.url) {
      setStaffList((prev) => prev.map((s) => (s.id === memberId ? { ...s, avatar_url: result.url! } : s)));
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="staff-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/30"
      />

      {/* Panel */}
      <motion.div
        key="staff-drawer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-md flex-col border-l border-gray-200 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <p className="font-sans text-[16px] font-bold text-gray-900">Your Team</p>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Flash message */}
          {msg && (
            <p
              className="rounded-lg px-3 py-2 text-center font-sans text-[13px] font-medium"
              style={{
                backgroundColor: msg.includes("!") ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)",
                color: msg.includes("!") ? "#16a34a" : "#dc2626",
              }}
            >
              {msg}
            </p>
          )}

          {/* Empty state */}
          {staffList.length === 0 && !showAdd && (
            <p className="font-sans text-[13px] text-gray-400">No staff added yet.</p>
          )}

          {/* Staff list */}
          <div className="flex flex-col gap-3">
            {staffList.map((member) => (
              <div key={member.id}>
                {/* Staff card */}
                <div className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  {/* Avatar */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.display_name || ""} className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-sans text-[16px] font-bold text-orange-500">
                        {(member.display_name || "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    {/* Upload overlay */}
                    <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full opacity-0 transition group-hover:opacity-100" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleAvatarUpload(member.id, f);
                        }}
                      />
                    </label>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-sans text-[13px] font-medium text-gray-800">{member.display_name || "Unnamed"}</p>
                      {member.visible ? (
                        <span className="rounded-full bg-green-50 px-1.5 py-0.5 font-sans text-[8px] font-bold tracking-wider text-green-600">VISIBLE</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-sans text-[8px] font-bold tracking-wider text-gray-400">HIDDEN</span>
                      )}
                    </div>
                    {member.role_title && <p className="font-sans text-[11px] text-gray-400">{member.role_title}</p>}
                    {member.specialties && member.specialties.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {member.specialties.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 font-sans text-[9px] text-gray-500">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                    {/* Edit */}
                    <button
                      onClick={() => startEdit(member)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 transition hover:bg-gray-200"
                      title="Edit"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    {/* Visibility */}
                    <button
                      onClick={() => handleToggleVisibility(member)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 transition hover:bg-gray-200"
                      title={member.visible ? "Hide from page" : "Show on page"}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={member.visible ? "#6b7280" : "#d1d5db"} strokeWidth="2" strokeLinecap="round">
                        {member.visible ? (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        ) : (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        )}
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 transition hover:bg-red-100"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Inline edit form */}
                {editingId === member.id && (
                  <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Display name"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                      />
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Role title"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                      />
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        placeholder="Bio"
                        rows={2}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                        style={{ resize: "none" }}
                      />
                      <input
                        value={editSpecialties}
                        onChange={(e) => setEditSpecialties(e.target.value)}
                        placeholder="Specialties (comma-separated)"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                      />

                      {/* Schedule grid */}
                      <div>
                        <label className="font-sans text-[12px] font-semibold text-gray-500">Schedule</label>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {editSchedule.map((slot, idx) => (
                            <div key={slot.day} className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  setEditSchedule((prev) =>
                                    prev.map((s, i) => (i === idx ? { ...s, working: !s.working } : s)),
                                  )
                                }
                                className="flex h-7 w-12 shrink-0 items-center justify-center rounded-lg font-sans text-[11px] font-bold transition"
                                style={{
                                  backgroundColor: slot.working ? "rgba(74,222,128,0.15)" : "#f3f4f6",
                                  color: slot.working ? "#16a34a" : "#9ca3af",
                                  border: `1px solid ${slot.working ? "rgba(74,222,128,0.3)" : "#e5e7eb"}`,
                                }}
                              >
                                {slot.day}
                              </button>
                              {slot.working ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) =>
                                      setEditSchedule((prev) =>
                                        prev.map((s, i) => (i === idx ? { ...s, start: e.target.value } : s)),
                                      )
                                    }
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-sans text-[12px] text-gray-700 outline-none focus:border-orange-300"
                                  />
                                  <span className="font-sans text-[11px] text-gray-300">to</span>
                                  <input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) =>
                                      setEditSchedule((prev) =>
                                        prev.map((s, i) => (i === idx ? { ...s, end: e.target.value } : s)),
                                      )
                                    }
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-sans text-[12px] text-gray-700 outline-none focus:border-orange-300"
                                  />
                                </div>
                              ) : (
                                <span className="font-sans text-[11px] text-gray-300">Off</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => handleSaveEdit(member.id)}
                          disabled={saving}
                          className="rounded-lg bg-orange-500 px-4 py-2 font-sans text-[12px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg bg-gray-100 px-4 py-2 font-sans text-[12px] text-gray-500 transition hover:bg-gray-200"
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
          {showAdd ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex flex-col gap-3">
                <input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email *"
                  type="email"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                />
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Display name (optional)"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Role title (e.g. Lead Barista)"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 font-sans text-[13px] text-gray-800 outline-none focus:border-orange-300 focus:ring-1 focus:ring-orange-200"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="rounded-lg bg-orange-500 px-4 py-2 font-sans text-[12px] font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    {adding ? "Adding..." : "Add"}
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="rounded-lg bg-gray-100 px-4 py-2 font-sans text-[12px] text-gray-500 transition hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-200 bg-white py-3 font-sans text-[13px] font-medium text-gray-400 transition hover:border-orange-300 hover:text-orange-500"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add team member
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
