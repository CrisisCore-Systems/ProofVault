import type { RedactionRegion } from "../../../domain/types";

export function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function roundPercentage(value: number): number {
  return Math.round(clampPercentage(value) * 1000) / 1000;
}

export function buildRegionFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Omit<RedactionRegion, "id"> {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  return {
    x: roundPercentage(x),
    y: roundPercentage(y),
    width: roundPercentage(width),
    height: roundPercentage(height),
  };
}