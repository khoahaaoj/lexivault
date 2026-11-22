"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CefrBadge,
  EntryDetailSections,
  PronunciationButtons,
} from "@/components/dictionary/entry-details";
import { previewRatingIntervals, type ReviewRating } from "@/lib/sm2";
import type {
  ReviewCardItem,
  ReviewQueueResponse,
  ReviewSubmitResponse,
} from "@/lib/srs/schemas";

type RatingButtonMeta = {
  rating: ReviewRating;
  label: string;
  shortcut: string;
  classes: string;
};

const RATING_BUTTONS: readonly RatingButtonMeta[] = [
  {
    rating: 1,
    label: "Again",
    shortcut: "1",
    classes:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300",
  },
  {
    rating: 2,
    label: "Hard",
    shortcut: "2",
    classes:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
  },
  {
    rating: 3,
    label: "Good",
    shortcut: "3",
    classes:
      "border-sky-500/30 bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300",
  },
  {
    rating: 4,
    label: "Easy",
    shortcut: "4",
    classes:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
  },
];

function formatUpcomingTime(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) {
    return "due right now";
  }
  const diffMinutes = Math.ceil(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `in ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"}`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours === 1 ? "" : "s"}`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `in ${diffDays} day${diffDays === 1 ? "" : "s"} (${date.toLocaleDateString()})`;
}

function ReviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading flashcards" className="space-y-5">
      <div className="h-20 w-full animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="h-72 w-full animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}

async function fetchReviewQueue(): Promise<
  { ok: true; data: ReviewQueueResponse } | { ok: false; error: string }
> {
  try {
    const response = await fetch("/api/review", { cache: "no-store" });
    const data = (await response.json()) as
      ReviewQueueResponse | { error?: string };

    if (!response.ok) {
      return {
        ok: false,
        error:
          "error" in data && data.error
            ? data.error
            : "Unable to load due flashcards.",
      };
    }

    return { ok: true, data: data as ReviewQueueResponse };
  } catch {
    return {
      ok: false,
      error: "Network error while loading flashcards. Please try again.",
    };
  }
}

export function ReviewWorkspace() {
  const [queue, setQueue] = useState<ReviewCardItem[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [initialDueCount, setInitialDueCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [nextUpcomingAt, setNextUpcomingAt] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyQueueOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof fetchReviewQueue>>) => {
      if (outcome.ok) {
        setQueue(outcome.data.cards);
        setTotalCards(outcome.data.total_cards);
        setInitialDueCount(outcome.data.due_count);
        setCompletedCount(0);
        setNextUpcomingAt(outcome.data.next_upcoming_at);
        setIsFlipped(false);
        setError(null);
      } else {
        setError(outcome.error);
      }
      setIsLoading(false);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchReviewQueue().then((outcome) => {
      if (!cancelled) {
        applyQueueOutcome(outcome);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyQueueOutcome]);

  async function handleRetry() {
    setIsLoading(true);
    setError(null);
    const outcome = await fetchReviewQueue();
    applyQueueOutcome(outcome);
  }

  const currentCard = queue[0] ?? null;

  const intervalPreviews = useMemo(() => {
    if (!currentCard) {
      return null;
    }
    return previewRatingIntervals({
      ease_factor: currentCard.ease_factor,
      interval_days: currentCard.interval_days,
      repetitions: currentCard.repetitions,
    });
  }, [currentCard]);

  const handleRate = useCallback(
    async (rating: ReviewRating) => {
      if (!currentCard || isSubmitting) {
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const response = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card_id: currentCard.id,
            rating,
          }),
        });

        const data = (await response.json()) as
          ReviewSubmitResponse | { error?: string };

        if (!response.ok || !("id" in data)) {
          setError(
            "error" in data && data.error
              ? data.error
              : "Failed to save your review rating.",
          );
          return;
        }

        const updated = data;

        if (rating === 1) {
          // Move lapsed card to the end of the current session queue for re-practice.
          const requeuedCard: ReviewCardItem = {
            ...currentCard,
            ease_factor: updated.ease_factor,
            interval_days: updated.interval_days,
            repetitions: updated.repetitions,
            next_review_at: updated.next_review_at,
            last_reviewed_at: updated.last_reviewed_at,
          };
          setQueue((prev) => [...prev.slice(1), requeuedCard]);
        } else {
          setQueue((prev) => prev.slice(1));
          setCompletedCount((prev) => prev + 1);
          setNextUpcomingAt((prev) => {
            if (!prev) {
              return updated.next_review_at;
            }
            return new Date(updated.next_review_at).getTime() <
              new Date(prev).getTime()
              ? updated.next_review_at
              : prev;
          });
        }

        setIsFlipped(false);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch {
        setError("Network error while saving review progress. Please retry.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [currentCard, isSubmitting],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!currentCard || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, select, a, button") ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!isFlipped && (event.code === "Space" || event.key === " ")) {
        event.preventDefault();
        setIsFlipped(true);
        return;
      }

      if (isFlipped && !isSubmitting) {
        if (event.key === "1") {
          void handleRate(1);
        } else if (event.key === "2") {
          void handleRate(2);
        } else if (event.key === "3") {
          void handleRate(3);
        } else if (event.key === "4") {
          void handleRate(4);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentCard, handleRate, isFlipped, isSubmitting]);

  if (isLoading) {
    return <ReviewSkeleton />;
  }

  const progressPercent =
    initialDueCount > 0
      ? Math.min(100, Math.round((completedCount / initialDueCount) * 100))
      : 100;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress & session summary bar */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Spaced Repetition Review
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              {queue.length > 0
                ? `${queue.length} due card${queue.length === 1 ? "" : "s"} remaining today`
                : totalCards > 0
                  ? `${totalCards} saved card${totalCards === 1 ? "" : "s"} · 0 due right now`
                  : "No flashcards saved yet"}
            </p>
          </div>

          {initialDueCount > 0 && (
            <div className="text-right">
              <span className="text-sm font-semibold text-foreground">
                {completedCount} / {initialDueCount}
              </span>
              <p className="text-xs text-muted">completed</p>
            </div>
          )}
        </div>

        {initialDueCount > 0 && (
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Review session progress"
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-background"
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void handleRetry()}
            className="rounded-lg border border-red-500/30 px-3 py-1 text-xs font-medium hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state: no saved flashcards */}
      {!error && totalCards === 0 && (
        <section className="rounded-2xl border border-border bg-surface p-8 text-center shadow-xs sm:p-10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <rect width="16" height="12" x="4" y="6" rx="2" />
              <path d="M8 2h8" />
              <path d="M8 22h8" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Your flashcard deck is empty
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Look up any word or idiom and click{" "}
            <span className="font-medium text-foreground">
              Save to Flashcards
            </span>{" "}
            to schedule it with SM-2 spaced repetition.
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-95"
            >
              Look up words
            </Link>
          </div>
        </section>
      )}

      {/* Empty / Session Complete state: all caught up */}
      {!error && totalCards > 0 && !currentCard && (
        <section className="rounded-2xl border border-emerald-500/25 bg-surface p-8 text-center shadow-xs sm:p-10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {completedCount > 0
              ? "Session complete! Great work."
              : "All caught up for now"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {completedCount > 0
              ? `You reviewed ${completedCount} card${completedCount === 1 ? "" : "s"} in this session.`
              : "You have no due cards waiting right now."}
            {nextUpcomingAt
              ? ` Next card scheduled ${formatUpcomingTime(nextUpcomingAt)}.`
              : ""}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-95"
            >
              Look up new words
            </Link>
            <Link
              href="/vault"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-border/30"
            >
              Browse Vault
            </Link>
          </div>
        </section>
      )}

      {/* Active Flashcard */}
      {currentCard && (
        <div className="space-y-4">
          {!isFlipped ? (
            <div
              onClick={() => setIsFlipped(true)}
              className="cursor-pointer rounded-2xl border border-border bg-surface p-6 shadow-xs transition hover:border-accent/40 sm:p-10"
            >
              <div className="flex min-h-64 flex-col items-center justify-center gap-5 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="rounded-md bg-background px-2.5 py-0.5 text-xs font-medium text-muted italic">
                    {currentCard.entry.part_of_speech}
                  </span>
                  <CefrBadge level={currentCard.entry.cefr_level} />
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {currentCard.entry.word}
                </h2>

                <PronunciationButtons
                  word={currentCard.entry.word}
                  ipaUk={currentCard.entry.ipa_uk}
                  ipaUs={currentCard.entry.ipa_us}
                  audioUkUrl={currentCard.entry.audio_uk_url}
                  audioUsUrl={currentCard.entry.audio_us_url}
                />

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsFlipped(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground shadow-xs transition hover:opacity-95"
                  >
                    Show Answer
                    <kbd className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[11px] sm:inline">
                      Space
                    </kbd>
                  </button>
                  <p className="mt-2.5 text-xs text-muted">
                    Tap card or press Space to reveal meaning
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <article className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-7">
                <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {currentCard.entry.word}
                      </h2>
                      <span className="rounded-md bg-background px-2.5 py-0.5 text-xs font-medium text-muted italic">
                        {currentCard.entry.part_of_speech}
                      </span>
                      <CefrBadge level={currentCard.entry.cefr_level} />
                    </div>

                    <PronunciationButtons
                      word={currentCard.entry.word}
                      ipaUk={currentCard.entry.ipa_uk}
                      ipaUs={currentCard.entry.ipa_us}
                      audioUkUrl={currentCard.entry.audio_uk_url}
                      audioUsUrl={currentCard.entry.audio_us_url}
                    />
                  </div>

                  <div className="text-xs text-muted sm:text-right">
                    <span>
                      Reps: {currentCard.repetitions} · EF:{" "}
                      {currentCard.ease_factor.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <EntryDetailSections entry={currentCard.entry} />
                </div>
              </article>

              {/* 4 SM-2 rating buttons */}
              <section
                aria-label="Rate your recall"
                className="rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-5"
              >
                <div className="mb-3 flex items-center justify-between text-xs text-muted">
                  <span>How well did you recall this word?</span>
                  <span className="hidden sm:inline">Shortcuts: 1 – 4</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {RATING_BUTTONS.map((btn) => (
                    <button
                      key={btn.rating}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleRate(btn.rating)}
                      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${btn.classes}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">
                          {btn.label}
                        </span>
                        <kbd className="py-0.2 hidden rounded border border-current/25 px-1.5 font-mono text-[10px] opacity-80 sm:inline">
                          {btn.shortcut}
                        </kbd>
                      </div>
                      <span className="font-mono text-xs opacity-85">
                        {intervalPreviews?.[btn.rating]}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
