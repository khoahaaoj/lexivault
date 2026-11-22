export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="rounded-full border border-foreground/15 px-3 py-1 text-xs font-medium tracking-wide text-foreground/70 uppercase">
        Phase 1 · Scaffold
      </span>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        LexiVault
      </h1>
      <p className="max-w-md text-balance text-foreground/70">
        Your personal English–Vietnamese dictionary with AI-enriched entries and
        spaced-repetition flashcards.
      </p>
    </main>
  );
}
