import { useEffect, useState, type SyntheticEvent } from "react";
import { getCasesForSelect } from "../../db/queries";
import type { IncidentFormValues } from "./incidentForm";
import { defaultIncidentFormValues } from "./incidentForm";
import { saveIncident } from "./incidentActions";
import type { CaseOption } from "./useNewAttachment";

export function useNewIncident(navigate: (to: string) => void) {
  const [values, setValues] = useState<IncidentFormValues>(defaultIncidentFormValues());
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

  const setField = <K extends keyof IncidentFormValues>(field: K, value: IncidentFormValues[K]) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  };

  const persistIncident = async () => {
    setSaving(true);

    try {
      await saveIncident(values);
      navigate("/inbox?saved=incident");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save incident");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    void persistIncident();
  };

  return {
    values,
    cases,
    errorMessage,
    saving,
    setField,
    handleSubmit,
  };
}