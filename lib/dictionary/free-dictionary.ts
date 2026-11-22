import { z } from "zod";

const FREE_DICTIONARY_API_BASE =
  "https://api.dictionaryapi.dev/api/v2/entries/en";
const REQUEST_TIMEOUT_MS = 5000;
const MAX_DEFINITIONS_PER_POS = 3;

const UK_AUDIO_PATTERN = /(?:^|[-_/])(uk|gb)(?:[-_./]|$)/i;
const US_AUDIO_PATTERN = /(?:^|[-_/])us(?:[-_./]|$)/i;

const rawPhoneticSchema = z.object({
  text: z.string().optional(),
  audio: z.string().optional(),
});

const rawMeaningSchema = z.object({
  partOfSpeech: z.string().optional(),
  definitions: z
    .array(
      z.object({
        definition: z.string().optional(),
      }),
    )
    .optional(),
});

const rawEntrySchema = z.object({
  word: z.string().optional(),
  phonetics: z.array(rawPhoneticSchema).optional(),
  meanings: z.array(rawMeaningSchema).optional(),
});

const rawResponseSchema = z.array(rawEntrySchema);

export type FreeDictionaryResult = {
  audioUkUrl: string | null;
  audioUsUrl: string | null;
  referenceJson: string | null;
};

const EMPTY_RESULT: FreeDictionaryResult = {
  audioUkUrl: null,
  audioUsUrl: null,
  referenceJson: null,
};

/**
 * Validates and upgrades a Free Dictionary audio URL to HTTPS `.mp3`.
 * Returns `null` for empty, non-HTTPS, or non-MP3 URLs.
 */
export function normalizeAudioUrl(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const withProtocol = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "https:") {
      return null;
    }
    if (!/\.mp3$/i.test(parsed.pathname)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Extracts the first UK and first US `.mp3` audio URLs from Free Dictionary
 * phonetic entries using separator-bounded segment matching on URL pathnames.
 */
export function extractAudioUrls(
  phonetics: ReadonlyArray<{ audio?: string }>,
): { audioUkUrl: string | null; audioUsUrl: string | null } {
  let audioUkUrl: string | null = null;
  let audioUsUrl: string | null = null;

  for (const phonetic of phonetics) {
    const url = normalizeAudioUrl(phonetic.audio);
    if (!url) {
      continue;
    }

    const { pathname } = new URL(url);
    if (!audioUkUrl && UK_AUDIO_PATTERN.test(pathname)) {
      audioUkUrl = url;
    } else if (!audioUsUrl && US_AUDIO_PATTERN.test(pathname)) {
      audioUsUrl = url;
    }

    if (audioUkUrl && audioUsUrl) {
      break;
    }
  }

  return { audioUkUrl, audioUsUrl };
}

/**
 * Parses and condenses the Free Dictionary API JSON payload into:
 * - Real UK/US `.mp3` audio URLs (never fabricated)
 * - Compact `referenceJson` containing only `word`, deduplicated IPA `phonetics`,
 *   and `meanings` with `partOfSpeech` + at most 3 definitions per part of speech.
 */
export function parseFreeDictionaryPayload(raw: unknown): FreeDictionaryResult {
  const parsed = rawResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.length === 0) {
    return EMPTY_RESULT;
  }

  const items = parsed.data;
  const allPhonetics = items.flatMap((item) => item.phonetics ?? []);
  const { audioUkUrl, audioUsUrl } = extractAudioUrls(allPhonetics);

  const primaryWord =
    items.find((item) => item.word?.trim())?.word?.trim() ?? null;
  if (!primaryWord) {
    return { audioUkUrl, audioUsUrl, referenceJson: null };
  }

  const ipaTexts = Array.from(
    new Set(
      allPhonetics
        .map((phonetic) => phonetic.text?.trim() ?? "")
        .filter((text) => text.length > 0),
    ),
  );

  const meaningsByPos = new Map<string, string[]>();
  for (const item of items) {
    for (const meaning of item.meanings ?? []) {
      const partOfSpeech = meaning.partOfSpeech?.trim();
      if (!partOfSpeech) {
        continue;
      }

      const defs = meaningsByPos.get(partOfSpeech) ?? [];
      for (const def of meaning.definitions ?? []) {
        if (defs.length >= MAX_DEFINITIONS_PER_POS) {
          break;
        }
        const text = def.definition?.trim();
        if (text && !defs.includes(text)) {
          defs.push(text);
        }
      }
      if (defs.length > 0) {
        meaningsByPos.set(partOfSpeech, defs);
      }
    }
  }

  const meanings = Array.from(meaningsByPos.entries()).map(
    ([partOfSpeech, definitions]) => ({
      partOfSpeech,
      definitions,
    }),
  );

  if (ipaTexts.length === 0 && meanings.length === 0) {
    return { audioUkUrl, audioUsUrl, referenceJson: null };
  }

  return {
    audioUkUrl,
    audioUsUrl,
    referenceJson: JSON.stringify({
      word: primaryWord,
      phonetics: ipaTexts,
      meanings,
    }),
  };
}

/**
 * Fetches grounding metadata and real pronunciation MP3 links from Free
 * Dictionary API. Fails open (returning empty metadata) on 404s (e.g. idioms
 * and phrasal verbs), timeouts, or upstream errors so Gemini can still respond.
 */
export async function fetchFreeDictionaryReference(
  term: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FreeDictionaryResult> {
  const url = `${FREE_DICTIONARY_API_BASE}/${encodeURIComponent(term)}`;

  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) {
      return EMPTY_RESULT;
    }

    if (!response.ok) {
      console.warn(
        `Free Dictionary API returned HTTP ${response.status} for "${term}"`,
      );
      return EMPTY_RESULT;
    }

    const payload: unknown = await response.json();
    return parseFreeDictionaryPayload(payload);
  } catch (error) {
    console.warn(`Free Dictionary API lookup failed for "${term}":`, error);
    return EMPTY_RESULT;
  }
}
