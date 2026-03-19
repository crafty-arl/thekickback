"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN = "pk.eyJ1IjoiY3JhZmZ0eWFybCIsImEiOiJjbW00bndseTIwZWNuMnFwdzF4Nm9oa2R5In0.IZmVHl0HZsz2fucPLUmfMQ";

// Venue pins that pulse on the map
const VENUES = [
  { lng: -97.7431, lat: 30.2672, color: "#f97316", name: "The Rooftop" },
  { lng: -97.7407, lat: 30.2740, color: "#4ade80", name: "Daily Grind" },
  { lng: -97.7341, lat: 30.2849, color: "#facc15", name: "Study Loft" },
  { lng: -97.7420, lat: 30.2950, color: "#f87171", name: "North House" },
  { lng: -97.7260, lat: 30.2615, color: "#a78bfa", name: "Late Shift" },
  { lng: -97.7480, lat: 30.2555, color: "#f97316", name: "Golden Hour" },
  { lng: -97.7505, lat: 30.2695, color: "#4ade80", name: "The Den" },
  { lng: -97.7380, lat: 30.2780, color: "#facc15", name: "The Commons" },
];

export function MapBackdrop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-97.743, 30.267],
      zoom: 12.5,
      pitch: 45,
      bearing: -15,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    map.on("load", () => {
      // Desaturate the map
      const style = map.getStyle();
      if (style?.layers) {
        for (const layer of style.layers) {
          try {
            if (layer.type === "background") {
              map.setPaintProperty(layer.id, "background-color", "#0a0a0a");
            } else if (layer.type === "fill") {
              map.setPaintProperty(layer.id, "fill-color", "#111");
              map.setPaintProperty(layer.id, "fill-opacity", 0.4);
            } else if (layer.type === "line") {
              map.setPaintProperty(layer.id, "line-color", "#1a1a1a");
              map.setPaintProperty(layer.id, "line-opacity", 0.3);
            } else if (layer.type === "symbol") {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          } catch {
            // Some layers can't be modified
          }
        }
      }

      // Add venue markers as pulsing dots
      VENUES.forEach((v) => {
        const el = document.createElement("div");
        el.innerHTML = `
          <div style="position:relative;width:20px;height:20px;">
            <div style="position:absolute;inset:0;border-radius:50%;background:${v.color};opacity:0.15;animation:ping 2s ease-out infinite;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:${v.color};box-shadow:0 0 8px ${v.color}80;"></div>
          </div>
        `;

        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([v.lng, v.lat])
          .addTo(map);
      });

      // Slow drift animation
      let frame = 0;
      function drift() {
        frame++;
        const t = frame * 0.0003;
        const bearing = -15 + Math.sin(t) * 8;
        const pitch = 45 + Math.sin(t * 0.7) * 5;
        map.setBearing(bearing);
        map.setPitch(pitch);
        requestAnimationFrame(drift);
      }
      drift();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mounted]);

  // Scroll-driven zoom
  useEffect(() => {
    if (!mounted) return;

    function onScroll() {
      if (!mapRef.current) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const t = maxScroll > 0 ? window.scrollY / maxScroll : 0;
      const zoom = 12.5 + t * 2;
      mapRef.current.setZoom(zoom);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.15; }
          75% { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
      <div
        ref={containerRef}
        className="fixed inset-0 z-0"
        style={{ opacity: 0.35, pointerEvents: "none" }}
      />
    </>
  );
}
