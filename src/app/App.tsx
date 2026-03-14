import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ShellLayout } from "./layout/ShellLayout";

const Inbox = lazy(() => import("./routes/Inbox").then((module) => ({ default: module.Inbox })));
const Cases = lazy(() => import("./routes/Cases").then((module) => ({ default: module.Cases })));
const Timeline = lazy(() => import("./routes/Timeline").then((module) => ({ default: module.Timeline })));
const Exports = lazy(() => import("./routes/Exports").then((module) => ({ default: module.Exports })));
const StandaloneVerifier = lazy(() =>
  import("./routes/StandaloneVerifier").then((module) => ({ default: module.StandaloneVerifier }))
);
const NewIncident = lazy(() =>
  import("./routes/NewIncident").then((module) => ({ default: module.NewIncident }))
);
const NewAttachment = lazy(() =>
  import("./routes/NewAttachment").then((module) => ({ default: module.NewAttachment }))
);
const EvidenceDetail = lazy(() =>
  import("./routes/EvidenceDetail").then((module) => ({ default: module.EvidenceDetail }))
);
const Security = lazy(() => import("./routes/Security").then((module) => ({ default: module.Security })));

function RouteFallback() {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/80 p-6 text-sm text-zinc-400">
      Loading screen...
    </div>
  );
}

export function App() {
  return (
    <ShellLayout>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/exports" element={<Exports />} />
          <Route path="/verifier" element={<StandaloneVerifier />} />
          <Route path="/security" element={<Security />} />
          <Route path="/incidents/new" element={<NewIncident />} />
          <Route path="/attachments/new" element={<NewAttachment />} />
          <Route path="/evidence/:id" element={<EvidenceDetail />} />
        </Routes>
      </Suspense>
    </ShellLayout>
  );
}