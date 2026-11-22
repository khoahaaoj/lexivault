import { Suspense } from "react";

import { signOut } from "@/app/login/actions";
import { requirePageUser } from "@/lib/auth/session";
import { getAuthEnv } from "@/lib/env/server";

const NAV_ITEMS = [
  { label: "Lookup", active: true, badge: "Phase 3" },
  { label: "Review", active: false, badge: "Phase 4" },
  { label: "Vault", active: false, badge: "Phase 4" },
] as const;

async function AuthenticatedHome() {
  const user = await requirePageUser();
  const isRestricted = getAuthEnv().ALLOWED_EMAILS !== null;

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
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    item.active ? "bg-accent/10 text-accent" : "text-muted/70"
                  }`}
                >
                  {item.label}
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

      {/* Main content */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Authenticated
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted">
              Phase 2 · Supabase &amp; Auth
            </span>
            {isRestricted && (
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                Allowlist active
              </span>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome back to LexiVault
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Signed in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>.
            Your session is refreshed automatically and every database table is
            protected with Supabase Row Level Security.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">
                    {item.badge}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {item.label === "Lookup" &&
                    "Hybrid Free Dictionary + Gemini enriched lookup"}
                  {item.label === "Review" &&
                    "SM-2 spaced-repetition flashcards with keyboard shortcuts"}
                  {item.label === "Vault" &&
                    "Search and filter saved vocabulary by CEFR & mastery"}
                </p>
              </div>
            ))}
          </div>
        </section>
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12 sm:px-6">
      <div className="h-56 w-full animate-pulse rounded-2xl border border-border bg-surface" />
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
