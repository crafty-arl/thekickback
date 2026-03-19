"use client";

import { Player } from "@remotion/player";
import { type ComponentType, useState, useEffect, useRef, useCallback } from "react";

interface PlayerWrapperProps {
  component: ComponentType;
  durationInFrames: number;
  fps?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PlayerWrapper({
  component,
  durationInFrames,
  fps = 30,
  className,
  style,
}: PlayerWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setSize({ w: Math.round(width), h: Math.round(height) });
    }
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
    >
      {size && (
        <Player
          component={component}
          compositionWidth={size.w}
          compositionHeight={size.h}
          durationInFrames={durationInFrames}
          fps={fps}
          autoPlay
          loop
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
