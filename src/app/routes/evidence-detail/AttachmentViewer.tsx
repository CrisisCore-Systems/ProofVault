import type { EvidenceItem } from "../../../domain/types";

type AttachmentViewerProps = {
  evidence: EvidenceItem;
  attachmentFilename: string;
  blobUrl: string;
};

export function AttachmentViewer({ evidence, attachmentFilename, blobUrl }: Readonly<AttachmentViewerProps>) {
  return (
    <div className="space-y-3">
      {evidence.mimeType?.startsWith("image/") ? (
        <img src={blobUrl} alt={evidence.title} className="max-h-[360px] rounded-md border border-zinc-800 object-contain" />
      ) : null}

      {evidence.mimeType?.startsWith("audio/") ? (
        <audio controls src={blobUrl} className="w-full">
          <track kind="captions" />
        </audio>
      ) : null}

      {evidence.mimeType?.startsWith("video/") ? (
        <video controls src={blobUrl} className="max-h-[360px] w-full rounded-md border border-zinc-800">
          <track kind="captions" />
        </video>
      ) : null}

      {evidence.mimeType === "application/pdf" ? (
        <button
          type="button"
          onClick={() => window.open(blobUrl, "_blank", "noopener,noreferrer")}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Open PDF
        </button>
      ) : null}

      <a
        href={blobUrl}
        download={attachmentFilename}
        className="inline-block rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Download original file
      </a>
    </div>
  );
}