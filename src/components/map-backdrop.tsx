"use client";

import {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoiY3JhZmZ0eWFybCIsImEiOiJjbW00bndseTIwZWNuMnFwdzF4Nm9oa2R5In0.IZmVHl0HZsz2fucPLUmfMQ";

const ACCENT = "#f97316";

const VIBES: Record<string, string> = {
  quiet: "#4ade80",
  moderate: "#facc15",
  busy: "#f97316",
  lit: "#f87171",
};

// Default center (Austin, TX) — overridden by geolocation
const DEFAULT_CENTER: [number, number] = [-97.743, 30.273];
const DEFAULT_ZOOM = 13;

interface VenueDot {
  id: string;
  name: string;
  vibe: string;
  lat: number;
  lng: number;
}

export interface MapHandle {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  reset: () => void;
}

export const MapBackdrop = forwardRef<MapHandle, object>(function MapBackdrop(
  _props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mounted, setMounted] = useState(false);
  const centerRef = useRef<[number, number]>(DEFAULT_CENTER);

  useImperativeHandle(ref, () => ({
    flyTo(lng: number, lat: number, zoom = 15.5) {
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom,
        pitch: 60,
        bearing: -20 + Math.random() * 20,
        duration: 2000,
        essential: true,
      });
    },
    reset() {
      mapRef.current?.flyTo({
        center: centerRef.current,
        zoom: DEFAULT_ZOOM,
        pitch: 55,
        bearing: -20,
        duration: 2000,
        essential: true,
      });
    },
  }));

  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Fetch real venues from API ---
  useEffect(() => {
    if (!mounted || !mapRef.current) return;
    const map = mapRef.current;

    fetch("/api/venues")
      .then((r) => r.json())
      .then((data: { venues: VenueDot[] }) => {
        if (!data.venues || data.venues.length === 0) return;

        // Clear old markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        data.venues.forEach((v) => {
          const color = VIBES[v.vibe] || ACCENT;
          const el = document.createElement("div");
          el.innerHTML = `
            <div style="position:relative;width:22px;height:22px;cursor:pointer;" title="${v.name}">
              <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 2.5s ease-out infinite;animation-delay:${Math.random() * 2}s;"></div>
              <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}60;border:2px solid #fff;"></div>
            </div>
          `;

          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([v.lng, v.lat])
            .addTo(map);
          markersRef.current.push(marker);
        });

        // Fit map to venue bounds if we have venues and haven't geolocated
        if (data.venues.length > 1) {
          const lngs = data.venues.map((v) => v.lng);
          const lats = data.venues.map((v) => v.lat);
          const bounds = new mapboxgl.LngLatBounds(
            [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02],
            [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02]
          );
          map.fitBounds(bounds, { padding: 60, pitch: 55, bearing: -20, duration: 1500 });
        }
      })
      .catch(() => {
        // Silently fail — map stays empty
      });
  }, [mounted, mapRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Init map + geolocation ---
  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    // Try geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          centerRef.current = [pos.coords.longitude, pos.coords.latitude];
          mapRef.current?.flyTo({
            center: centerRef.current,
            zoom: DEFAULT_ZOOM,
            pitch: 55,
            bearing: -20,
            duration: 1500,
          });
        },
        () => {
          // Permission denied or error — keep default center
        },
        { timeout: 5000, maximumAge: 600000 }
      );
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 55,
      bearing: -20,
      interactive: true,
      attributionControl: false,
      fadeDuration: 0,
      antialias: true,
    });

    mapRef.current = map;

    map.on("load", () => {
      // 3D buildings
      const layers = map.getStyle()?.layers;
      const labelLayerId = layers?.find(
        (l) => l.type === "symbol" && l.layout?.["text-field"]
      )?.id;

      map.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 12,
          paint: {
            "fill-extrusion-color": "#e8e8e8",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12, 0,
              14, ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              12, 0,
              14, ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.65,
          },
        },
        labelLayerId
      );

      // Gentle drift
      let frame = 0;
      let active = true;
      function drift() {
        if (!active) return;
        frame++;
        const t = frame * 0.00015;
        map.setBearing(-20 + Math.sin(t) * 4);
        requestAnimationFrame(drift);
      }
      drift();
      map.once("remove", () => { active = false; });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <style>{`@keyframes ping{0%{transform:scale(1);opacity:.25}75%{transform:scale(2.5);opacity:0}100%{transform:scale(2.5);opacity:0}}`}</style>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, borderRadius: "inherit" }} />
    </>
  );
});
