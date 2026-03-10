import { describe, expect, it } from "vitest";
import { buildRegionFromPoints, clampPercentage, roundPercentage } from "./redactionGeometry";

describe("redactionGeometry", () => {
  it("clamps values to the 0-100 range", () => {
    expect(clampPercentage(-5)).toBe(0);
    expect(clampPercentage(45.5)).toBe(45.5);
    expect(clampPercentage(120)).toBe(100);
  });

  it("rounds clamped values to three decimals", () => {
    expect(roundPercentage(12.34567)).toBe(12.346);
    expect(roundPercentage(100.444)).toBe(100);
  });

  it("builds normalized regions regardless of drag direction", () => {
    expect(buildRegionFromPoints(80.1234, 70.9876, 20.2222, 10.1111)).toEqual({
      x: 20.222,
      y: 10.111,
      width: 59.901,
      height: 60.877,
    });
  });
});