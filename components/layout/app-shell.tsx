import Link from "next/link";
import type { ReactNode } from "react";

import { signOut } from "@/app/login/actions";
import { NavLinks } from "@/components/layout/nav-links";

export function AppShell({
  userEmail,
  children,
}: {
  userEmail: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col pb-20 sm:pb-0">
      {/* Desktop top navbar */}
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 transition hover:opacity-90"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
                LV
              </span>
              <span className="text-base font-semibold tracking-tight">
                LexiVault
              </span>
            </Link>

            <NavLinks variant="desktop" />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-52 truncate text-xs text-muted sm:inline">
              {userEmail}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-border/40"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>

      <NavLinks variant="mobile" />
    </div>
  );
}

export function AppPageSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="h-44 w-full animate-pulse rounded-2xl border border-border bg-surface" />
    </main>
  );
}
