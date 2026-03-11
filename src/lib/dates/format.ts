import { format } from "date-fns";

export function formatDisplayDateTime(isoDateTime: string): string {
  const parsedDate = new Date(isoDateTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDateTime;
  }

  return format(parsedDate, "yyyy-MM-dd HH:mm");
}

/**
 * Returns the current local date-time as a "YYYY-MM-DDTHH:mm" string, safe
 * across DST transitions.  date-fns `format(new Date(), …)` relies on
 * `Date#getHours` / `getMinutes` which are correct but coupling the default
 * value generation to a library import adds unnecessary fragility.  The
 * native approach below derives local time by subtracting the current UTC
 * offset (which already reflects DST) from the UTC epoch value and then
 * taking the first 16 characters of the resulting ISO-8601 string.
 */
export function nowAsLocalDateTimeString(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
