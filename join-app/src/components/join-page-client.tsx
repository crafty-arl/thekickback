"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { VenueDrawer } from "@/components/map/venue-drawer";
import { MasterDrawer } from "@/components/map/master-drawer";
import { TagRail, type Tag } from "@/components/map/tag-rail";
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
    const [activeTag, setActiveTag] = useState<Tag | null>(null);
    const mapRef = useRef<MapRef | null>(null);

    // Filtered venues based on active tag
    const filteredVenues = activeTag
        ? venues.filter((v) => activeTag.venueIds.includes(v.id))
        : venues;

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
        const navVenues = filteredVenues.length > 0 ? filteredVenues : venues;
        if (!selectedVenue || navVenues.length === 0) return;
        const idx = navVenues.findIndex((v) => v.id === selectedVenue.id);
        const startIdx = idx === -1 ? 0 : idx;
        const next = (startIdx + dir + navVenues.length) % navVenues.length;
        setSelectedVenue(navVenues[next]);
    }, [selectedVenue, venues, filteredVenues]);

    const handleRecenter = useCallback(() => {
        if (!userLocation || !mapRef.current) return;
        mapRef.current.flyTo({
            center: [userLocation.longitude, userLocation.latitude],
            zoom: 14,
            pitch: 40,
            duration: 1000,
        });
    }, [userLocation]);

    const handleTagSelect = useCallback((tag: Tag | null) => {
        setActiveTag(tag);
        if (tag && tag.venueIds.length > 0) {
            // Auto-select the first venue matching this tag
            const firstMatch = venues.find((v) => tag.venueIds.includes(v.id));
            if (firstMatch) {
                setSelectedVenue(firstMatch);
                mapRef.current?.flyTo({
                    center: [firstMatch.longitude, firstMatch.latitude],
                    zoom: 15.5,
                    pitch: 50,
                    duration: 800,
                });
            }
        } else {
            // Clear filter — deselect venue and zoom out
            setSelectedVenue(null);
            if (venues.length >= 2) {
                const lngs = venues.map((v) => v.longitude);
                const lats = venues.map((v) => v.latitude);
                mapRef.current?.fitBounds(
                    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                    { padding: { top: 100, bottom: 80, left: 40, right: 40 }, duration: 800 }
                );
            }
        }
    }, [venues]);

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

            {/* Header overlay — logo only */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
                <header className="pointer-events-auto flex items-center justify-center px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2">
                    <Image
                        src="/logo.png"
                        alt="theKickBack"
                        width={400}
                        height={200}
                        className="h-20 w-auto drop-shadow-2xl sm:h-24"
                        style={{ filter: "invert(1)" }}
                        priority
                    />
                </header>
            </div>

            {/* Tag rail — above the command bar */}
            <AnimatePresence>
                {!selectedVenue && (
                    <TagRail
                        venues={venues}
                        activeTag={activeTag?.id || null}
                        onTagSelect={handleTagSelect}
                    />
                )}
            </AnimatePresence>

            {/* Edge arrows — prev/next venue (show when venue selected OR tag active) */}
            <AnimatePresence>
                {(selectedVenue || (activeTag && filteredVenues.length > 1)) && (
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
                        onRecenter={handleRecenter}
                        hasLocation={!!userLocation}
                    />
                )}
            </AnimatePresence>
        </main>
    );
}
