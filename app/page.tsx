import { Suspense } from "react";

import { AppPageSkeleton, AppShell } from "@/components/layout/app-shell";
import { LookupWorkspace } from "@/components/lookup/lookup-workspace";
import { requirePageUser } from "@/lib/auth/session";

async function AuthenticatedHome() {
  const user = await requirePageUser();

  return (
    <AppShell userEmail={user.email}>
      <LookupWorkspace />
    </AppShell>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <AuthenticatedHome />
    </Suspense>
  );
}
