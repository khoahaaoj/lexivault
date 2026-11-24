import type { DictionaryEntryDTO } from "@/lib/ai/dictionary-schema";
import {
  normalizeLookupTerm,
  type LookupEntryResult,
} from "@/lib/dictionary/validation";
import type { EntryRow } from "@/types/database";

export type SrsCardRelation = { id: string } | { id: string }[] | null;

export type CachedEntryWithCard = EntryRow & {
  srs_cards?: SrsCardRelation;
};

export type SavedEntrySummary = {
  id: string;
  word: string;
  part_of_speech: string;
  srs_cards?: SrsCardRelation;
};

/**
 * Extracts `srs_cards.id` from a PostgREST embedded relation regardless of
 * whether PostgREST serialized the 1:1 foreign key as an object or 1-item array.
 */
export function extractSrsCardId(
  relation: SrsCardRelation | undefined,
): string | null {
  if (!relation) {
    return null;
  }
  if (Array.isArray(relation)) {
    return relation[0]?.id ?? null;
  }
  return relation.id ?? null;
}

export function mapCachedEntryToResult(
  row: CachedEntryWithCard,
): LookupEntryResult {
  const srsCardId = extractSrsCardId(row.srs_cards);
  return {
    id: row.id,
    srs_card_id: srsCardId,
    is_saved: Boolean(srsCardId),
    word: row.word,
    part_of_speech: row.part_of_speech,
    cefr_level: row.cefr_level,
    ipa_uk: row.ipa_uk,
    ipa_us: row.ipa_us,
    audio_uk_url: row.audio_uk_url,
    audio_us_url: row.audio_us_url,
    definition_en: row.definition_en,
    explanation_vi: row.explanation_vi,
    nuance_note_vi: row.nuance_note_vi,
    collocations: row.collocations,
    synonyms: row.synonyms,
    antonyms: row.antonyms,
    examples: row.examples,
  };
}

export function entrySenseKey(word: string, partOfSpeech: string): string {
  return `${normalizeLookupTerm(word)}::${partOfSpeech.trim().toLowerCase()}`;
}

export function normalizeBasePartOfSpeech(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .slice(0, 34);
}

/**
 * Deduplicates exact duplicate `(word, basePos, definition_en)` items while
 * preserving distinct meanings that share the same part of speech (e.g.
 * multiple "phrasal verb" senses of "pick up") by numbering them `pos (1)`, `pos (2)`.
 */
export function disambiguateSamePosSenses<
  T extends { word: string; part_of_speech: string; definition_en: string },
>(entries: readonly T[]): T[] {
  const exactSeen = new Set<string>();
  const deduped: Array<{ item: T; basePos: string; groupKey: string }> = [];
  const groupCounts = new Map<string, number>();

  for (const item of entries) {
    const basePos = normalizeBasePartOfSpeech(item.part_of_speech);
    const trimmedDef = item.definition_en.trim().toLowerCase();

    if (basePos && trimmedDef) {
      const exactKey = `${entrySenseKey(item.word, basePos)}::${trimmedDef}`;
      if (exactSeen.has(exactKey)) {
        continue;
      }
      exactSeen.add(exactKey);
    }

    const groupKey = basePos ? entrySenseKey(item.word, basePos) : "";
    if (groupKey) {
      groupCounts.set(groupKey, (groupCounts.get(groupKey) ?? 0) + 1);
    }
    deduped.push({ item, basePos, groupKey });
  }

  const groupProgress = new Map<string, number>();
  return deduped.map(({ item, basePos, groupKey }) => {
    if (!basePos || !groupKey) {
      return item;
    }
    const totalInGroup = groupCounts.get(groupKey) ?? 1;
    const senseIndex = (groupProgress.get(groupKey) ?? 0) + 1;
    groupProgress.set(groupKey, senseIndex);

    return {
      ...item,
      part_of_speech: totalInGroup > 1 ? `${basePos} (${senseIndex})` : basePos,
    };
  });
}

/**
 * Normalizes AI DTO entries, preserves distinct senses sharing a part of speech
 * (numbering them e.g. `phrasal verb (1)`, `phrasal verb (2)`), attaches real
 * Free Dictionary API MP3 URLs, and hydrates saved status when a lemma exists in DB.
 */
export function buildAiLookupEntries(params: {
  fallbackWord: string;
  aiEntries: readonly DictionaryEntryDTO[];
  audioUkUrl: string | null;
  audioUsUrl: string | null;
  savedRows: readonly SavedEntrySummary[];
}): LookupEntryResult[] {
  const savedByKey = new Map<
    string,
    { id: string; srsCardId: string | null }
  >();
  for (const row of params.savedRows) {
    savedByKey.set(entrySenseKey(row.word, row.part_of_speech), {
      id: row.id,
      srsCardId: extractSrsCardId(row.srs_cards),
    });
  }

  const normalizedInputs = params.aiEntries
    .map((item) => {
      const normalizedWord = normalizeLookupTerm(item.word);
      const word =
        normalizedWord.length >= 1 && normalizedWord.length <= 80
          ? normalizedWord
          : params.fallbackWord;
      const basePos = normalizeBasePartOfSpeech(item.part_of_speech);
      if (!basePos) {
        return null;
      }
      return {
        ...item,
        word,
        part_of_speech: basePos,
      };
    })
    .filter((item): item is DictionaryEntryDTO => item !== null);

  return disambiguateSamePosSenses(normalizedInputs).map((item) => {
    const saved =
      savedByKey.get(entrySenseKey(item.word, item.part_of_speech)) ??
      (/\(1\)$/.test(item.part_of_speech)
        ? savedByKey.get(
            entrySenseKey(
              item.word,
              normalizeBasePartOfSpeech(item.part_of_speech),
            ),
          )
        : undefined);

    return {
      id: saved?.id ?? null,
      srs_card_id: saved?.srsCardId ?? null,
      is_saved: Boolean(saved?.srsCardId),
      word: item.word,
      part_of_speech: item.part_of_speech,
      cefr_level: item.cefr_level,
      ipa_uk: item.ipa_uk.trim(),
      ipa_us: item.ipa_us.trim(),
      audio_uk_url: params.audioUkUrl,
      audio_us_url: params.audioUsUrl,
      definition_en: item.definition_en.trim(),
      explanation_vi: item.explanation_vi.trim(),
      nuance_note_vi: item.nuance_note_vi.trim(),
      collocations: item.collocations,
      synonyms: item.synonyms,
      antonyms: item.antonyms,
      examples: item.examples,
    };
  });
}
