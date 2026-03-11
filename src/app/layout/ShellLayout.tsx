import type { ReactNode } from "react";
import { MainNav } from "../../components/layout/MainNav";
import { TopHeader } from "../../components/layout/TopHeader";

type ShellLayoutProps = {
  children: ReactNode;
};

export function ShellLayout({ children }: Readonly<ShellLayoutProps>) {
  return (
    <div className="grid h-full min-h-screen grid-cols-[220px_1fr] print:block">
      <div className="print:hidden">
        <MainNav />
      </div>
      <div className="flex min-h-screen flex-col print:min-h-0">
        <div className="print:hidden">
          <TopHeader />
        </div>
        <main className="flex-1 overflow-auto p-4 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
