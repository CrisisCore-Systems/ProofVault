import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
};

export function SectionHeader({ title, subtitle, rightSlot }: Readonly<SectionHeaderProps>) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        {subtitle ? <p className="text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
      {rightSlot}
    </div>
  );
}
