import type { Metadata } from "next";
import { Suspense } from "react";

import { AppPageSkeleton, AppShell } from "@/components/layout/app-shell";
import { VaultWorkspace } from "@/components/vault/vault-workspace";
import { requirePageUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Vault",
  description: "Search, filter, and manage your saved LexiVault vocabulary.",
};

async function AuthenticatedVault() {
  const user = await requirePageUser();

  return (
    <AppShell userEmail={user.email}>
      <VaultWorkspace />
    </AppShell>
  );
}

export default function VaultPage() {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <AuthenticatedVault />
    </Suspense>
  );
}
