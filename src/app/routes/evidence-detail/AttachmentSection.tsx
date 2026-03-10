import type { ReactNode } from "react";
import type { EvidenceItem, RedactionRegion } from "../../../domain/types";
import type { EvidenceDetailView } from "../../../features/evidence/evidenceDetailView";
import { AttachmentViewer } from "./AttachmentViewer";
import { ImageAttachmentRedactionEditor } from "./ImageAttachmentRedactionEditor";

type AttachmentSectionProps = {
  evidence: EvidenceItem;
  attachment?: EvidenceDetailView["attachment"];
  blobUrl: string | null;
  redactions: RedactionRegion[];
  redactMode: boolean;
  savingRedactions: boolean;
  redactionFeedback: string | null;
  hasPendingRedactionChanges: boolean;
  onToggleRedactMode: () => void;
  onChangeRedactions: (value: RedactionRegion[]) => void;
  onSaveRedactions: () => void;
};

export function AttachmentSection({
  evidence,
  attachment,
  blobUrl,
  redactions,
  redactMode,
  savingRedactions,
  redactionFeedback,
  hasPendingRedactionChanges,
  onToggleRedactMode,
  onChangeRedactions,
  onSaveRedactions,
}: Readonly<AttachmentSectionProps>) {
  const isImageAttachment = Boolean(attachment && blobUrl && evidence.mimeType?.startsWith("image/"));

  let attachmentContent: ReactNode;
  if (!attachment || !blobUrl) {
    attachmentContent = (
      <p className="text-sm text-zinc-500">No attachment blob linked to this evidence item.</p>
    );
  } else if (isImageAttachment) {
    attachmentContent = (
      <ImageAttachmentRedactionEditor
        evidence={evidence}
        attachment={attachment}
        blobUrl={blobUrl}
        redactions={redactions}
        redactMode={redactMode}
        savingRedactions={savingRedactions}
        redactionFeedback={redactionFeedback}
        hasPendingRedactionChanges={hasPendingRedactionChanges}
        onToggleRedactMode={onToggleRedactMode}
        onChangeRedactions={onChangeRedactions}
        onSaveRedactions={onSaveRedactions}
      />
    );
  } else {
    attachmentContent = (
      <AttachmentViewer
        evidence={evidence}
        attachmentFilename={attachment.originalFilename}
        blobUrl={blobUrl}
      />
    );
  }

  return (
    <section className="pv-card space-y-3">
      <h3 className="pv-section-title">Attachment</h3>
      {attachmentContent}
    </section>
  );
}