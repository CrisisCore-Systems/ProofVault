import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { getCasesForSelect } from "../../db/queries";
import { getSessionKey } from "../security/session";
import { saveAttachment } from "./attachmentActions";
import {
  defaultAttachmentFormValues,
  type AttachmentFormValues,
} from "./attachmentValidators";

export type CaseOption = {
  id: string;
  title: string;
};

export function deriveAttachmentTitleFromFile(file: File): string {
  return file.name.replace(/\.[^/.]+$/, "") || file.name;
}

export function useNewAttachment(navigate: (to: string) => void) {
  const [values, setValues] = useState<AttachmentFormValues>(defaultAttachmentFormValues());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCases = async () => {
      const caseOptions = await getCasesForSelect();
      setCases(caseOptions);
    };

    void loadCases();
  }, []);

  const setField = <K extends keyof AttachmentFormValues>(
    field: K,
    value: AttachmentFormValues[K]
  ) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);

    if (file && !values.title.trim()) {
      setValues((previous) => ({
        ...previous,
        title: deriveAttachmentTitleFromFile(file),
      }));
    }
  };

  const persistAttachment = async () => {
    const sessionKey = getSessionKey();

    if (!selectedFile) {
      setErrorMessage("Select a file to continue");
      return;
    }

    if (!sessionKey) {
      setErrorMessage("Vault is locked. Unlock the vault before importing attachments.");
      return;
    }

    setSaving(true);
    try {
      await saveAttachment(values, selectedFile, sessionKey);
      navigate("/inbox?saved=attachment");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save attachment");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    void persistAttachment();
  };

  return {
    values,
    selectedFile,
    cases,
    errorMessage,
    saving,
    setField,
    handleFileChange,
    handleSubmit,
  };
}