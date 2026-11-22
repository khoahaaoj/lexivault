"use client";

import { useState } from "react";

import { playPronunciation, type Accent } from "@/lib/audio/pronunciation";
import type { LookupEntryResult } from "@/lib/dictionary/validation";
import type { CefrLevel } from "@/types/database";

type EntryCardProps = {
  entry: LookupEntryResult;
  isSaving: boolean;
  saveError?: string;
  onSave: (entry: LookupEntryResult) => void;
  onSelectTerm: (term: string) => void;
};

const CEFR_BADGE_CLASSES: Record<CefrLevel, string> = {
  A1: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  A2: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  B1: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  B2: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  C1: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  C2: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
};

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-4 w-4"}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

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
  const [playingAccent, setPlayingAccent] = useState<Accent | null>(null);

  async function handlePlay(accent: Accent) {
    const audioUrl = accent === "uk" ? entry.audio_uk_url : entry.audio_us_url;
    setPlayingAccent(accent);
    try {
      await playPronunciation({
        audioUrl,
        text: entry.word,
        accent,
      });
    } finally {
      setPlayingAccent((current) => (current === accent ? null : current));
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
      {/* Header: Headword, POS, CEFR & Save CTA */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {entry.word}
            </h2>
            <span className="rounded-md bg-background px-2.5 py-0.5 text-xs font-medium text-muted italic">
              {entry.part_of_speech}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${CEFR_BADGE_CLASSES[entry.cefr_level]}`}
            >
              {entry.cefr_level}
            </span>
          </div>

          {/* UK / US IPA & Audio buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handlePlay("uk")}
              title={
                entry.audio_uk_url
                  ? "Play UK pronunciation (.mp3)"
                  : "Play UK pronunciation (Web Speech)"
              }
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                playingAccent === "uk"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-foreground hover:border-accent/40 hover:bg-accent/5"
              }`}
            >
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                UK
              </span>
              <SpeakerIcon
                className={`h-3.5 w-3.5 ${
                  playingAccent === "uk" ? "animate-pulse" : ""
                }`}
              />
              <span className="font-mono text-muted">{entry.ipa_uk}</span>
              <span className="text-[10px] text-muted/70">
                {entry.audio_uk_url ? "MP3" : "TTS"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => void handlePlay("us")}
              title={
                entry.audio_us_url
                  ? "Play US pronunciation (.mp3)"
                  : "Play US pronunciation (Web Speech)"
              }
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                playingAccent === "us"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-background text-foreground hover:border-accent/40 hover:bg-accent/5"
              }`}
            >
              <span className="font-semibold text-sky-600 dark:text-sky-400">
                US
              </span>
              <SpeakerIcon
                className={`h-3.5 w-3.5 ${
                  playingAccent === "us" ? "animate-pulse" : ""
                }`}
              />
              <span className="font-mono text-muted">{entry.ipa_us}</span>
              <span className="text-[10px] text-muted/70">
                {entry.audio_us_url ? "MP3" : "TTS"}
              </span>
            </button>
          </div>
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

      {/* Core Meanings */}
      <div className="mt-5 space-y-5">
        <section aria-label="English definition">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
            English Definition
          </h3>
          <p className="mt-1.5 text-base leading-relaxed font-medium text-foreground">
            {entry.definition_en}
          </p>
        </section>

        <section aria-label="Vietnamese explanation">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
            Giải thích tiếng Việt
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 sm:text-base">
            {entry.explanation_vi}
          </p>
        </section>

        {/* Nuance Box */}
        <section
          aria-label="Nuance and usage note"
          className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
        >
          <h3 className="text-xs font-semibold tracking-wider text-amber-700 uppercase dark:text-amber-300">
            Nuance &amp; Usage Note
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
            {entry.nuance_note_vi}
          </p>
        </section>

        {/* Collocations */}
        {entry.collocations.length > 0 && (
          <section aria-label="Collocations">
            <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
              Collocations
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {entry.collocations.map((collocation) => (
                <div
                  key={`${collocation.phrase}-${collocation.meaning_vi}`}
                  className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                >
                  <span className="font-semibold text-foreground">
                    {collocation.phrase}
                  </span>
                  <span className="mx-1.5 text-muted">·</span>
                  <span className="text-muted">{collocation.meaning_vi}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Synonyms & Antonyms */}
        {(entry.synonyms.length > 0 || entry.antonyms.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {entry.synonyms.length > 0 && (
              <section
                aria-label="Synonyms"
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
                  Synonyms &amp; Nuance
                </h3>
                <ul className="mt-2.5 space-y-2.5">
                  {entry.synonyms.map((syn) => (
                    <li key={syn.word} className="text-xs leading-relaxed">
                      <button
                        type="button"
                        onClick={() => onSelectTerm(syn.word)}
                        className="font-semibold text-accent hover:underline"
                      >
                        {syn.word}
                      </button>
                      <span className="text-muted"> — {syn.difference_vi}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {entry.antonyms.length > 0 && (
              <section
                aria-label="Antonyms"
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
                  Antonyms
                </h3>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {entry.antonyms.map((ant) => (
                    <button
                      key={ant.word}
                      type="button"
                      onClick={() => onSelectTerm(ant.word)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs transition hover:border-accent/40"
                    >
                      <span className="font-semibold text-foreground">
                        {ant.word}
                      </span>
                      <span className="text-muted">({ant.meaning_vi})</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Bilingual IELTS Examples */}
        <section aria-label="Bilingual IELTS examples">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">
            IELTS &amp; Natural Examples
          </h3>
          <ul className="mt-2.5 space-y-3">
            {entry.examples.map((example, index) => (
              <li
                key={`${index}-${example.en}`}
                className="border-l-2 border-accent/50 pl-3.5"
              >
                <p className="text-sm font-medium text-foreground">
                  {example.en}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-sm">
                  {example.vi}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}
