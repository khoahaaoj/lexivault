import { Suspense } from "react";

import { signOut } from "@/app/login/actions";
import { LookupWorkspace } from "@/components/lookup/lookup-workspace";
import { requirePageUser } from "@/lib/auth/session";

const NAV_ITEMS = [
  { label: "Lookup", active: true, badge: null },
  { label: "Review", active: false, badge: "Phase 4" },
  { label: "Vault", active: false, badge: "Phase 4" },
] as const;

async function AuthenticatedHome() {
  const user = await requirePageUser();

  return (
    <div className="flex min-h-full flex-1 flex-col pb-20 sm:pb-0">
      {/* Desktop top navbar */}
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-accent-foreground">
                LV
              </span>
              <span className="text-base font-semibold tracking-tight">
                LexiVault
              </span>
            </div>

            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 sm:flex"
            >
              {NAV_ITEMS.map((item) => (
                <span
                  key={item.label}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    item.active ? "bg-accent/10 text-accent" : "text-muted/70"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {item.badge}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-52 truncate text-xs text-muted sm:inline">
              {user.email}
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

      {/* Main lookup workspace */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <LookupWorkspace />
      </main>

      {/* Mobile bottom navigation bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed right-0 bottom-0 left-0 z-10 border-t border-border bg-surface/95 backdrop-blur sm:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 px-2 py-2">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-xs font-medium ${
                item.active ? "text-accent" : "text-muted/70"
              }`}
            >
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="h-44 w-full animate-pulse rounded-2xl border border-border bg-surface" />
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <AuthenticatedHome />
    </Suspense>
  );
}
