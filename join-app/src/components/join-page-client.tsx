"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { VenueDrawer } from "@/components/map/venue-drawer";
import { MasterDrawer } from "@/components/map/master-drawer";
import type { MapRef } from "react-map-gl";

const MapView = dynamic(
    () => import("@/components/map/map-view").then((m) => m.MapView),
    { ssr: false }
);

interface JoinPageClientProps {
    venues: Venue[];
}

export function JoinPageClient({ venues: serverVenues }: JoinPageClientProps) {
    const [venues, setVenues] = useState<Venue[]>(serverVenues);
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const mapRef = useRef<MapRef | null>(null);

    // Request geolocation and fetch local discovery venues
    useEffect(() => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                setUserLocation({ latitude, longitude });

                try {
                    const res = await fetch(`/api/discover?lat=${latitude}&lng=${longitude}`);
                    if (!res.ok) return;
                    const localVenues: Venue[] = await res.json();

                    // Merge: keep claimed (Supabase) venues, replace discovery with local ones
                    const claimed = serverVenues.filter((v) => v.claimed !== false);
                    const claimedNames = new Set(claimed.map((v) => v.name.toLowerCase()));
                    const uniqueLocal = localVenues.filter(
                        (v) => !claimedNames.has(v.name.toLowerCase())
                    );
                    setVenues([...claimed, ...uniqueLocal]);
                } catch {
                    // Keep server-rendered venues on error
                }
            },
            () => {
                // Geolocation denied or unavailable — keep server defaults
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
    }, [serverVenues]);

    const navigateVenue = useCallback((dir: -1 | 1) => {
        if (!selectedVenue || venues.length === 0) return;
        const idx = venues.findIndex((v) => v.id === selectedVenue.id);
        const next = (idx + dir + venues.length) % venues.length;
        setSelectedVenue(venues[next]);
    }, [selectedVenue, venues]);

    const handleRecenter = useCallback(() => {
        if (!userLocation || !mapRef.current) return;
        mapRef.current.flyTo({
            center: [userLocation.longitude, userLocation.latitude],
            zoom: 14,
            pitch: 40,
            duration: 1000,
        });
    }, [userLocation]);

    return (
        <main className="relative h-dvh w-full overflow-hidden bg-black">
            {/* Full-screen map */}
            <MapView
                venues={venues}
                selectedVenue={selectedVenue}
                onVenueSelect={setSelectedVenue}
                userLocation={userLocation}
                mapRef={mapRef}
            />

            {/* Header overlay — logo + location button */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
                <header className="pointer-events-auto flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
                    {/* Spacer for centering */}
                    <div className="w-10" />

                    <Image
                        src="/logo.png"
                        alt="theKickBack"
                        width={400}
                        height={200}
                        className="h-20 w-auto drop-shadow-2xl sm:h-24"
                        style={{ filter: "invert(1)" }}
                        priority
                    />

                    {/* Location recenter button — matches pill aesthetic */}
                    {userLocation ? (
                        <button
                            onClick={handleRecenter}
                            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
                            style={{
                                backgroundColor: "rgba(15, 15, 18, 0.65)",
                                backdropFilter: "blur(40px) saturate(1.8)",
                                WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
                            }}
                            aria-label="Center on my location"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                            </svg>
                        </button>
                    ) : (
                        <div className="w-10" />
                    )}
                </header>
            </div>

            {/* Edge arrows — prev/next venue */}
            <AnimatePresence>
                {selectedVenue && (
                    <>
                        {/* Left arrow */}
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={() => navigateVenue(-1)}
                            className="fixed left-0 top-1/2 z-[60] flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-r-xl"
                            style={{
                                backgroundColor: "rgba(15, 15, 18, 0.6)",
                                backdropFilter: "blur(20px)",
                                WebkitBackdropFilter: "blur(20px)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderLeft: "none",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </motion.button>

                        {/* Right arrow */}
                        <motion.button
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            onClick={() => navigateVenue(1)}
                            className="fixed right-0 top-1/2 z-[60] flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl"
                            style={{
                                backgroundColor: "rgba(15, 15, 18, 0.6)",
                                backdropFilter: "blur(20px)",
                                WebkitBackdropFilter: "blur(20px)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRight: "none",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </motion.button>
                    </>
                )}
            </AnimatePresence>

            {/* Command bar — always visible, morphs between master and venue agent */}
            <AnimatePresence mode="wait">
                {selectedVenue ? (
                    <VenueDrawer
                        key={selectedVenue.id}
                        venue={selectedVenue}
                        onClose={() => setSelectedVenue(null)}
                    />
                ) : (
                    <MasterDrawer
                        key="master"
                        venues={venues}
                        onVenueSelect={setSelectedVenue}
                    />
                )}
            </AnimatePresence>
        </main>
    );
}
