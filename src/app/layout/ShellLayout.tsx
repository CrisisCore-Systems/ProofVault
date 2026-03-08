import type { ReactNode } from "react";
import { MainNav } from "../../components/layout/MainNav";
import { TopHeader } from "../../components/layout/TopHeader";
import { VaultProvider, useVault } from "../../features/vault/VaultContext";
import { VaultSetupScreen } from "../../features/vault/VaultSetupScreen";
import { VaultLockScreen } from "../../features/vault/VaultLockScreen";

type ShellLayoutProps = {
  children: ReactNode;
};

function VaultGate({ children }: Readonly<ShellLayoutProps>) {
  const { status } = useVault();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-zinc-400">Loading vault…</p>
      </div>
    );
  }

  if (status === "setup-required") {
    return <VaultSetupScreen />;
  }

  if (status === "locked") {
    return <VaultLockScreen />;
  }

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

export function ShellLayout({ children }: Readonly<ShellLayoutProps>) {
  return (
    <VaultProvider>
      <VaultGate>{children}</VaultGate>
    </VaultProvider>
  );
}
