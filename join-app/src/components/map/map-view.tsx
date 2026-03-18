"use client";

import { useRef, useCallback } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import { MAP_CENTER, MAP_DEFAULT_ZOOM, type Venue } from "@/lib/venues";
import { VenueMarker } from "./venue-marker";

interface MapViewProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onVenueSelect: (venue: Venue | null) => void;
}

export function MapView({ venues, selectedVenue, onVenueSelect }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  const handleMarkerClick = useCallback(
    (venue: Venue) => {
      onVenueSelect(venue);
      mapRef.current?.flyTo({
        center: [venue.longitude, venue.latitude],
        zoom: 15,
        duration: 800,
      });
    },
    [onVenueSelect]
  );

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: MAP_CENTER.longitude,
        latitude: MAP_CENTER.latitude,
        zoom: MAP_DEFAULT_ZOOM,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      onClick={() => onVenueSelect(null)}
    >
      {venues.map((venue) => (
        <Marker
          key={venue.id}
          longitude={venue.longitude}
          latitude={venue.latitude}
          anchor="center"
        >
          <VenueMarker
            venue={venue}
            selected={selectedVenue?.id === venue.id}
            onClick={() => handleMarkerClick(venue)}
          />
        </Marker>
      ))}
    </Map>
  );
}
