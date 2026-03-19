"use client";

import { Player } from "@remotion/player";
import type { ComponentType } from "react";

interface PlayerWrapperProps {
  component: ComponentType;
  durationInFrames: number;
  width: number;
  height: number;
  fps?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PlayerWrapper({
  component,
  durationInFrames,
  width,
  height,
  fps = 30,
  className,
  style,
}: PlayerWrapperProps) {
  return (
    <Player
      component={component}
      compositionWidth={width}
      compositionHeight={height}
      durationInFrames={durationInFrames}
      fps={fps}
      autoPlay
      loop
      style={{
        width: "100%",
        borderRadius: 24,
        overflow: "hidden",
        ...style,
      }}
      className={className}
    />
  );
}
