"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CefrBadge,
  EntryDetailSections,
  PronunciationButtons,
} from "@/components/dictionary/entry-details";
import { formatReviewInterval, type MasteryStatus } from "@/lib/sm2";
import type {
  VaultCounts,
  VaultEntryItem,
  VaultListResponse,
} from "@/lib/srs/schemas";
import type { CefrLevel } from "@/types/database";

const CEFR_LEVELS: readonly CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

const STATUS_OPTIONS: ReadonlyArray<{
  value: "all" | MasteryStatus;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "mastered", label: "Mastered" },
];

const MASTERY_BADGE_CLASSES: Record<MasteryStatus, string> = {
  new: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  learning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  mastered:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

const MASTERY_LABELS: Record<MasteryStatus, string> = {
  new: "New",
  learning: "Learning",
  mastered: "Mastered",
};

function formatNextReviewLabel(item: VaultEntryItem): string {
  if (!item.srs_card) {
    return "No flashcard";
  }
  if (item.is_due) {
    return "Due now";
  }
  const date = new Date(item.srs_card.next_review_at);
  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }
  return `Next: ${date.toLocaleDateString()}`;
}

function VaultSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading vault" className="space-y-4">
      <div className="h-36 w-full animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="h-28 w-full animate-pulse rounded-2xl border border-border bg-surface" />
      <div className="h-28 w-full animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}

async function fetchVaultData(): Promise<
  { ok: true; data: VaultListResponse } | { ok: false; error: string }
> {
  try {
    const response = await fetch("/api/vault", { cache: "no-store" });
    const data = (await response.json()) as
      VaultListResponse | { error?: string };

    if (!response.ok || !("items" in data)) {
      return {
        ok: false,
        error:
          "error" in data && data.error
            ? data.error
            : "Unable to load saved vocabulary.",
      };
    }

    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "Network error while loading your Vault. Please try again.",
    };
  }
}

export function VaultWorkspace() {
  const [items, setItems] = useState<VaultEntryItem[]>([]);
  const [counts, setCounts] = useState<VaultCounts>({
    total: 0,
    new: 0,
    learning: 0,
    mastered: 0,
    due: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState<"all" | CefrLevel>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | MasteryStatus>(
    "all",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedEntry, setSelectedEntry] = useState<VaultEntryItem | null>(
    null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const applyVaultOutcome = useCallback(
    (outcome: Awaited<ReturnType<typeof fetchVaultData>>) => {
      if (outcome.ok) {
        setItems(outcome.data.items);
        setCounts(outcome.data.counts);
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
    void fetchVaultData().then((outcome) => {
      if (!cancelled) {
        applyVaultOutcome(outcome);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applyVaultOutcome]);

  async function handleRetry() {
    setIsLoading(true);
    setError(null);
    const outcome = await fetchVaultData();
    applyVaultOutcome(outcome);
  }

  useEffect(() => {
    if (!selectedEntry) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        setSelectedEntry(null);
        setConfirmingDelete(false);
        setDeleteError(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDeleting, selectedEntry]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (cefrFilter !== "all" && item.cefr_level !== cefrFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.mastery_status !== statusFilter) {
        return false;
      }
      if (q) {
        const matchesWord = item.word.toLowerCase().includes(q);
        const matchesDef = item.definition_en.toLowerCase().includes(q);
        const matchesVi = item.explanation_vi.toLowerCase().includes(q);
        if (!matchesWord && !matchesDef && !matchesVi) {
          return false;
        }
      }
      return true;
    });
  }, [cefrFilter, items, searchQuery, statusFilter]);

  function openDetail(entry: VaultEntryItem) {
    setSelectedEntry(entry);
    setConfirmingDelete(false);
    setDeleteError(null);
  }

  function closeDetail() {
    if (isDeleting) {
      return;
    }
    setSelectedEntry(null);
    setConfirmingDelete(false);
    setDeleteError(null);
  }

  async function handleDelete(entry: VaultEntryItem) {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/vault/${entry.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        deleted_id?: string;
        error?: string;
      };

      if (!response.ok || !data.deleted_id) {
        setDeleteError(data.error ?? "Failed to delete vocabulary entry.");
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== entry.id));
      setCounts((prev) => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        [entry.mastery_status]: Math.max(0, prev[entry.mastery_status] - 1),
        due: entry.is_due ? Math.max(0, prev.due - 1) : prev.due,
      }));
      setSelectedEntry(null);
      setConfirmingDelete(false);
    } catch {
      setDeleteError("Network error while deleting entry. Please retry.");
    } finally {
      setIsDeleting(false);
    }
  }

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    cefrFilter !== "all" ||
    statusFilter !== "all";

  if (isLoading) {
    return <VaultSkeleton />;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header + Stats + Search & Filters */}
      <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Vocabulary Vault
            </h1>
            <p className="mt-1 text-sm text-muted">
              Search, filter by CEFR or mastery, inspect bilingual notes, and
              manage your flashcards.
            </p>
          </div>

          {counts.due > 0 && (
            <Link
              href="/review"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-medium text-accent-foreground transition hover:opacity-95"
            >
              Review {counts.due} due
            </Link>
          )}
        </div>

        {/* Summary pills */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[11px] font-medium text-muted uppercase">
              Total
            </p>
            <p className="text-lg font-semibold text-foreground">
              {counts.total}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[11px] font-medium text-muted uppercase">
              Due Now
            </p>
            <p className="text-lg font-semibold text-accent">{counts.due}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[11px] font-medium text-muted uppercase">New</p>
            <p className="text-lg font-semibold text-sky-600 dark:text-sky-300">
              {counts.new}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[11px] font-medium text-muted uppercase">
              Learning
            </p>
            <p className="text-lg font-semibold text-amber-600 dark:text-amber-300">
              {counts.learning}
            </p>
          </div>
          <div className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 sm:col-span-1">
            <p className="text-[11px] font-medium text-muted uppercase">
              Mastered
            </p>
            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">
              {counts.mastered}
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        {counts.total > 0 && (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            <div className="relative">
              <label htmlFor="vault-search" className="sr-only">
                Filter saved vocabulary
              </label>
              <input
                id="vault-search"
                type="search"
                value={searchQuery}
                maxLength={80}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search saved words or meanings..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 font-medium text-muted">Status:</span>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={`rounded-lg border px-2.5 py-1 font-medium transition ${
                    statusFilter === opt.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 font-medium text-muted">CEFR:</span>
              <button
                type="button"
                onClick={() => setCefrFilter("all")}
                className={`rounded-lg border px-2.5 py-1 font-medium transition ${
                  cefrFilter === "all"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                All
              </button>
              {CEFR_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCefrFilter(level)}
                  className={`rounded-lg border px-2.5 py-1 font-medium transition ${
                    cefrFilter === level
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
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

      {/* Empty state: zero words */}
      {!error && counts.total === 0 && (
        <section className="rounded-2xl border border-border bg-surface p-8 text-center shadow-xs sm:p-10">
          <h2 className="text-lg font-semibold text-foreground">
            Your Vault is empty
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Words you save from Lookup will appear here with their bilingual
            notes and spaced-repetition mastery level.
          </p>
          <div className="mt-5">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-95"
            >
              Look up your first word
            </Link>
          </div>
        </section>
      )}

      {/* Empty state: filters returned nothing */}
      {!error && counts.total > 0 && filteredItems.length === 0 && (
        <section className="rounded-2xl border border-border bg-surface p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-foreground">
            No saved words match your current filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCefrFilter("all");
                setStatusFilter("all");
              }}
              className="mt-3 rounded-xl border border-border bg-background px-4 py-2 text-xs font-medium text-foreground transition hover:bg-border/30"
            >
              Reset filters
            </button>
          )}
        </section>
      )}

      {/* Word cards */}
      {filteredItems.length > 0 && (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => openDetail(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDetail(item);
                }
              }}
              className="cursor-pointer rounded-2xl border border-border bg-surface p-4 text-left shadow-xs transition hover:border-accent/40 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                      {item.word}
                    </h2>
                    <span className="rounded-md bg-background px-2 py-0.5 text-xs font-medium text-muted italic">
                      {item.part_of_speech}
                    </span>
                    <CefrBadge level={item.cefr_level} />
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${MASTERY_BADGE_CLASSES[item.mastery_status]}`}
                    >
                      {MASTERY_LABELS[item.mastery_status]}
                    </span>
                    {item.is_due && (
                      <span className="rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                        Due
                      </span>
                    )}
                  </div>

                  <p className="line-clamp-1 text-sm text-foreground/90">
                    {item.definition_en}
                  </p>
                  <p className="line-clamp-1 text-xs text-muted">
                    {item.explanation_vi}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <PronunciationButtons
                    word={item.word}
                    ipaUk={item.ipa_uk}
                    ipaUs={item.ipa_us}
                    audioUkUrl={item.audio_uk_url}
                    audioUsUrl={item.audio_us_url}
                    compact
                  />
                  <span className="text-[11px] text-muted">
                    {formatNextReviewLabel(item)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-modal-title"
          onClick={closeDetail}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-xs sm:items-center sm:p-4"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 shadow-xl sm:rounded-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="vault-modal-title"
                    className="text-2xl font-bold tracking-tight text-foreground"
                  >
                    {selectedEntry.word}
                  </h2>
                  <span className="rounded-md bg-background px-2.5 py-0.5 text-xs font-medium text-muted italic">
                    {selectedEntry.part_of_speech}
                  </span>
                  <CefrBadge level={selectedEntry.cefr_level} />
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-medium ${MASTERY_BADGE_CLASSES[selectedEntry.mastery_status]}`}
                  >
                    {MASTERY_LABELS[selectedEntry.mastery_status]}
                  </span>
                </div>

                <PronunciationButtons
                  word={selectedEntry.word}
                  ipaUk={selectedEntry.ipa_uk}
                  ipaUs={selectedEntry.ipa_us}
                  audioUkUrl={selectedEntry.audio_uk_url}
                  audioUsUrl={selectedEntry.audio_us_url}
                />
              </div>

              <button
                type="button"
                aria-label="Close word details"
                disabled={isDeleting}
                onClick={closeDetail}
                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {selectedEntry.srs_card && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-background px-4 py-2.5 text-xs text-muted">
                <span>
                  Ease:{" "}
                  <strong className="text-foreground">
                    {selectedEntry.srs_card.ease_factor.toFixed(2)}
                  </strong>
                </span>
                <span>
                  Interval:{" "}
                  <strong className="text-foreground">
                    {formatReviewInterval(selectedEntry.srs_card.interval_days)}
                  </strong>
                </span>
                <span>
                  Reps:{" "}
                  <strong className="text-foreground">
                    {selectedEntry.srs_card.repetitions}
                  </strong>
                </span>
                <span>
                  Schedule:{" "}
                  <strong className="text-foreground">
                    {formatNextReviewLabel(selectedEntry)}
                  </strong>
                </span>
              </div>
            )}

            <div className="mt-5">
              <EntryDetailSections entry={selectedEntry} />
            </div>

            {/* Delete footer with confirmation */}
            <div className="mt-6 border-t border-border pt-4">
              {deleteError && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                  {deleteError}
                </p>
              )}

              {!confirmingDelete ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-300"
                  >
                    Delete from Vault
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-medium text-rose-800 dark:text-rose-200">
                    Delete “{selectedEntry.word}” and its flashcard progress?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-background disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void handleDelete(selectedEntry)}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {isDeleting ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
