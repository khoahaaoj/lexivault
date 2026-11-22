"use client";

import { useState, type MouseEvent } from "react";

import { playPronunciation, type Accent } from "@/lib/audio/pronunciation";
import type {
  Antonym,
  CefrLevel,
  Collocation,
  ExampleSentence,
  Synonym,
} from "@/types/database";

export const CEFR_BADGE_CLASSES: Record<CefrLevel, string> = {
  A1: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  A2: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  B1: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  B2: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  C1: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  C2: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-300",
};

export type EntryDisplayData = {
  word: string;
  part_of_speech: string;
  cefr_level: CefrLevel;
  ipa_uk: string;
  ipa_us: string;
  audio_uk_url: string | null;
  audio_us_url: string | null;
  definition_en: string;
  explanation_vi: string;
  nuance_note_vi: string;
  collocations: Collocation[];
  synonyms: Synonym[];
  antonyms: Antonym[];
  examples: ExampleSentence[];
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

export function CefrBadge({ level }: { level: CefrLevel }) {
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${CEFR_BADGE_CLASSES[level]}`}
    >
      {level}
    </span>
  );
}

const ACCENT_META: ReadonlyArray<{
  accent: Accent;
  label: string;
  labelClass: string;
}> = [
  {
    accent: "uk",
    label: "UK",
    labelClass: "text-rose-600 dark:text-rose-400",
  },
  {
    accent: "us",
    label: "US",
    labelClass: "text-sky-600 dark:text-sky-400",
  },
];

export function PronunciationButtons({
  word,
  ipaUk,
  ipaUs,
  audioUkUrl,
  audioUsUrl,
  compact = false,
}: {
  word: string;
  ipaUk: string;
  ipaUs: string;
  audioUkUrl: string | null;
  audioUsUrl: string | null;
  compact?: boolean;
}) {
  const [playingAccent, setPlayingAccent] = useState<Accent | null>(null);

  async function handlePlay(
    event: MouseEvent<HTMLButtonElement>,
    accent: Accent,
  ) {
    event.stopPropagation();
    if (event.detail > 0) {
      event.currentTarget.blur();
    }
    const audioUrl = accent === "uk" ? audioUkUrl : audioUsUrl;
    setPlayingAccent(accent);
    try {
      await playPronunciation({
        audioUrl,
        text: word,
        accent,
      });
    } finally {
      setPlayingAccent((current) => (current === accent ? null : current));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {ACCENT_META.map(({ accent, label, labelClass }) => {
        const audioUrl = accent === "uk" ? audioUkUrl : audioUsUrl;
        const ipa = accent === "uk" ? ipaUk : ipaUs;
        const isPlaying = playingAccent === accent;

        return (
          <button
            key={accent}
            type="button"
            onClick={(event) => void handlePlay(event, accent)}
            title={
              audioUrl
                ? `Play ${label} pronunciation (.mp3)`
                : `Play ${label} pronunciation (Web Speech)`
            }
            className={`inline-flex items-center gap-2 rounded-xl border transition ${
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            } ${
              isPlaying
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-background text-foreground hover:border-accent/40 hover:bg-accent/5"
            }`}
          >
            <span className={`font-semibold ${labelClass}`}>{label}</span>
            <SpeakerIcon
              className={`h-3.5 w-3.5 ${isPlaying ? "animate-pulse" : ""}`}
            />
            {ipa && <span className="font-mono text-muted">{ipa}</span>}
            {!compact && (
              <span className="text-[10px] text-muted/70">
                {audioUrl ? "MP3" : "TTS"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EntryDetailSections({
  entry,
  onSelectTerm,
}: {
  entry: EntryDisplayData;
  onSelectTerm?: (term: string) => void;
}) {
  return (
    <div className="space-y-5">
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

      {entry.nuance_note_vi && (
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
      )}

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
                    {onSelectTerm ? (
                      <button
                        type="button"
                        onClick={() => onSelectTerm(syn.word)}
                        className="font-semibold text-accent hover:underline"
                      >
                        {syn.word}
                      </button>
                    ) : (
                      <span className="font-semibold text-foreground">
                        {syn.word}
                      </span>
                    )}
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
                {entry.antonyms.map((ant) =>
                  onSelectTerm ? (
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
                  ) : (
                    <span
                      key={ant.word}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs"
                    >
                      <span className="font-semibold text-foreground">
                        {ant.word}
                      </span>
                      <span className="text-muted">({ant.meaning_vi})</span>
                    </span>
                  ),
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {entry.examples.length > 0 && (
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
      )}
    </div>
  );
}
