"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ── City lights: warm dots scattered like a city seen from above ── */
function CityLights() {
  const ref = useRef<THREE.Group>(null);
  const lights = useMemo(() => {
    const warm = ["#f97316", "#facc15", "#fbbf24", "#fb923c", "#fca5a1", "#fdba74"];
    const cool = ["#a78bfa", "#60a5fa"];
    const all = [...warm, ...warm, ...warm, ...cool]; // mostly warm
    return Array.from({ length: 80 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 40 - 5,
        (Math.random() - 0.5) * 50 - 15,
      ] as [number, number, number],
      color: all[i % all.length],
      size: Math.random() * 0.08 + 0.02,
      speed: Math.random() * 0.4 + 0.1,
      phase: Math.random() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((child, i) => {
      const light = lights[i];
      // Gentle flicker like distant city windows
      const flicker = 0.5 + Math.sin(t * light.speed * 3 + light.phase) * 0.5;
      child.scale.setScalar(0.6 + flicker * 0.8);
    });
  });

  return (
    <group ref={ref}>
      {lights.map((light, i) => (
        <group key={i} position={light.position}>
          {/* Soft glow */}
          <mesh>
            <sphereGeometry args={[light.size * 4, 8, 8]} />
            <meshBasicMaterial
              color={light.color}
              transparent
              opacity={0.03}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          {/* Core point */}
          <mesh>
            <sphereGeometry args={[light.size, 8, 8]} />
            <meshBasicMaterial color={light.color} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Warm ambient haze — like city glow on clouds ── */
function CityHaze() {
  const ref = useRef<THREE.Group>(null);
  const patches = useMemo(
    () =>
      Array.from({ length: 6 }, () => ({
        position: [
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 30 - 5,
          -25 - Math.random() * 15,
        ] as [number, number, number],
        scale: Math.random() * 12 + 6,
        color: ["#f97316", "#facc15", "#fbbf24"][Math.floor(Math.random() * 3)],
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((child, i) => {
      child.rotation.z = t * 0.005 + i;
    });
  });

  return (
    <group ref={ref}>
      {patches.map((patch, i) => (
        <mesh key={i} position={patch.position}>
          <planeGeometry args={[patch.scale, patch.scale]} />
          <meshBasicMaterial
            color={patch.color}
            transparent
            opacity={0.012}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Street grid floor ── */
function StreetGrid() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, -10]}>
      <gridHelper
        args={[100, 40, "rgba(249,115,22,0.03)", "rgba(255,255,255,0.015)"]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

/* ── Scroll-driven camera ── */
function ScrollCamera() {
  const { camera } = useThree();
  const scrollRef = useRef(0);
  const targetRef = useRef(0);

  useEffect(() => {
    function onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      targetRef.current = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame(() => {
    scrollRef.current += (targetRef.current - scrollRef.current) * 0.05;
    const t = scrollRef.current;
    camera.position.y = 2 - t * 8;
    camera.position.z = 20 - t * 15;
    camera.rotation.x = -t * 0.15;
  });

  return null;
}

/* ── Slow ambient rotation ── */
function AmbientRotation({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.006;
    ref.current.rotation.x = Math.sin(t * 0.004) * 0.015;
  });

  return <group ref={ref}>{children}</group>;
}

/* ── Main Skybox Component ── */
export function Skybox() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-0"
      style={{ pointerEvents: "none", opacity: 0.4 }}
    >
      <Canvas
        camera={{ position: [0, 2, 20], fov: 60, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.5]}
        style={{ background: "#0a0a0c" }}
      >
        {/* Warm fog — city atmosphere */}
        <fog attach="fog" args={["#0a0a0c", 25, 70]} />

        <ScrollCamera />

        <AmbientRotation>
          <CityLights />
          <CityHaze />
          <StreetGrid />
        </AmbientRotation>

        <ambientLight intensity={0.08} color="#f97316" />
      </Canvas>
    </div>
  );
}
