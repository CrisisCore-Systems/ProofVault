import { useEffect, useMemo, useState } from "react";
import {
  getAttachmentByEvidenceItemId,
  getCaseById,
  getEvidenceItemById,
  getLatestLedgerEntryForAttachment,
  listEvidenceItemsForCase,
  updateEvidenceControls,
  updateEvidenceRedactions,
} from "../../db/queries";
import type { EvidenceItem, LedgerEntry, RedactionRegion } from "../../domain/types";
import type { EvidenceDetailView } from "./evidenceDetailView";
import { appendLedgerEvent } from "../ledger/chain";
import { type IntegrityVerificationResult, verifyEvidenceIntegrity } from "./integrity";
import { bakeRedactedImage } from "../../lib/utils/redactionBake";

export async function fetchEvidenceDetailView(evidenceId: string): Promise<EvidenceDetailView | null> {
  const evidence = await getEvidenceItemById(evidenceId);
  if (!evidence) {
    return null;
  }

  const attachment = await getAttachmentByEvidenceItemId(evidence.id);
  const caseFile = evidence.caseId ? await getCaseById(evidence.caseId) : undefined;

  let linkedIncident: EvidenceItem | undefined;
  if (evidence.caseId) {
    const related = await listEvidenceItemsForCase(evidence.caseId);
    linkedIncident = related.find((item) => item.kind === "incident" && item.id !== evidence.id);
  }

  return { evidence, attachment, caseFile, linkedIncident };
}

export function deriveEvidenceDetailComputedState(
  view: EvidenceDetailView | null,
  redactions: RedactionRegion[],
  blobUrl: string | null,
  certificateImageUrl: string | null
) {
  const hasPendingRedactionChanges =
    JSON.stringify(redactions) !== JSON.stringify(view?.evidence.redactions ?? []);
  const hasSavedRedactions = (view?.evidence.redactions?.length ?? 0) > 0;
  const canGenerateDerivativeCertificate = Boolean(
    view?.attachment &&
      view.evidence.mimeType?.startsWith("image/") &&
      hasSavedRedactions
  );
  const effectiveCertificateImageUrl =
    certificateImageUrl ?? (view?.evidence.mimeType?.startsWith("image/") ? blobUrl : null);

  return {
    hasPendingRedactionChanges,
    hasSavedRedactions,
    canGenerateDerivativeCertificate,
    effectiveCertificateImageUrl,
  };
}

export function useEvidenceDetail(evidenceId?: string) {
  const [view, setView] = useState<EvidenceDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [includeInExport, setIncludeInExport] = useState(true);
  const [redacted, setRedacted] = useState(false);
  const [savingControls, setSavingControls] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [integrityResult, setIntegrityResult] = useState<IntegrityVerificationResult | null>(null);
  const [verifyingIntegrity, setVerifyingIntegrity] = useState(false);
  const [copyHashFeedback, setCopyHashFeedback] = useState<string | null>(null);
  const [ledgerEntry, setLedgerEntry] = useState<LedgerEntry | null>(null);
  const [redactions, setRedactions] = useState<RedactionRegion[]>([]);
  const [redactMode, setRedactMode] = useState(false);
  const [savingRedactions, setSavingRedactions] = useState(false);
  const [redactionFeedback, setRedactionFeedback] = useState<string | null>(null);
  const [preparingCertificate, setPreparingCertificate] = useState(false);
  const [certificateImageUrl, setCertificateImageUrl] = useState<string | null>(null);
  const [derivativeHash, setDerivativeHash] = useState<string | null>(null);
  const [derivativePreparedAt, setDerivativePreparedAt] = useState<string | null>(null);

  const resetCertificateDerivative = () => {
    setCertificateImageUrl((existing) => {
      if (existing) {
        URL.revokeObjectURL(existing);
      }
      return null;
    });
    setDerivativeHash(null);
    setDerivativePreparedAt(null);
  };

  const loadDetail = async (nextEvidenceId: string) => {
    setLoading(true);
    setErrorMessage(null);

    const detailView = await fetchEvidenceDetailView(nextEvidenceId);
    if (!detailView) {
      setView(null);
      setLedgerEntry(null);
      setLoading(false);
      setErrorMessage("Evidence item not found");
      return;
    }

    const attachmentLedgerEntry = detailView.attachment
      ? await getLatestLedgerEntryForAttachment(detailView.attachment.id)
      : undefined;

    setView(detailView);
    setLedgerEntry(attachmentLedgerEntry ?? null);
    setDescription(detailView.evidence.description ?? "");
    setIncludeInExport(detailView.evidence.includeInExport);
    setRedacted(detailView.evidence.redactionStatus !== "none");
    setRedactions(detailView.evidence.redactions ?? []);
    setRedactMode(false);
    setRedactionFeedback(null);
    resetCertificateDerivative();
    setIntegrityResult(null);
    setCopyHashFeedback(null);
    setLoading(false);
  };

  useEffect(() => {
    if (!evidenceId) {
      setErrorMessage("Missing evidence id");
      setLoading(false);
      return;
    }

    void loadDetail(evidenceId);
  }, [evidenceId]);

  const blobUrl = useMemo(() => {
    if (!view?.attachment) {
      return null;
    }

    return URL.createObjectURL(view.attachment.blob);
  }, [view?.attachment]);

  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  useEffect(() => {
    return () => {
      if (certificateImageUrl) {
        URL.revokeObjectURL(certificateImageUrl);
      }
    };
  }, [certificateImageUrl]);

  const computedState = useMemo(
    () => deriveEvidenceDetailComputedState(view, redactions, blobUrl, certificateImageUrl),
    [view, redactions, blobUrl, certificateImageUrl]
  );

  const handleSaveControls = async () => {
    if (!view) {
      return;
    }

    setSavingControls(true);
    setSavedFeedback(null);

    try {
      await updateEvidenceControls(view.evidence.id, {
        includeInExport,
        redactionStatus: redacted ? "partial" : "none",
        description: description.trim() || undefined,
      });
      await loadDetail(view.evidence.id);
      setSavedFeedback("Evidence controls saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save evidence controls");
    } finally {
      setSavingControls(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!view) {
      return;
    }

    setVerifyingIntegrity(true);
    setIntegrityResult(null);

    try {
      const result = await verifyEvidenceIntegrity(view.evidence, view.attachment);
      setIntegrityResult(result);
    } catch (error) {
      setIntegrityResult({
        status: "unverifiable",
        checkedAt: new Date().toISOString(),
        details: error instanceof Error ? error.message : "Integrity verification failed",
      });
    } finally {
      setVerifyingIntegrity(false);
    }
  };

  const handleCopyHash = async () => {
    if (!view?.evidence.sha256) {
      return;
    }

    try {
      await navigator.clipboard.writeText(view.evidence.sha256);
      setCopyHashFeedback("Hash copied to clipboard.");
    } catch {
      setCopyHashFeedback("Unable to copy hash.");
    }
  };

  const handleSaveRedactions = async () => {
    if (!view) {
      return;
    }

    setSavingRedactions(true);
    setRedactionFeedback(null);

    try {
      await updateEvidenceRedactions(view.evidence.id, redactions);
      await appendLedgerEvent({
        event: "EVIDENCE_REDACTED",
        caseId: view.evidence.caseId,
        attachmentId: view.attachment?.id,
        data: {
          evidenceItemId: view.evidence.id,
          regions: redactions,
        },
      });
      await loadDetail(view.evidence.id);
      setRedactionFeedback("Redaction overlays saved and anchored to ledger.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save redactions");
    } finally {
      setSavingRedactions(false);
    }
  };

  const waitForNextPaint = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  const prepareCertificateAndPrint = async () => {
    if (!view) {
      return;
    }

    if (computedState.hasPendingRedactionChanges) {
      setErrorMessage("Save redactions before generating a certificate.");
      return;
    }

    const savedRedactions = view.evidence.redactions ?? [];
    const attachmentForBake = view.attachment;
    const canBakeDerivative = Boolean(
      attachmentForBake &&
        view.evidence.mimeType?.startsWith("image/") &&
        savedRedactions.length > 0
    );

    if (!canBakeDerivative) {
      resetCertificateDerivative();
      await waitForNextPaint();
      globalThis.print();
      return;
    }

    setPreparingCertificate(true);
    setErrorMessage(null);

    try {
      if (!attachmentForBake) {
        throw new Error("Missing attachment for derivative generation");
      }

      const { bakedBlob, bakedHash } = await bakeRedactedImage(attachmentForBake.blob, savedRedactions);
      const bakedUrl = URL.createObjectURL(bakedBlob);

      const imagePreload = new Image();
      await new Promise<void>((resolve, reject) => {
        imagePreload.onload = () => resolve();
        imagePreload.onerror = () => reject(new Error("Unable to prepare derivative preview"));
        imagePreload.src = bakedUrl;
      });

      setCertificateImageUrl((existing) => {
        if (existing) {
          URL.revokeObjectURL(existing);
        }
        return bakedUrl;
      });
      setDerivativeHash(bakedHash);
      setDerivativePreparedAt(new Date().toISOString());

      await waitForNextPaint();
      globalThis.print();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to prepare redacted derivative");
    } finally {
      setPreparingCertificate(false);
    }
  };

  return {
    view,
    loading,
    errorMessage,
    description,
    setDescription,
    includeInExport,
    setIncludeInExport,
    redacted,
    setRedacted,
    savingControls,
    savedFeedback,
    integrityResult,
    verifyingIntegrity,
    copyHashFeedback,
    ledgerEntry,
    redactions,
    setRedactions,
    redactMode,
    toggleRedactMode: () => setRedactMode((value) => !value),
    savingRedactions,
    redactionFeedback,
    preparingCertificate,
    derivativeHash,
    derivativePreparedAt,
    blobUrl,
    effectiveCertificateImageUrl: computedState.effectiveCertificateImageUrl,
    hasPendingRedactionChanges: computedState.hasPendingRedactionChanges,
    canGenerateDerivativeCertificate: computedState.canGenerateDerivativeCertificate,
    handleSaveControls,
    handleVerifyIntegrity,
    handleCopyHash,
    handleSaveRedactions,
    prepareCertificateAndPrint,
  };
}