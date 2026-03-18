"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence } from "framer-motion";
import { MOCK_VENUES, type Venue } from "@/lib/venues";
import { VenueDrawer } from "@/components/map/venue-drawer";
import { AuthButton } from "@/components/auth-button";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((m) => m.MapView),
  { ssr: false }
);

export default function JoinPage() {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Full-screen map */}
      <MapView
        venues={MOCK_VENUES}
        selectedVenue={selectedVenue}
        onVenueSelect={setSelectedVenue}
      />

      {/* Header overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
        <header className="pointer-events-auto flex items-center justify-between px-4 pt-[max(16px,env(safe-area-inset-top))] pb-2 sm:px-6">
          <div
            className="flex items-center rounded-2xl px-3 py-1.5"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(20px) saturate(1.5)",
              WebkitBackdropFilter: "blur(20px) saturate(1.5)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <Image
              src="/logo.png"
              alt="theKickBack"
              width={120}
              height={40}
              className="h-7 w-auto brightness-200"
              priority
            />
          </div>
          <AuthButton />
        </header>
      </div>

      {/* Chat drawer */}
      <AnimatePresence>
        {selectedVenue && (
          <VenueDrawer
            key={selectedVenue.id}
            venue={selectedVenue}
            onClose={() => setSelectedVenue(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
