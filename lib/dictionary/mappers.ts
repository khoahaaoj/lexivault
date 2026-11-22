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

/**
 * Normalizes Gemini DTO entries, deduplicates `(word, part_of_speech)` senses,
 * attaches real Free Dictionary API MP3 URLs, and hydrates saved status when a
 * lemma (e.g. searching "mitigating" -> lemma "mitigate") already exists in DB.
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

  const seenKeys = new Set<string>();
  const results: LookupEntryResult[] = [];

  for (const item of params.aiEntries) {
    const normalizedWord = normalizeLookupTerm(item.word);
    const word =
      normalizedWord.length >= 1 && normalizedWord.length <= 80
        ? normalizedWord
        : params.fallbackWord;
    const partOfSpeech = item.part_of_speech.trim().toLowerCase().slice(0, 40);
    if (!partOfSpeech) {
      continue;
    }

    const key = entrySenseKey(word, partOfSpeech);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    const saved = savedByKey.get(key);
    results.push({
      id: saved?.id ?? null,
      srs_card_id: saved?.srsCardId ?? null,
      is_saved: Boolean(saved?.srsCardId),
      word,
      part_of_speech: partOfSpeech,
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
    });
  }

  return results;
}
