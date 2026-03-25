"use client";

import { useState, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { TheDock as TheDrawer, type Tag } from "@/components/map/the-dock";
import type { MapRef } from "react-map-gl";
import type { RouteData } from "@/components/map/map-view";

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
    const [locationReady, setLocationReady] = useState(false);
    const [activeTag, setActiveTag] = useState<Tag | null>(null);
    const mapRef = useRef<MapRef | null>(null);
    const [navRoute, setNavRoute] = useState<RouteData | null>(null);

    // Filtered venues based on active tag
    const filteredVenues = activeTag
        ? venues.filter((v) => activeTag.venueIds.includes(v.id))
        : venues;

    // Lock viewport for map mode
    useLayoutEffect(() => {
        document.documentElement.classList.add("map-mode");
        return () => document.documentElement.classList.remove("map-mode");
    }, []);

    // Capture referral key from URL
    useEffect(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            const ref = params.get("ref");
            if (ref) localStorage.setItem("kb-ref", ref);
        } catch {}
    }, []);

    // Request geolocation and fetch local discovery venues
    useEffect(() => {
        // Timeout: if geolocation takes too long, show the map anyway
        const fallbackTimer = setTimeout(() => setLocationReady(true), 3000);

        if (!navigator.geolocation) { setLocationReady(true); return; }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                clearTimeout(fallbackTimer);
                const { latitude, longitude } = pos.coords;
                setUserLocation({ latitude, longitude });
                setLocationReady(true);

                try {
                    // Fetch user's discovery radius if logged in
                    let radius = 5000;
                    try {
                        const profileRes = await fetch("/api/profile");
                        if (profileRes.ok) {
                            const p = await profileRes.json();
                            if (p.profile?.discovery_radius_meters) radius = p.profile.discovery_radius_meters;
                        }
                    } catch {}

                    const res = await fetch(`/api/discover?lat=${latitude}&lng=${longitude}&radius=${radius}`);
                    if (!res.ok) return;
                    const localVenues: Venue[] = await res.json();

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
                // Geolocation denied or unavailable — try again with lower accuracy
                setLocationReady(true);
                navigator.geolocation.getCurrentPosition(
                    (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => {},
                    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );

        // Watch for location updates
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, maximumAge: 30000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
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
        if (!mapRef.current) return;

        // Always request fresh location when recenter is tapped
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    setUserLocation({ latitude, longitude });
                    mapRef.current?.flyTo({
                        center: [longitude, latitude],
                        zoom: 14,
                        pitch: 40,
                        duration: 1000,
                    });
                },
                () => {
                    // Fall back to last known location
                    if (userLocation) {
                        mapRef.current?.flyTo({
                            center: [userLocation.longitude, userLocation.latitude],
                            zoom: 14,
                            pitch: 40,
                            duration: 1000,
                        });
                    }
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else if (userLocation) {
            mapRef.current.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 14,
                pitch: 40,
                duration: 1000,
            });
        }
    }, [userLocation]);

    const handleTagSelect = useCallback((tag: Tag | null) => {
        setActiveTag(tag);
        if (tag && tag.venueIds.length > 0) {
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
            {/* Full-screen map — waits for location or timeout before rendering */}
            {locationReady && (
            <MapView
                venues={venues}
                selectedVenue={selectedVenue}
                onVenueSelect={setSelectedVenue}
                userLocation={userLocation}
                mapRef={mapRef}
                route={navRoute}
            />
            )}

            {/* Header overlay — logo */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)", paddingBottom: 20 }}>
                <header className="pointer-events-auto flex items-center justify-center gap-2 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-2">
                    <Image
                        src="/logo.png"
                        alt="theKickBack"
                        width={500}
                        height={250}
                        className="h-12 w-auto drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:h-14"
                        priority
                    />
                    <span className="rounded-full px-2 py-0.5 font-sans text-[9px] font-bold tracking-wider" style={{ backgroundColor: "rgba(249,115,22,0.2)", color: "#F97316", border: "1px solid rgba(249,115,22,0.3)" }}>BETA</span>
                </header>
            </div>

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
                            className="fixed left-0 top-1/2 z-[55] flex h-12 w-8 -translate-y-1/2 items-center justify-center "
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
                            className="fixed right-0 top-1/2 z-[55] flex h-12 w-8 -translate-y-1/2 items-center justify-center "
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

            {/* The Drawer — unified bottom component */}
            <TheDrawer
                venues={venues}
                selectedVenue={selectedVenue}
                onVenueSelect={setSelectedVenue}
                userLocation={userLocation}
                onRecenter={handleRecenter}
                hasLocation={!!userLocation}
                activeTag={activeTag}
                onTagSelect={handleTagSelect}
                onNavigateVenue={navigateVenue}
                onRouteChange={setNavRoute}
                mapRef={mapRef}
            />
        </main>
    );
}
