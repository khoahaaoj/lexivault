import type { Metadata } from "next";
import { Suspense } from "react";

import { AppPageSkeleton, AppShell } from "@/components/layout/app-shell";
import { ReviewWorkspace } from "@/components/review/review-workspace";
import { requirePageUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Review",
  description: "Review your saved vocabulary with SM-2 spaced repetition.",
};

async function AuthenticatedReview() {
  const user = await requirePageUser();

  return (
    <AppShell userEmail={user.email}>
      <ReviewWorkspace />
    </AppShell>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<AppPageSkeleton />}>
      <AuthenticatedReview />
    </Suspense>
  );
}
