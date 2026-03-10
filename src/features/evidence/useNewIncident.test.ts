import { describe, expect, it, vi } from "vitest";
import { defaultIncidentFormValues } from "./incidentForm";

describe("useNewIncident helpers", () => {
  it("creates default incident values with empty optional fields", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-10T12:34:00.000Z"));

      const values = defaultIncidentFormValues();

      expect(values.title).toBe("");
      expect(values.occurredAt).toBe("");
      expect(values.locationText).toBe("");
      expect(values.peopleInvolved).toBe("");
      expect(values.tags).toBe("");
      expect(values.urgency).toBe(false);
      expect(values.recordedAt).toMatch(/^2026-03-10T/);
    } finally {
      vi.useRealTimers();
    }
  });
});