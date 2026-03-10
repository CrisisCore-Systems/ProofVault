import type { IntegrityVerificationResult } from "../../../features/evidence/integrity";

export function formatSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const kib = sizeBytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  const mib = kib / 1024;
  return `${mib.toFixed(1)} MB`;
}

export function hashSnippet(hash?: string): string {
  if (!hash) {
    return "-";
  }

  if (hash.length <= 24) {
    return hash;
  }

  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

export function integrityStatusStyle(status: IntegrityVerificationResult["status"]): string {
  if (status === "verified") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  }

  if (status === "mismatch") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  }

  return "border-zinc-700 bg-zinc-900 text-zinc-300";
}

export function integrityStatusLabel(status: IntegrityVerificationResult["status"]): string {
  if (status === "verified") {
    return "✔ Verified";
  }

  if (status === "mismatch") {
    return "⚠ Hash mismatch";
  }

  return "Unverifiable";
}