"use client";

import { useRef, useCallback, useEffect } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import { MOCK_VENUES, type Venue } from "@/lib/venues";
import { VenueMarker } from "./venue-marker";

interface MapViewProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onVenueSelect: (venue: Venue | null) => void;
}

function getBounds(venues: Venue[]) {
  const lngs = venues.map((v) => v.longitude);
  const lats = venues.map((v) => v.latitude);
  return {
    sw: [Math.min(...lngs), Math.min(...lats)] as [number, number],
    ne: [Math.max(...lngs), Math.max(...lats)] as [number, number],
  };
}

// Desaturate all map paint colors to grayscale
function desaturateMap(map: mapboxgl.Map) {
  const style = map.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const id = layer.id;
    const type = layer.type;

    try {
      if (type === "background") {
        map.setPaintProperty(id, "background-color", "#f0f0f0");
      } else if (type === "fill") {
        map.setPaintProperty(id, "fill-color", [
          "interpolate", ["linear"],
          ["zoom"],
          0, "#e8e8e8",
          22, "#e8e8e8",
        ]);
        map.setPaintProperty(id, "fill-opacity", 0.6);
      } else if (type === "line") {
        map.setPaintProperty(id, "line-color", "#cccccc");
        map.setPaintProperty(id, "line-opacity", 0.5);
      } else if (type === "symbol") {
        map.setPaintProperty(id, "text-color", "#999999");
        map.setPaintProperty(id, "text-halo-color", "#f5f5f5");
      }
    } catch {
      // Some layers may not support these properties
    }
  }

  // Water layers need special treatment
  for (const layer of style.layers) {
    if (layer.id.includes("water")) {
      try {
        if (layer.type === "fill") {
          map.setPaintProperty(layer.id, "fill-color", "#e0e0e0");
          map.setPaintProperty(layer.id, "fill-opacity", 1);
        }
      } catch {
        // skip
      }
    }
  }

  // Roads — slightly darker for structure
  for (const layer of style.layers) {
    if (layer.id.includes("road") && layer.type === "line") {
      try {
        map.setPaintProperty(layer.id, "line-color", "#c0c0c0");
        map.setPaintProperty(layer.id, "line-opacity", 0.7);
      } catch {
        // skip
      }
    }
  }
}

export function MapView({ venues, selectedVenue, onVenueSelect }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || !mapRef.current) return;
    const allVenues = MOCK_VENUES;
    if (allVenues.length < 2) return;

    const { sw, ne } = getBounds(allVenues);
    mapRef.current.fitBounds([sw, ne], {
      padding: { top: 100, bottom: 80, left: 40, right: 40 },
      duration: 0,
    });
    fittedRef.current = true;
  }, []);

  const handleMarkerClick = useCallback(
    (venue: Venue) => {
      onVenueSelect(venue);
      mapRef.current?.flyTo({
        center: [venue.longitude, venue.latitude],
        zoom: 15.5,
        pitch: 50,
        duration: 800,
      });
    },
    [onVenueSelect]
  );

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Fit bounds
    const allVenues = MOCK_VENUES;
    if (allVenues.length >= 2) {
      const { sw, ne } = getBounds(allVenues);
      map.fitBounds([sw, ne], {
        padding: { top: 100, bottom: 80, left: 40, right: 40 },
        duration: 0,
      });
      fittedRef.current = true;
    }

    // Desaturate the map to pure grayscale
    desaturateMap(map);

    // 3D buildings in neutral gray
    const layers = map.getStyle().layers;
    let labelLayerId: string | undefined;
    if (layers) {
      for (const layer of layers) {
        if (layer.type === "symbol" && (layer.layout as Record<string, unknown>)?.["text-field"]) {
          labelLayerId = layer.id;
          break;
        }
      }
    }

    if (!map.getLayer("3d-buildings")) {
      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          paint: {
            "fill-extrusion-color": "#d0d0d0",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": 0.4,
          },
        },
        labelLayerId
      );
    }
  }, []);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: -97.743,
        latitude: 30.267,
        zoom: 13,
        pitch: 40,
        bearing: -10,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      onClick={() => onVenueSelect(null)}
      onLoad={handleLoad}
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
