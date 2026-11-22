import type { LookupApiResponse } from "@/lib/dictionary/validation";
import type {
  Antonym,
  CefrLevel,
  Collocation,
  ExampleSentence,
  Synonym,
} from "@/types/database";

export type LookupPreviewMeaning = {
  part_of_speech: string;
  definitions: string[];
};

export type LookupPreviewData = {
  query: string;
  word: string;
  ipa_texts: string[];
  audio_uk_url: string | null;
  audio_us_url: string | null;
  meanings: LookupPreviewMeaning[];
};

export type PartialLookupEntry = {
  word: string;
  part_of_speech: string;
  cefr_level: CefrLevel | null;
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

export type PartialLookupPayload = {
  query: string;
  entries: PartialLookupEntry[];
};

export type LookupStreamEvent =
  | { type: "cache"; data: LookupApiResponse }
  | { type: "preview"; data: LookupPreviewData }
  | { type: "partial"; data: PartialLookupPayload }
  | { type: "final"; data: LookupApiResponse }
  | { type: "error"; error: string; status: number };
