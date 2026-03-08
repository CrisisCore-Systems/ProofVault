import type { ReactNode } from "react";

type EmptyStateCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyStateCard({ title, description, action }: Readonly<EmptyStateCardProps>) {
  return (
    <section className="pv-card">
      <h3 className="mb-1 text-sm font-semibold text-zinc-200">{title}</h3>
      <p className="text-sm text-zinc-400">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}
