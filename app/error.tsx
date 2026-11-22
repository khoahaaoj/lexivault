"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-lg font-bold text-rose-600 dark:text-rose-300">
        !
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-2 text-sm text-muted">
        An unexpected error occurred while rendering this view.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-95"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-background"
        >
          Back to Lookup
        </Link>
      </div>
    </main>
  );
}
