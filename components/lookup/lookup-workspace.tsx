"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";

import { EntryCard } from "@/components/lookup/entry-card";
import { entrySenseKey } from "@/lib/dictionary/mappers";
import {
  MAX_LOOKUP_TERM_LENGTH,
  lookupTermSchema,
  type LookupApiResponse,
  type LookupEntryResult,
} from "@/lib/dictionary/validation";

const QUICK_EXAMPLES = [
  "mitigate",
  "ubiquitous",
  "bite the bullet",
  "resilient",
] as const;

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Looking up word"
      className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-7"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2.5">
          <div className="h-8 w-44 animate-pulse rounded-lg bg-background" />
          <div className="flex gap-2">
            <div className="h-7 w-28 animate-pulse rounded-xl bg-background" />
            <div className="h-7 w-28 animate-pulse rounded-xl bg-background" />
          </div>
        </div>
        <div className="h-10 w-40 animate-pulse rounded-xl bg-background" />
      </div>
      <div className="h-5 w-3/4 animate-pulse rounded bg-background" />
      <div className="h-16 w-full animate-pulse rounded-xl bg-background" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-background" />
    </div>
  );
}

export function LookupWorkspace() {
  const [term, setTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LookupApiResponse | null>(null);
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  async function runLookup(rawTerm: string) {
    const parsed = lookupTermSchema.safeParse(rawTerm);
    if (!parsed.success) {
      const flattened = z.flattenError(parsed.error);
      setError(flattened.formErrors[0] ?? "Please enter a valid English term.");
      return;
    }

    const normalized = parsed.data;
    setTerm(normalized);
    setError(null);
    setSaveErrors({});
    setIsLoading(true);

    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term: normalized }),
      });

      const data = (await response.json()) as
        LookupApiResponse | { error?: string };

      if (!response.ok) {
        setError(
          "error" in data && data.error
            ? data.error
            : "Unable to look up that term right now.",
        );
        return;
      }

      setResult(data as LookupApiResponse);
    } catch {
      setError("Network error while looking up that term. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    void runLookup(term);
  }

  function handleSelectTerm(nextTerm: string) {
    if (isLoading) {
      return;
    }
    setTerm(nextTerm);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    void runLookup(nextTerm);
  }

  async function handleSave(entry: LookupEntryResult) {
    const key = entrySenseKey(entry.word, entry.part_of_speech);
    setSavingKeys((prev) => ({ ...prev, [key]: true }));
    setSaveErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const response = await fetch("/api/entries/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: entry.word,
          part_of_speech: entry.part_of_speech,
          cefr_level: entry.cefr_level,
          ipa_uk: entry.ipa_uk,
          ipa_us: entry.ipa_us,
          audio_uk_url: entry.audio_uk_url,
          audio_us_url: entry.audio_us_url,
          definition_en: entry.definition_en,
          explanation_vi: entry.explanation_vi,
          nuance_note_vi: entry.nuance_note_vi,
          collocations: entry.collocations,
          synonyms: entry.synonyms,
          antonyms: entry.antonyms,
          examples: entry.examples,
        }),
      });

      const data = (await response.json()) as {
        entry_id?: string;
        srs_card_id?: string;
        error?: string;
      };

      if (!response.ok || !data.entry_id || !data.srs_card_id) {
        setSaveErrors((prev) => ({
          ...prev,
          [key]: data.error ?? "Failed to save flashcard.",
        }));
        return;
      }

      setResult((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          entries: prev.entries.map((item) =>
            entrySenseKey(item.word, item.part_of_speech) === key
              ? {
                  ...item,
                  id: data.entry_id ?? item.id,
                  srs_card_id: data.srs_card_id ?? item.srs_card_id,
                  is_saved: true,
                }
              : item,
          ),
        };
      });
    } catch {
      setSaveErrors((prev) => ({
        ...prev,
        [key]: "Network error while saving flashcard.",
      }));
    } finally {
      setSavingKeys((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Search Card */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
        <div className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Bilingual Dictionary Lookup
          </h1>
          <p className="mt-1 text-sm text-muted">
            Look up any English word, phrasal verb, or idiom — real UK/US audio
            paired with Cambridge-grade IELTS explanations.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <div className="relative flex-1">
            <label htmlFor="dictionary-search" className="sr-only">
              Search an English word or phrase
            </label>
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">
              <SearchIcon />
            </span>
            <input
              id="dictionary-search"
              type="search"
              value={term}
              maxLength={MAX_LOOKUP_TERM_LENGTH}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search word, phrasal verb, or idiom (e.g. mitigate)..."
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full rounded-xl border border-border bg-background py-3 pr-10 pl-10 text-base text-foreground transition outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm"
            />
            {term.length > 0 && !isLoading && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setTerm("");
                  setError(null);
                }}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-xs text-muted hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 sm:py-2.5"
          >
            {isLoading ? "Looking up…" : "Search"}
          </button>
        </form>

        {/* Quick-start examples */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Try:</span>
          {QUICK_EXAMPLES.map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectTerm(sample)}
              className="rounded-lg border border-border bg-background px-2.5 py-1 font-medium text-foreground transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              {sample}
            </button>
          ))}
        </div>
      </section>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && <LoadingSkeleton />}

      {/* Invalid word + "Did you mean?" */}
      {!isLoading && result && !result.is_valid && (
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-xs sm:p-7">
          <p className="text-sm text-foreground">
            No valid English dictionary entry found for{" "}
            <span className="font-semibold">“{result.query}”</span>.
          </p>
          {result.suggestion ? (
            <p className="mt-2 text-sm text-muted">
              Did you mean:{" "}
              <button
                type="button"
                onClick={() => handleSelectTerm(result.suggestion!)}
                className="font-semibold text-accent underline underline-offset-4 hover:opacity-85"
              >
                {result.suggestion}
              </button>
              ?
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Check your spelling and try another word or phrase.
            </p>
          )}
        </section>
      )}

      {/* Results list */}
      {!isLoading && result && result.is_valid && result.entries.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
            <span>
              Showing {result.entries.length}{" "}
              {result.entries.length === 1 ? "sense" : "senses"} for{" "}
              <span className="font-semibold text-foreground">
                “{result.query}”
              </span>
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-medium ${
                result.source === "cache"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-accent/10 text-accent"
              }`}
            >
              {result.source === "cache"
                ? "Instant Vault Cache"
                : "AI-Enriched · Live"}
            </span>
          </div>

          {result.entries.map((entry) => {
            const key = entrySenseKey(entry.word, entry.part_of_speech);
            return (
              <EntryCard
                key={key}
                entry={entry}
                isSaving={Boolean(savingKeys[key])}
                saveError={saveErrors[key]}
                onSave={(target) => void handleSave(target)}
                onSelectTerm={handleSelectTerm}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
