import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-base font-bold text-accent">
        404
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-muted">
        The page you requested does not exist in LexiVault.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-95"
        >
          Back to Lookup
        </Link>
        <Link
          href="/vault"
          className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-background"
        >
          Open Vault
        </Link>
      </div>
    </main>
  );
}
