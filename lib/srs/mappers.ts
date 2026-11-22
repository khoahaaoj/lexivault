import { getMasteryStatus } from "@/lib/sm2";
import type {
  DictionaryEntryView,
  SrsCardView,
  VaultCounts,
  VaultEntryItem,
  VaultQueryInput,
} from "@/lib/srs/schemas";
import type { EntryRow } from "@/types/database";

export type EmbeddedEntryRelation =
  EntryRow | DictionaryEntryView | (EntryRow | DictionaryEntryView)[] | null;

export type EmbeddedSrsCardRelation =
  SrsCardView | SrsCardView[] | null | undefined;

export type RawVaultEntryRow = DictionaryEntryView & {
  srs_cards?: EmbeddedSrsCardRelation;
};

export function toDictionaryEntryView(
  entry: EntryRow | DictionaryEntryView,
): DictionaryEntryView {
  return {
    id: entry.id,
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
    created_at: entry.created_at,
  };
}

export function extractEmbeddedEntry(
  relation: EmbeddedEntryRelation | undefined,
): DictionaryEntryView | null {
  if (!relation) {
    return null;
  }
  const item = Array.isArray(relation) ? relation[0] : relation;
  return item ? toDictionaryEntryView(item) : null;
}

export function extractEmbeddedSrsCard(
  relation: EmbeddedSrsCardRelation,
): SrsCardView | null {
  if (!relation) {
    return null;
  }
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation;
}

/**
 * Computes summary counts across all saved entries and applies Vault filters
 * (`q`, `cefr`, `status`).
 */
export function buildVaultListResponse(
  rows: readonly RawVaultEntryRow[],
  filters: VaultQueryInput,
  nowMs: number = Date.now(),
): { counts: VaultCounts; items: VaultEntryItem[] } {
  const counts: VaultCounts = {
    total: 0,
    new: 0,
    learning: 0,
    mastered: 0,
    due: 0,
  };

  const allItems: VaultEntryItem[] = rows.map((row) => {
    const srsCard = extractEmbeddedSrsCard(row.srs_cards);
    const masteryStatus = getMasteryStatus(srsCard);
    const isDue = srsCard
      ? new Date(srsCard.next_review_at).getTime() <= nowMs
      : false;

    counts.total += 1;
    counts[masteryStatus] += 1;
    if (isDue) {
      counts.due += 1;
    }

    return {
      ...toDictionaryEntryView(row),
      srs_card: srsCard,
      mastery_status: masteryStatus,
      is_due: isDue,
    };
  });

  const normalizedQuery = filters.q?.toLowerCase();

  const items = allItems.filter((item) => {
    if (filters.cefr && item.cefr_level !== filters.cefr) {
      return false;
    }
    if (filters.status && item.mastery_status !== filters.status) {
      return false;
    }
    if (normalizedQuery) {
      const matchesWord = item.word.toLowerCase().includes(normalizedQuery);
      const matchesDef = item.definition_en
        .toLowerCase()
        .includes(normalizedQuery);
      const matchesVi = item.explanation_vi
        .toLowerCase()
        .includes(normalizedQuery);
      if (!matchesWord && !matchesDef && !matchesVi) {
        return false;
      }
    }
    return true;
  });

  return { counts, items };
}
