import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { EvidenceItem } from "../../domain/types";
import { listInboxEvidenceItems } from "../../db/queries";

export type InboxSavedType = "incident" | "attachment";

export function parseInboxSavedType(value: string | null): InboxSavedType | null {
  return value === "incident" || value === "attachment" ? value : null;
}

export function getInboxSavedFeedbackMessage(savedType: InboxSavedType | null): string | null {
  if (savedType === "attachment") {
    return "Attachment saved locally.";
  }

  if (savedType === "incident") {
    return "Incident saved locally.";
  }

  return null;
}

export function useInboxOverview() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const savedType = parseInboxSavedType(searchParams.get("saved"));
  const savedFeedbackMessage = getInboxSavedFeedbackMessage(savedType);

  const load = async () => {
    const data = await listInboxEvidenceItems();
    setItems(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const dismissSavedFeedback = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("saved");
    setSearchParams(next, { replace: true });
  };

  return {
    items,
    load,
    savedType,
    savedFeedbackMessage,
    dismissSavedFeedback,
  };
}