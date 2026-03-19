"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { type Venue } from "@/lib/venues";
import { VenueDrawer } from "@/components/map/venue-drawer";
import { MasterDrawer } from "@/components/map/master-drawer";

const MapView = dynamic(
    () => import("@/components/map/map-view").then((m) => m.MapView),
    { ssr: false }
);

interface JoinPageClientProps {
    venues: Venue[];
}

export function JoinPageClient({ venues }: JoinPageClientProps) {
    const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

    const navigateVenue = useCallback((dir: -1 | 1) => {
        if (!selectedVenue || venues.length === 0) return;
        const idx = venues.findIndex((v) => v.id === selectedVenue.id);
        const next = (idx + dir + venues.length) % venues.length;
        setSelectedVenue(venues[next]);
    }, [selectedVenue, venues]);

    if (venues.length === 0) {
        return (
            <main className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-black">
                <div className="text-center px-6">
                    <Image
                        src="/logo.png"
                        alt="theKickBack"
                        width={400}
                        height={200}
                        className="mx-auto h-20 w-auto drop-shadow-2xl sm:h-24 mb-6"
                        style={{ filter: "invert(1)" }}
                        priority
                    />
                    <p className="font-sans text-[15px] text-white/40">
                        No venues live yet. Check back soon.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="relative h-dvh w-full overflow-hidden bg-black">
            {/* Full-screen map */}
            <MapView
                venues={venues}
                selectedVenue={selectedVenue}
                onVenueSelect={setSelectedVenue}
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
