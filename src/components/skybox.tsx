"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/* ── Seeded pseudo-random (avoids Math.random in render) ── */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ── Venue orbs floating in 3D space ── */
function VenueOrbs() {
  const ref = useRef<THREE.Group>(null);
  const orbs = useMemo(() => {
    const rng = seededRandom(42);
    const colors = ["#f97316", "#4ade80", "#facc15", "#f87171", "#a78bfa"];
    return Array.from({ length: 40 }, (_, i) => ({
      position: [
        (rng() - 0.5) * 60,
        (rng() - 0.5) * 60,
        (rng() - 0.5) * 40 - 10,
      ] as [number, number, number],
      color: colors[i % colors.length],
      size: rng() * 0.15 + 0.05,
      speed: rng() * 0.3 + 0.1,
      phase: rng() * Math.PI * 2,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((child, i) => {
      const orb = orbs[i];
      child.position.y += Math.sin(t * orb.speed + orb.phase) * 0.002;
      const s = 1 + Math.sin(t * orb.speed * 2 + orb.phase) * 0.3;
      child.scale.setScalar(s);
    });
  });

  return (
    <group ref={ref}>
      {orbs.map((orb, i) => (
        <group key={i} position={orb.position}>
          {/* Glow */}
          <mesh>
            <sphereGeometry args={[orb.size * 3, 16, 16]} />
            <meshBasicMaterial color={orb.color} transparent opacity={0.04} />
          </mesh>
          {/* Ring */}
          <mesh>
            <ringGeometry args={[orb.size * 1.5, orb.size * 1.8, 32]} />
            <meshBasicMaterial
              color={orb.color}
              transparent
              opacity={0.08}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Core */}
          <mesh>
            <sphereGeometry args={[orb.size, 16, 16]} />
            <meshBasicMaterial color={orb.color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Nebula clouds ── */
function NebulaClouds() {
  const ref = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 8 }, (_, i) => ({
      position: [
        (rng() - 0.5) * 50,
        (rng() - 0.5) * 40,
        -20 - rng() * 20,
      ] as [number, number, number],
      scale: rng() * 8 + 4,
      color: ["#f97316", "#a78bfa", "#4ade80", "#f87171"][i % 4],
      rotation: rng() * Math.PI,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((child, i) => {
      child.rotation.z = clouds[i].rotation + t * 0.01;
    });
  });

  return (
    <group ref={ref}>
      {clouds.map((cloud, i) => (
        <mesh key={i} position={cloud.position}>
          <planeGeometry args={[cloud.scale, cloud.scale]} />
          <meshBasicMaterial
            color={cloud.color}
            transparent
            opacity={0.015}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Grid floor ── */
function GridFloor() {
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -15, -10]}>
      <gridHelper
        args={[100, 40, "rgba(255,255,255,0.03)", "rgba(255,255,255,0.02)"]}
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
  const camRef = useRef(camera);
  camRef.current = camera;

  useEffect(() => {
    function onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      targetRef.current = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame(() => {
    // Smooth lerp toward target
    scrollRef.current += (targetRef.current - scrollRef.current) * 0.05;
    const t = scrollRef.current;

    // Camera drifts through space as user scrolls
    const c = camRef.current;
    c.position.y = 2 - t * 8;
    c.position.z = 20 - t * 15;
    c.rotation.x = -t * 0.15;
  });

  return null;
}

/* ── Slow ambient rotation ── */
function AmbientRotation({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 0.008;
    ref.current.rotation.x = Math.sin(t * 0.005) * 0.02;
  });

  return <group ref={ref}>{children}</group>;
}

/* ── Main Skybox Component ── */
export function Skybox() {
  const mountedRef = useRef(false);
  const [, forceRender] = useState(0);

  if (!mountedRef.current) {
    // Schedule a re-render after mount (via microtask to avoid sync setState in effect)
    if (typeof window !== "undefined") {
      Promise.resolve().then(() => {
        mountedRef.current = true;
        forceRender((n) => n + 1);
      });
    }
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-0"
      style={{ pointerEvents: "none" }}
    >
      <Canvas
        camera={{ position: [0, 2, 20], fov: 60, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.5]}
        style={{ background: "#000" }}
      >
        <fog attach="fog" args={["#000", 30, 80]} />

        <ScrollCamera />

        <AmbientRotation>
          <Stars
            radius={60}
            depth={50}
            count={3000}
            factor={3}
            saturation={0}
            fade
            speed={0.5}
          />

          <VenueOrbs />
          <NebulaClouds />
          <GridFloor />
        </AmbientRotation>

        {/* Subtle ambient light */}
        <ambientLight intensity={0.1} />
      </Canvas>
    </div>
  );
}
