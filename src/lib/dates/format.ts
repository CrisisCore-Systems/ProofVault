type DisplayDateTimeMode = "local" | "utc";

let displayDateTimeMode: DisplayDateTimeMode = "local";

function padDatePart(value: number): string {
  return value.toString().padStart(2, "0");
}

export function setDisplayDateTimeMode(mode: DisplayDateTimeMode): void {
  displayDateTimeMode = mode;
}

export function formatDisplayDateTime(isoDateTime: string): string {
  const parsedDate = new Date(isoDateTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDateTime;
  }

  const year = displayDateTimeMode === "utc" ? parsedDate.getUTCFullYear() : parsedDate.getFullYear();
  const month = displayDateTimeMode === "utc" ? parsedDate.getUTCMonth() + 1 : parsedDate.getMonth() + 1;
  const day = displayDateTimeMode === "utc" ? parsedDate.getUTCDate() : parsedDate.getDate();
  const hours = displayDateTimeMode === "utc" ? parsedDate.getUTCHours() : parsedDate.getHours();
  const minutes = displayDateTimeMode === "utc" ? parsedDate.getUTCMinutes() : parsedDate.getMinutes();

  return `${year}-${padDatePart(month)}-${padDatePart(day)} ${padDatePart(hours)}:${padDatePart(minutes)}`;
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

export function nowAsLocalDateTimeString(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm");
}
