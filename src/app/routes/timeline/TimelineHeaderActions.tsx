import { AddAttachmentButton } from "../../../components/ui/AddAttachmentButton";
import { NewIncidentButton } from "../../../components/ui/NewIncidentButton";
import { SeedDataButton } from "../../../components/ui/SeedDataButton";

type TimelineHeaderActionsProps = {
  onSeeded: () => Promise<void>;
};

export function TimelineHeaderActions({ onSeeded }: Readonly<TimelineHeaderActionsProps>) {
  return (
    <div className="flex items-center gap-2">
      <NewIncidentButton />
      <AddAttachmentButton />
      <SeedDataButton onSeeded={onSeeded} />
    </div>
  );
}