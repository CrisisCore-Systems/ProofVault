import { format } from "date-fns";

export function formatDisplayDateTime(isoDateTime: string): string {
  const parsedDate = new Date(isoDateTime);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDateTime;
  }

  return format(parsedDate, "yyyy-MM-dd HH:mm");
}
