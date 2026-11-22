import { z } from "zod";

import type {
  Antonym,
  CefrLevel,
  Collocation,
  ExampleSentence,
  Synonym,
} from "@/types/database";

export const MAX_LOOKUP_TERM_LENGTH = 80;

const ALLOWED_TERM_PATTERN = /^(?=.*[a-z])[a-z '-]+$/;

/**
 * Normalizes a lookup term for cache keys and validation:
 * trims surrounding whitespace, converts curly apostrophes to ASCII `'`,
 * collapses repeated internal whitespace, and lowercases.
 */
export function normalizeLookupTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export const lookupTermSchema = z
  .string({ error: "Please enter a word or phrase to look up." })
  .max(200, {
    error: `Search term must be ${MAX_LOOKUP_TERM_LENGTH} characters or fewer.`,
  })
  .transform(normalizeLookupTerm)
  .pipe(
    z
      .string()
      .min(1, { error: "Please enter a word or phrase to look up." })
      .max(MAX_LOOKUP_TERM_LENGTH, {
        error: `Search term must be ${MAX_LOOKUP_TERM_LENGTH} characters or fewer.`,
      })
      .regex(ALLOWED_TERM_PATTERN, {
        error:
          "Only English letters, spaces, hyphens (-), and apostrophes (') are allowed.",
      }),
  );

export const lookupRequestSchema = z.object({
  term: lookupTermSchema,
});

const httpsAudioUrlSchema = z
  .union([z.url({ protocol: /^https$/ }), z.null()])
  .optional()
  .transform((value) => value ?? null);

export const saveEntryRequestSchema = z.object({
  word: lookupTermSchema,
  part_of_speech: z.string().trim().toLowerCase().min(1).max(40),
  cefr_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  ipa_uk: z.string().trim().max(120),
  ipa_us: z.string().trim().max(120),
  audio_uk_url: httpsAudioUrlSchema,
  audio_us_url: httpsAudioUrlSchema,
  definition_en: z.string().trim().min(1).max(2000),
  explanation_vi: z.string().trim().min(1).max(4000),
  nuance_note_vi: z.string().trim().max(4000).default(""),
  collocations: z.array(
    z.object({
      phrase: z.string().trim().min(1),
      meaning_vi: z.string().trim().min(1),
    }),
  ),
  synonyms: z.array(
    z.object({
      word: z.string().trim().min(1),
      difference_vi: z.string().trim().min(1),
    }),
  ),
  antonyms: z.array(
    z.object({
      word: z.string().trim().min(1),
      meaning_vi: z.string().trim().min(1),
    }),
  ),
  examples: z
    .array(
      z.object({
        en: z.string().trim().min(1),
        vi: z.string().trim().min(1),
      }),
    )
    .min(1)
    .max(3),
});

export type SaveEntryRequest = z.infer<typeof saveEntryRequestSchema>;

export type LookupEntryResult = {
  id: string | null;
  srs_card_id: string | null;
  is_saved: boolean;
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

export type LookupApiResponse = {
  source: "cache" | "ai";
  query: string;
  is_valid: boolean;
  suggestion: string | null;
  entries: LookupEntryResult[];
};
