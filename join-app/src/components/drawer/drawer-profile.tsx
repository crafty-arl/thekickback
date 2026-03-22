"use client";

import { type RefObject, type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { createClient } from "@/lib/supabase/client";
import { type UserProfile, type Perk, type Message, TIER_CONFIG, PERK_EMOJI } from "./the-drawer";
import { WalletSheet } from "../map/wallet-sheet";
import { PreferencesSection } from "../map/preferences-section";

interface DeviceRecord {
  id: string;
  device_id: string;
  device_name: string | null;
  last_active_at: string;
  created_at: string;
}

function DeviceManager() {
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [maxDevices, setMaxDevices] = useState(3);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState("");

  useEffect(() => { import("@/lib/device-id").then(({ getDeviceId }) => getDeviceId()).then(setCurrentDeviceId); }, []);

  const loadDevices = useCallback(() => {
    fetch("/api/devices").then((r) => r.ok ? r.json() : null).then((data) => { if (data?.devices) setDevices(data.devices); if (data?.maxDevices) setMaxDevices(data.maxDevices); }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleRemove = useCallback(async (deviceDbId: string) => {
    setRemoving(deviceDbId);
    try { const res = await fetch("/api/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceDbId }) }); const data = await res.json(); if (data.ok) loadDevices(); } catch {}
    setRemoving(null);
  }, [loadDevices]);

  if (loading) return <div className="px-4 py-3"><div className="h-20 animate-pulse " style={{ backgroundColor: "rgba(255,255,255,0.03)" }} /></div>;

  return (
    <div className="px-4 py-2">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center " style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
        </div>
        <div>
          <p className="font-sans text-[15px] font-semibold text-white/80">Devices</p>
          <p className="font-sans text-[12px] text-white/30">{devices.length} of {maxDevices} devices</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {devices.map((d) => {
          const isCurrent = d.device_id === currentDeviceId;
          const lastActive = new Date(d.last_active_at);
          const isToday = new Date().toDateString() === lastActive.toDateString();
          const timeLabel = isToday ? "Active today" : lastActive.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <div key={d.id} className="flex items-center justify-between  px-3 py-2.5" style={{ backgroundColor: isCurrent ? "rgba(99,91,255,0.06)" : "rgba(255,255,255,0.02)", border: isCurrent ? "1px solid rgba(99,91,255,0.15)" : "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-sans text-[12px] font-medium text-white/60">{d.device_name || "Unknown device"}</p>
                    {isCurrent && <span className="rounded-full px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(99,91,255,0.15)", color: "#a78bfa" }}>This device</span>}
                  </div>
                  <p className="font-sans text-[10px] text-white/25">{timeLabel}</p>
                </div>
              </div>
              {!isCurrent && (
                <motion.button onClick={() => handleRemove(d.id)} disabled={removing === d.id} whileTap={{ scale: 0.9 }} className=" px-2.5 py-1.5 font-sans text-[12px] font-medium text-red-400/60 transition hover:bg-red-500/10 disabled:opacity-40">
                  {removing === d.id ? "..." : "Remove"}
                </motion.button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface DrawerProfileProps {
  user: UserProfile;
  venues: Venue[];
  perks: Perk[];
  memberships: { venue_id: string; venue_name: string; tier: string; expires_at: string }[];
  referralKeys: { id: string; key: string; used_by_email: string | null }[];
  myCollectibles: { unlock_id: string; asset_id: string; name: string; asset_type: string; category: string; description: string | null; is_animated: boolean; hub_id: string | null; hub_name: string; payment_method: string; unlocked_at: string }[];
  tierColor: string;
  passkey: { hasPasskey: boolean; verifying: boolean; register: () => Promise<boolean>; verify: () => Promise<boolean> };
  onBack: () => void;
  onVenueSelect: (venue: Venue | null) => void;
  send: (text?: string) => void;
  deviceRefreshKey: number;
  setDeviceRefreshKey: (fn: (k: number) => number) => void;
  setVenueThreads: Dispatch<SetStateAction<Map<string, Message[]>>>;
  selectedVenue: Venue | null;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export function DrawerProfile({
  user, venues, perks, memberships, referralKeys, myCollectibles,
  tierColor, passkey, onBack, onVenueSelect, send,
  deviceRefreshKey, setDeviceRefreshKey, setVenueThreads, selectedVenue,
  scrollRef,
}: DrawerProfileProps) {
  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 px-4 pb-2">
        <motion.button onClick={onBack} whileTap={{ scale: 0.85 }} className="flex h-[48px] w-[48px] items-center justify-center rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><polyline points="15 18 9 12 15 6" /></svg>
        </motion.button>
        <span className="font-sans text-[20px] font-bold text-white/90">Profile</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}>
        <div className="px-4 pb-4">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${tierColor}30, ${tierColor}10)`, border: `2px solid ${tierColor}40` }}>
              <span className="font-sans text-[20px] font-bold" style={{ color: tierColor }}>{user.email[0].toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="font-sans text-[15px] font-semibold text-white/80">{user.email}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 font-sans text-[12px] font-bold uppercase tracking-wider" style={{ backgroundColor: `${tierColor}15`, color: tierColor }}>
                  {TIER_CONFIG[user.tier]?.label || "Explorer"}
                </span>
                {user.streak > 0 && <span className="flex items-center gap-1 font-sans text-[12px] font-semibold text-orange">&#x1f525; {user.streak}</span>}
              </div>
            </div>
          </div>

          {/* XP progress */}
          <div className="mt-4  px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">KICKBACK SCORE</span>
              <span className="font-mono text-[15px] font-bold" style={{ color: tierColor }}>
                {user.kickbackScore.toLocaleString()}
                {TIER_CONFIG[user.tier]?.next && <span className="font-normal text-white/20"> / {TIER_CONFIG[user.tier].threshold.toLocaleString()}</span>}
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${TIER_CONFIG[user.tier]?.next ? Math.min((user.kickbackScore / TIER_CONFIG[user.tier].threshold) * 100, 100) : 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${tierColor}, ${tierColor}cc)`, boxShadow: `0 0 10px ${tierColor}40` }}
              />
            </div>
            {TIER_CONFIG[user.tier]?.next && (
              <p className="mt-1.5 font-sans text-[12px] text-white/20">{(TIER_CONFIG[user.tier].threshold - user.kickbackScore).toLocaleString()} XP to {TIER_CONFIG[user.tier].next}</p>
            )}
          </div>

          {/* Get KickBack Pass */}
          <a
            href={`https://thekickback.net/wallet/pass/${user.authId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center gap-3  px-4 py-3 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${tierColor}15, ${tierColor}05)`, border: `1px solid ${tierColor}25`, minHeight: 48 }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center " style={{ backgroundColor: `${tierColor}20` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={tierColor} strokeWidth="2" strokeLinecap="round"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            </div>
            <div className="flex-1">
              <p className="font-sans text-[15px] font-bold text-white/90">Get KickBack Pass</p>
              <p className="font-sans text-[12px] text-white/30">Add to Apple Wallet</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </a>

          {/* Biometric */}
          <div className="mt-3  px-4 py-3" style={{ backgroundColor: passkey.hasPasskey ? "rgba(74,222,128,0.06)" : "rgba(249,115,22,0.06)", border: `1px solid ${passkey.hasPasskey ? "rgba(74,222,128,0.15)" : "rgba(249,115,22,0.15)"}` }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={passkey.hasPasskey ? "#4ADE80" : "#F97316"} strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <span className="font-sans text-[15px] font-semibold" style={{ color: passkey.hasPasskey ? "#4ADE80" : "rgba(255,255,255,0.6)" }}>
                  {passkey.hasPasskey ? "Biometric enabled" : "Biometric not set up"}
                </span>
              </div>
              <button
                onClick={async () => {
                  const ok = await passkey.register();
                  if (ok) {
                    setDeviceRefreshKey((k: number) => k + 1);
                    setVenueThreads((prev: Map<string, Message[]>) => {
                      const next = new Map(prev);
                      const vid = selectedVenue?.id || "global";
                      next.set(vid, [...(next.get(vid) || []), { id: `bio-ok-${Date.now()}`, sender: "ai" as const, body: "Biometric registered on this device. Wallet payments are now enabled.", timestamp: Date.now() }]);
                      return next;
                    });
                  }
                }}
                disabled={passkey.verifying}
                className=" px-3 py-2 font-sans text-[12px] font-bold active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: passkey.hasPasskey ? "rgba(74,222,128,0.15)" : "#F97316", color: passkey.hasPasskey ? "#4ADE80" : "#000", minHeight: 44 }}
              >
                {passkey.verifying ? "Setting up..." : passkey.hasPasskey ? "Add this device" : "Enable"}
              </button>
            </div>
            <p className="mt-1.5 font-sans text-[12px] text-white/25">
              {passkey.hasPasskey ? "Wallet not working? Tap \"Add this device\" to register biometric here." : "Required for wallet purchases. Uses Face ID / Touch ID."}
            </p>
          </div>

          {/* Memberships */}
          {memberships.length > 0 && (
            <div className="mt-4">
              <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">MEMBERSHIPS</span>
              <div className="mt-2 flex flex-col gap-1.5">
                {memberships.map((m) => (
                  <div key={m.venue_id} className="flex items-center gap-2.5  px-4 py-3" style={{ backgroundColor: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
                    <span className="text-[16px]">{"\u{1F451}"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[15px] font-semibold text-white/80">{m.venue_name}</p>
                      <p className="font-sans text-[12px] text-white/30">{m.tier} · expires {new Date(m.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral Keys */}
          {referralKeys.length > 0 && (
            <div className="mt-4  px-4 py-3" style={{ backgroundColor: "rgba(249,115,22,0.04)", border: "1px solid rgba(249,115,22,0.1)" }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">REFERRAL KEYS</span>
                <span className="font-mono text-[12px] font-bold" style={{ color: "#F97316" }}>{referralKeys.filter((k) => !k.used_by_email).length}/{referralKeys.length} left</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {referralKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-2">
                    <span className={`flex-1 font-mono text-[12px] ${k.used_by_email ? "text-white/15 line-through" : "text-white/50"}`}>{k.key}</span>
                    {k.used_by_email ? (
                      <span className="font-sans text-[10px] text-white/15">used</span>
                    ) : (
                      <button onClick={() => { navigator.clipboard?.writeText(`https://join.thekickback.net?ref=${k.key}`); }} className=" px-2 py-1 font-sans text-[12px] font-bold active:scale-95" style={{ backgroundColor: "rgba(249,115,22,0.12)", color: "#F97316" }}>Copy</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Perks */}
          {perks.length > 0 && (
            <div className="mt-4">
              <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">PERKS</span>
              <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                {perks.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex shrink-0 flex-col items-center  px-3 py-2.5" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", width: 90 }}>
                    <span className="font-sans text-[12px] font-semibold text-white/70 text-center leading-tight line-clamp-2">{p.name}</span>
                    <span className="mt-1 font-mono text-[12px] font-bold text-orange">{p.point_cost} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Venue badges */}
          {user.venueProfiles.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-sans text-[12px] font-semibold tracking-[2px] text-white/25">VENUES VISITED</span>
                <span className="font-mono text-[12px] font-bold text-white/40">{user.venueProfiles.length}</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
                {user.venueProfiles.slice(0, 12).map((vp) => {
                  const milestoneColor = vp.venue_xp_milestones?.color || "#94a3b8";
                  const venueName = vp.venues?.name || "Venue";
                  return (
                    <div key={vp.venue_id} className="flex shrink-0 flex-col items-center" style={{ width: 56 }}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${milestoneColor}20, ${milestoneColor}08)`, border: `2px solid ${milestoneColor}30` }}>
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: milestoneColor, boxShadow: `0 0 6px ${milestoneColor}50` }} />
                      </div>
                      <p className="mt-1 w-full truncate text-center font-sans text-[9px] font-medium text-white/40">{venueName}</p>
                      <span className="font-mono text-[9px] font-bold" style={{ color: milestoneColor }}>{vp.xp}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Wallet */}
        <WalletSheet />

        {/* Device Management */}
        <DeviceManager key={deviceRefreshKey} />

        {/* Preferences */}
        <div className="px-4">
          <PreferencesSection />
        </div>

        {/* Sign out */}
        <div className="px-4 pb-6 pt-3">
          <button
            onClick={async () => { const supabase = createClient(); await supabase.auth.signOut(); window.location.reload(); }}
            className="flex w-full items-center justify-center gap-2  py-3 font-sans text-[15px] font-medium text-white/25 transition hover:bg-white/[0.04] hover:text-white/40"
            style={{ border: "1px solid rgba(255,255,255,0.05)", minHeight: 48 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}
