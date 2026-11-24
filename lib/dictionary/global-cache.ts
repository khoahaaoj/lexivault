import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { LookupEntryResult } from "@/lib/dictionary/validation";
import type { Database } from "@/types/database";

const MAX_SERVER_CACHE_ENTRIES = 500;
const SERVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TABLE_COOLDOWN_MS = 5 * 60 * 1000;

export const CachedDictionarySenseSchema = z.object({
  word: z.string().min(1),
  part_of_speech: z.string().min(1),
  cefr_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  ipa_uk: z.string(),
  ipa_us: z.string(),
  audio_uk_url: z.string().nullable(),
  audio_us_url: z.string().nullable(),
  definition_en: z.string().min(1),
  explanation_vi: z.string().min(1),
  nuance_note_vi: z.string(),
  collocations: z.array(
    z.object({
      phrase: z.string(),
      meaning_vi: z.string(),
    }),
  ),
  synonyms: z.array(
    z.object({
      word: z.string(),
      difference_vi: z.string(),
    }),
  ),
  antonyms: z.array(
    z.object({
      word: z.string(),
      meaning_vi: z.string(),
    }),
  ),
  examples: z
    .array(
      z.object({
        en: z.string(),
        vi: z.string(),
      }),
    )
    .min(1),
});

export type CachedDictionarySense = z.infer<typeof CachedDictionarySenseSchema>;

const CachedSenseArraySchema = z.array(CachedDictionarySenseSchema).min(1);

type ServerCacheRecord = {
  senses: CachedDictionarySense[];
  cachedAt: number;
};

export type DictionaryCacheClient = Pick<SupabaseClient<Database>, "from">;

const warmCache = new Map<string, ServerCacheRecord>();
let tableUnavailableUntil = 0;

function isMissingCacheTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "PGRST205" || code === "42P01") {
    return true;
  }
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  return message.includes("dictionary_cache");
}

function setWarmCache(term: string, senses: CachedDictionarySense[]): void {
  if (warmCache.has(term)) {
    warmCache.delete(term);
  }
  warmCache.set(term, {
    senses,
    cachedAt: Date.now(),
  });

  while (warmCache.size > MAX_SERVER_CACHE_ENTRIES) {
    const oldest = warmCache.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    warmCache.delete(oldest);
  }
}

export async function readGlobalDictionaryCache(
  supabase: DictionaryCacheClient,
  term: string,
): Promise<CachedDictionarySense[] | null> {
  const now = Date.now();
  const warmHit = warmCache.get(term);
  if (warmHit) {
    if (now - warmHit.cachedAt <= SERVER_CACHE_TTL_MS) {
      warmCache.delete(term);
      warmCache.set(term, warmHit);
      return warmHit.senses;
    }
    warmCache.delete(term);
  }

  if (now < tableUnavailableUntil) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("dictionary_cache")
      .select("entries, updated_at")
      .eq("term", term)
      .maybeSingle();

    if (error) {
      if (isMissingCacheTableError(error)) {
        tableUnavailableUntil = Date.now() + TABLE_COOLDOWN_MS;
      } else {
        console.warn("Failed to read global dictionary cache:", error.message);
      }
      return null;
    }

    if (!data) {
      return null;
    }

    const parsed = CachedSenseArraySchema.safeParse(data.entries);
    if (!parsed.success) {
      return null;
    }

    setWarmCache(term, parsed.data);
    return parsed.data;
  } catch (caught) {
    if (isMissingCacheTableError(caught)) {
      tableUnavailableUntil = Date.now() + TABLE_COOLDOWN_MS;
    }
    return null;
  }
}

export async function writeGlobalDictionaryCache(
  supabase: DictionaryCacheClient,
  term: string,
  entries: readonly LookupEntryResult[],
): Promise<void> {
  const senses: CachedDictionarySense[] = entries.map((entry) => ({
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
  }));

  if (senses.length === 0) {
    return;
  }

  setWarmCache(term, senses);

  if (Date.now() < tableUnavailableUntil) {
    return;
  }

  try {
    const { error } = await supabase.from("dictionary_cache").upsert(
      {
        term,
        entries: senses,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "term" },
    );

    if (error) {
      if (isMissingCacheTableError(error)) {
        tableUnavailableUntil = Date.now() + TABLE_COOLDOWN_MS;
      } else {
        console.warn("Failed to write global dictionary cache:", error.message);
      }
    }
  } catch (caught) {
    if (isMissingCacheTableError(caught)) {
      tableUnavailableUntil = Date.now() + TABLE_COOLDOWN_MS;
    }
  }
}

export function resetGlobalDictionaryCacheForTests(): void {
  warmCache.clear();
  tableUnavailableUntil = 0;
}
