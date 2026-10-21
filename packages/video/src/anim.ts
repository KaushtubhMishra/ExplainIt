import { spring, interpolate } from "remotion";

// 0 -> 1 as an element appears at `at` (frames, relative to the scene).
export const appear = (frame: number, at: number, fps = 30) =>
  spring({ frame: frame - at, fps, config: { damping: 200, stiffness: 120 } });

export const fadeUp = (p: number, distance = 40): React.CSSProperties => ({
  opacity: p,
  transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
});

export const slideIn = (p: number, distance = 80): React.CSSProperties => ({
  opacity: p,
  transform: `translateX(${interpolate(p, [0, 1], [-distance, 0])}px)`,
});

export const popIn = (p: number): React.CSSProperties => ({
  opacity: Math.min(1, p * 1.5),
  transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`,
});

// Gentle continuous motion so nothing on screen is ever completely still.
export const bob = (frame: number, amount = 10, speed = 18) => Math.sin(frame / speed) * amount;
export const pulse = (frame: number, amount = 0.035, speed = 14) => 1 + Math.sin(frame / speed) * amount;
