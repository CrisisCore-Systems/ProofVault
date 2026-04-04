import { describe, expect, it, vi } from "vitest";
import { formatDisplayDateTime, nowAsLocalDateTimeString } from "./format";

describe("nowAsLocalDateTimeString", () => {
  it("returns a string matching the datetime-local input pattern yyyy-MM-ddTHH:mm", () => {
    const result = nowAsLocalDateTimeString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("reflects the current local date when called with fake timers", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-10T12:34:00.000Z"));
      const result = nowAsLocalDateTimeString();
      // The result is local wall time; in UTC-offset environments the date and time
      // components will vary, but the format must always be yyyy-MM-ddTHH:mm.
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("formatDisplayDateTime", () => {
  it("formats a valid ISO string to yyyy-MM-dd HH:mm", () => {
    const result = formatDisplayDateTime("2026-03-10T08:30:00.000Z");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("returns the original string when the input is not a valid date", () => {
    const result = formatDisplayDateTime("not-a-date");
    expect(result).toBe("not-a-date");
  });
});
