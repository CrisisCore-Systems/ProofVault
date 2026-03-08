import { Navigate, Route, Routes } from "react-router-dom";
import { ShellLayout } from "./layout/ShellLayout";
import { Inbox } from "./routes/Inbox";
import { Cases } from "./routes/Cases";
import { Timeline } from "./routes/Timeline";
import { Exports } from "./routes/Exports";
import { NewIncident } from "./routes/NewIncident";
import { NewAttachment } from "./routes/NewAttachment";
import { EvidenceDetail } from "./routes/EvidenceDetail";

export function App() {
  return (
    <ShellLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/inbox" replace />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/exports" element={<Exports />} />
        <Route path="/incidents/new" element={<NewIncident />} />
        <Route path="/attachments/new" element={<NewAttachment />} />
        <Route path="/evidence/:id" element={<EvidenceDetail />} />
      </Routes>
    </ShellLayout>
  );
}