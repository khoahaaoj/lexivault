import "server-only";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { z } from "zod";

import { getServerEnv } from "@/lib/env/server";
import {
  DICTIONARY_SYSTEM_PROMPT,
  buildDictionaryUserPrompt,
} from "./dictionary-prompt";

export const DictionaryEntrySchema = z.object({
  word: z.string().min(1),
  part_of_speech: z.string().min(1),
  cefr_level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  ipa_uk: z.string().min(1),
  ipa_us: z.string().min(1),
  definition_en: z.string().min(1),
  explanation_vi: z.string().min(1),
  nuance_note_vi: z.string().min(1),
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
    .min(1)
    .max(3),
});

export const DictionaryResponseSchema = z.object({
  is_valid: z.boolean(),
  suggestion: z.string().nullable(),
  entries: z.array(DictionaryEntrySchema),
});

export type DictionaryEntryDTO = z.infer<typeof DictionaryEntrySchema>;
export type DictionaryResponseDTO = z.infer<typeof DictionaryResponseSchema>;

export const GEMINI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    is_valid: { type: Type.BOOLEAN },
    suggestion: { type: Type.STRING, nullable: true },
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          part_of_speech: { type: Type.STRING },
          cefr_level: {
            type: Type.STRING,
            enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
          },
          ipa_uk: { type: Type.STRING },
          ipa_us: { type: Type.STRING },
          definition_en: { type: Type.STRING },
          explanation_vi: { type: Type.STRING },
          nuance_note_vi: { type: Type.STRING },
          collocations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                meaning_vi: { type: Type.STRING },
              },
              required: ["phrase", "meaning_vi"],
            },
          },
          synonyms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                difference_vi: { type: Type.STRING },
              },
              required: ["word", "difference_vi"],
            },
          },
          antonyms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                meaning_vi: { type: Type.STRING },
              },
              required: ["word", "meaning_vi"],
            },
          },
          examples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                vi: { type: Type.STRING },
              },
              required: ["en", "vi"],
            },
          },
        },
        required: [
          "word",
          "part_of_speech",
          "cefr_level",
          "ipa_uk",
          "ipa_us",
          "definition_en",
          "explanation_vi",
          "nuance_note_vi",
          "collocations",
          "synonyms",
          "antonyms",
          "examples",
        ],
      },
    },
  },
  required: ["is_valid", "suggestion", "entries"],
};

export async function enrichWordWithGemini(
  term: string,
  referenceJson?: string | null,
): Promise<DictionaryResponseDTO> {
  const { GEMINI_API_KEY, GEMINI_MODEL } = getServerEnv();

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildDictionaryUserPrompt(term, referenceJson),
    config: {
      systemInstruction: DICTIONARY_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error("Empty response from Gemini API");
  }

  const parsed: unknown = JSON.parse(rawText);
  return DictionaryResponseSchema.parse(parsed);
}
