function normalizeFingerprint(value: string): string {
  return value.trim().toUpperCase();
}

export function shortFingerprint(value: string, groupSize = 4, maxGroups = 4): string {
  const normalized = normalizeFingerprint(value).replaceAll(/[^A-F0-9]/g, "");

  if (normalized.length === 0) {
    return "UNAVAILABLE";
  }

  const sliced = normalized.slice(0, groupSize * maxGroups);
  const groups: string[] = [];

  for (let index = 0; index < sliced.length; index += groupSize) {
    groups.push(sliced.slice(index, index + groupSize));
  }

  return groups.join("-");
}

export function buildCrossCheckFingerprint(manifestSeal: string, reportSha256: string): string {
  return `${shortFingerprint(manifestSeal)} / ${shortFingerprint(reportSha256)}`;
}