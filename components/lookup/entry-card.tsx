"use client";

import {
  CefrBadge,
  EntryDetailSections,
  PronunciationButtons,
} from "@/components/dictionary/entry-details";
import type {
  LookupPreviewData,
  PartialLookupEntry,
} from "@/lib/dictionary/stream";
import type { LookupEntryResult } from "@/lib/dictionary/validation";

type EntryCardProps = {
  entry: LookupEntryResult;
  isSaving: boolean;
  saveError?: string;
  onSave: (entry: LookupEntryResult) => void;
  onSelectTerm: (term: string) => void;
};

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

export function EntryCard({
  entry,
  isSaving,
  saveError,
  onSave,
  onSelectTerm,
}: EntryCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
      {/* Header: Headword, POS, CEFR & Save CTA */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {entry.word}
            </h2>
            <span className="rounded-md bg-background px-2.5 py-0.5 text-xs font-medium text-muted italic">
              {entry.part_of_speech}
            </span>
            <CefrBadge level={entry.cefr_level} />
          </div>

          <PronunciationButtons
            word={entry.word}
            ipaUk={entry.ipa_uk}
            ipaUs={entry.ipa_us}
            audioUkUrl={entry.audio_uk_url}
            audioUsUrl={entry.audio_us_url}
          />
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            disabled={entry.is_saved || isSaving}
            onClick={() => onSave(entry)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition sm:w-auto ${
              entry.is_saved
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "bg-accent text-accent-foreground hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            }`}
          >
            <BookmarkIcon filled={entry.is_saved} />
            {entry.is_saved
              ? "Saved to Flashcards ✓"
              : isSaving
                ? "Saving…"
                : "Save to Flashcards"}
          </button>
          {saveError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {saveError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <EntryDetailSections entry={entry} onSelectTerm={onSelectTerm} />
      </div>
    </article>
  );
}

export function StreamingEntryCard({ entry }: { entry: PartialLookupEntry }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {entry.word}
            </h2>
            {entry.part_of_speech && (
              <span className="rounded-md bg-background px-2.5 py-0.5 text-xs font-medium text-muted italic">
                {entry.part_of_speech}
              </span>
            )}
            {entry.cefr_level && <CefrBadge level={entry.cefr_level} />}
          </div>

          <PronunciationButtons
            word={entry.word}
            ipaUk={entry.ipa_uk}
            ipaUs={entry.ipa_us}
            audioUkUrl={entry.audio_uk_url}
            audioUsUrl={entry.audio_us_url}
          />
        </div>

        <button
          type="button"
          disabled
          className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-muted opacity-75 sm:w-auto"
        >
          Generating…
        </button>
      </div>

      <div className="mt-5">
        <EntryDetailSections entry={entry} isStreaming />
      </div>
    </article>
  );
}

export function InstantPreviewCard({
  preview,
}: {
  preview: LookupPreviewData;
}) {
  const ipaUk = preview.ipa_texts[0] ?? "";
  const ipaUs = preview.ipa_texts[1] ?? preview.ipa_texts[0] ?? "";

  return (
    <article
      aria-label="Instant pronunciation and reference preview"
      className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7"
    >
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {preview.word}
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              AI đang viết giải thích tiếng Việt &amp; IELTS…
            </span>
          </div>

          <PronunciationButtons
            word={preview.word}
            ipaUk={ipaUk}
            ipaUs={ipaUs}
            audioUkUrl={preview.audio_uk_url}
            audioUsUrl={preview.audio_us_url}
          />
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {preview.meanings.length > 0 && (
          <section aria-label="Quick reference definitions">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
              Quick Reference · Free Dictionary
            </h3>
            <ul className="mt-2 space-y-2">
              {preview.meanings.map((meaning, mIndex) => (
                <li
                  key={`${mIndex}-${meaning.part_of_speech}`}
                  className="text-sm leading-relaxed text-foreground/90"
                >
                  <span className="mr-2 rounded bg-background px-1.5 py-0.5 text-xs font-medium text-muted italic">
                    {meaning.part_of_speech}
                  </span>
                  {meaning.definitions[0]}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="space-y-2.5">
          <div className="h-4 w-44 animate-pulse rounded bg-background" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-background" />
          <div className="h-12 w-5/6 animate-pulse rounded-xl bg-background" />
        </div>
      </div>
    </article>
  );
}
