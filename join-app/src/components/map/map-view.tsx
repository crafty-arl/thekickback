"use client";

import { useRef, useCallback, useEffect } from "react";
import Map, { Marker, Source, Layer, type MapRef } from "react-map-gl";
import { type Venue } from "@/lib/venues";
import { VenueMarker } from "./venue-marker";

export interface RouteData {
  geometry: GeoJSON.LineString;
  color: string;
}

export interface MapViewProps {
  venues: Venue[];
  selectedVenue: Venue | null;
  onVenueSelect: (venue: Venue | null) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  mapRef?: React.RefObject<MapRef | null>;
  route?: RouteData | null;
}

function getBounds(venues: Venue[]) {
  const mapped = venues.filter((v) => v.latitude !== 0 && v.longitude !== 0);
  if (mapped.length === 0) return { sw: [-87.92, 43.02] as [number, number], ne: [-87.89, 43.06] as [number, number] };
  const lngs = mapped.map((v) => v.longitude);
  const lats = mapped.map((v) => v.latitude);
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

export function MapView({ venues, selectedVenue, onVenueSelect, userLocation, mapRef: externalMapRef, route }: MapViewProps) {
  const internalMapRef = useRef<MapRef>(null);
  const mapRef = externalMapRef || internalMapRef;
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current || !mapRef.current) return;
    if (venues.length < 2) return;

    const { sw, ne } = getBounds(venues);
    mapRef.current.fitBounds([sw, ne], {
      padding: { top: 100, bottom: 80, left: 40, right: 40 },
      duration: 0,
    });
    fittedRef.current = true;
  }, [venues]);

  // Re-fit when user location is obtained and venues update
  useEffect(() => {
    if (!userLocation || !mapRef.current || venues.length < 2) return;
    const { sw, ne } = getBounds(venues);
    mapRef.current.fitBounds([sw, ne], {
      padding: { top: 100, bottom: 80, left: 40, right: 40 },
      duration: 1200,
    });
  }, [userLocation, venues]);

  // Fly to venue when selectedVenue changes (e.g. from arrow nav)
  useEffect(() => {
    if (!selectedVenue || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [selectedVenue.longitude, selectedVenue.latitude],
      zoom: 15.5,
      pitch: 50,
      duration: 800,
    });
  }, [selectedVenue]);

  const handleMarkerClick = useCallback(
    (venue: Venue) => {
      // Event pins: select the parent venue so the dock shows the hub's chat
      if (venue.isEventPin && venue.parentVenueId) {
        const parent = venues.find((v) => v.id === venue.parentVenueId);
        if (parent) {
          onVenueSelect(parent);
          mapRef.current?.flyTo({
            center: [venue.longitude, venue.latitude],
            zoom: 15.5,
            pitch: 50,
            duration: 800,
          });
          return;
        }
      }
      onVenueSelect(venue);
      // Don't fly to virtual places (no real coordinates)
      if (venue.latitude !== 0 && venue.longitude !== 0) {
        mapRef.current?.flyTo({
          center: [venue.longitude, venue.latitude],
          zoom: 15.5,
          pitch: 50,
          duration: 800,
        });
      }
    },
    [onVenueSelect, venues]
  );

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Fit bounds
    if (venues.length >= 2) {
      const { sw, ne } = getBounds(venues);
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
  }, [venues]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: userLocation?.longitude ?? (venues.length > 0 ? venues.reduce((s, v) => s + v.longitude, 0) / venues.length : -87.9065),
        latitude: userLocation?.latitude ?? (venues.length > 0 ? venues.reduce((s, v) => s + v.latitude, 0) / venues.length : 43.0389),
        zoom: 12,
        pitch: 40,
        bearing: -10,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      onClick={() => onVenueSelect(null)}
      onLoad={handleLoad}
      attributionControl={false}
      logoPosition="bottom-right"
    >
      {venues.filter((v) => v.latitude !== 0 && v.longitude !== 0).map((venue) => (
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

      {/* Navigation route line */}
      {route && (
        <Source
          id="nav-route"
          type="geojson"
          data={{ type: "Feature", geometry: route.geometry, properties: {} }}
        >
          <Layer
            id="nav-route-bg"
            type="line"
            paint={{ "line-color": "#000", "line-width": 6, "line-opacity": 0.15 }}
            layout={{ "line-join": "round", "line-cap": "round" }}
          />
          <Layer
            id="nav-route-line"
            type="line"
            paint={{
              "line-color": route.color,
              "line-width": 4,
              "line-opacity": 0.85,
              "line-dasharray": [0, 2],
            }}
            layout={{ "line-join": "round", "line-cap": "round" }}
          />
        </Source>
      )}

      {/* User location dot */}
      {userLocation && (
        <Marker
          longitude={userLocation.longitude}
          latitude={userLocation.latitude}
          anchor="center"
        >
          <div className="relative flex items-center justify-center" style={{ width: 24, height: 24 }}>
            <div
              className="absolute rounded-full animate-ping"
              style={{ width: 24, height: 24, backgroundColor: "rgba(59, 130, 246, 0.3)" }}
            />
            <div
              className="rounded-full border-2 border-white"
              style={{ width: 12, height: 12, backgroundColor: "#3b82f6", boxShadow: "0 0 8px rgba(59,130,246,0.5)" }}
            />
          </div>
        </Marker>
      )}
    </Map>
  );
}
