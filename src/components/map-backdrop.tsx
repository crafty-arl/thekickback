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
  "pk.eyJ1IjoiY3JhZmZ0eWFybCIsImEiOiJjbW00bndseTIwZWNuMnFwdzF4Nm9oa2R5In0.IZmVHl0HZsz2fucPLUmfMQ";

const ACCENT = "#f97316";

const VIBES: Record<string, string> = {
  quiet: "#4ade80",
  moderate: "#facc15",
  busy: "#f97316",
  lit: "#f87171",
};

// 30+ venue pins scattered around Austin
const VENUES = [
  { lng: -97.7431, lat: 30.2672, name: "Metro Barbershop", vibe: "busy" },
  { lng: -97.7407, lat: 30.274, name: "Thursday Night League", vibe: "lit" },
  { lng: -97.7341, lat: 30.2849, name: "Mai's Nails", vibe: "moderate" },
  { lng: -97.742, lat: 30.295, name: "Community Arts Center", vibe: "busy" },
  { lng: -97.726, lat: 30.2615, name: "Ink & Iron Tattoo", vibe: "moderate" },
  { lng: -97.748, lat: 30.2555, name: "Amir's Tea House", vibe: "quiet" },
  { lng: -97.7505, lat: 30.2695, name: "Precision Tailoring", vibe: "quiet" },
  { lng: -97.738, lat: 30.278, name: "The Commons", vibe: "moderate" },
  // — additional venues to fill the map —
  { lng: -97.752, lat: 30.261, name: "Golden Hour Rooftop", vibe: "lit" },
  { lng: -97.729, lat: 30.268, name: "The Den", vibe: "busy" },
  { lng: -97.735, lat: 30.272, name: "Daily Grind", vibe: "moderate" },
  { lng: -97.727, lat: 30.28, name: "Eastside Barbers", vibe: "quiet" },
  { lng: -97.746, lat: 30.263, name: "South Lamar Studio", vibe: "moderate" },
  { lng: -97.731, lat: 30.265, name: "Bouldin Creek Café", vibe: "quiet" },
  { lng: -97.74, lat: 30.286, name: "North Loop Records", vibe: "lit" },
  { lng: -97.753, lat: 30.275, name: "Clarksville Kitchen", vibe: "busy" },
  { lng: -97.736, lat: 30.258, name: "St. Elmo Brewing", vibe: "lit" },
  { lng: -97.744, lat: 30.291, name: "Hyde Park Yoga", vibe: "quiet" },
  { lng: -97.721, lat: 30.271, name: "East 6th Tattoo", vibe: "busy" },
  { lng: -97.733, lat: 30.294, name: "Speedway Barber", vibe: "moderate" },
  { lng: -97.749, lat: 30.282, name: "Pecan Press Coffee", vibe: "quiet" },
  { lng: -97.73, lat: 30.259, name: "South First Salon", vibe: "moderate" },
  { lng: -97.738, lat: 30.299, name: "Campus Cuts", vibe: "busy" },
  { lng: -97.718, lat: 30.263, name: "Holly St. Flowers", vibe: "quiet" },
  { lng: -97.755, lat: 30.268, name: "Zilker Juice", vibe: "moderate" },
  { lng: -97.725, lat: 30.289, name: "Mueller Fit", vibe: "busy" },
  { lng: -97.741, lat: 30.256, name: "Oltorf Nails", vibe: "moderate" },
  { lng: -97.747, lat: 30.297, name: "Rosedale Bakery", vibe: "quiet" },
  { lng: -97.722, lat: 30.276, name: "Govalle Studios", vibe: "lit" },
  { lng: -97.734, lat: 30.253, name: "Ben White Auto Detail", vibe: "moderate" },
  { lng: -97.728, lat: 30.282, name: "Cherrywood Coffee", vibe: "quiet" },
  { lng: -97.751, lat: 30.289, name: "Bryker Wellness", vibe: "quiet" },
  { lng: -97.719, lat: 30.257, name: "Riverside Braids", vibe: "busy" },
  { lng: -97.745, lat: 30.252, name: "The Grotto Spa", vibe: "moderate" },
];

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
  const [mounted, setMounted] = useState(false);

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
        center: [-97.743, 30.273],
        zoom: 13,
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

  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-97.743, 30.273],
      zoom: 13,
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

      // Venue markers
      VENUES.forEach((v) => {
        const color = VIBES[v.vibe] || ACCENT;
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="position:relative;width:22px;height:22px;cursor:pointer;" title="${v.name}">
            <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 2.5s ease-out infinite;animation-delay:${Math.random() * 2}s;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}60;border:2px solid #fff;"></div>
          </div>
        `;

        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([v.lng, v.lat])
          .addTo(map);
      });

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
