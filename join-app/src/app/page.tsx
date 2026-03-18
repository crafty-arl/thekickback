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
          <Image
            src="/logo.png"
            alt="theKickBack"
            width={140}
            height={46}
            className="h-8 w-auto drop-shadow-lg"
            priority
          />
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
