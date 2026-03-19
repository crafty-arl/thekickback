"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/* ── Venue orbs floating in 3D space ── */
function VenueOrbs() {
  const ref = useRef<THREE.Group>(null);
  const orbs = useMemo(() => {
    const colors = ["#f97316", "#4ade80", "#facc15", "#f87171", "#a78bfa"];
    return Array.from({ length: 40 }, (_, i) => ({
      position: [
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 40 - 10,
      ] as [number, number, number],
      color: colors[i % colors.length],
      size: Math.random() * 0.15 + 0.05,
      speed: Math.random() * 0.3 + 0.1,
      phase: Math.random() * Math.PI * 2,
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
  const clouds = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        position: [
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 40,
          -20 - Math.random() * 20,
        ] as [number, number, number],
        scale: Math.random() * 8 + 4,
        color: ["#f97316", "#a78bfa", "#4ade80", "#f87171"][i % 4],
        rotation: Math.random() * Math.PI,
      })),
    []
  );

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
    ref.current.rotation.y = t * 0.008;
    ref.current.rotation.x = Math.sin(t * 0.005) * 0.02;
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
