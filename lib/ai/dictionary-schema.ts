import "server-only";
import {
  GoogleGenAI,
  ThinkingLevel,
  Type,
  type GenerateContentConfig,
  type Schema,
} from "@google/genai";
import { z } from "zod";

import {
  GROQ_FALLBACK_MODEL,
  GroqApiError,
  enrichWithGroq,
  streamWithGroq,
} from "@/lib/ai/groq-provider";
import { getServerEnv } from "@/lib/env/server";
import {
  DICTIONARY_SYSTEM_PROMPT,
  buildDictionaryUserPrompt,
} from "./dictionary-prompt";

export const FALLBACK_GEMINI_MODEL = "gemini-3.1-flash-lite";

const GROQ_WITH_GEMINI_FAILOVER_TIMEOUT_MS = 8_000;
const GROQ_PRIMARY_ONLY_TIMEOUT_MS = 12_000;
const GROQ_FALLBACK_ONLY_TIMEOUT_MS = 15_000;
const PRIMARY_WITH_FALLBACK_TIMEOUT_MS = 12_000;
const STANDALONE_TIMEOUT_MS = 18_000;
const GEMINI_3_FLASH_LITE_PATTERN = /^gemini-3(?:\.\d+)?-flash-lite(?:$|-)/i;

/**
 * Gemini 3.x Flash-Lite models support `ThinkingLevel.MINIMAL`, which cuts
 * reasoning overhead and reduces latency without harming structured output.
 * Other models (e.g. `gemini-3.8-flash`) reject `MINIMAL` with 400.
 */
export function supportsMinimalThinking(model: string): boolean {
  return GEMINI_3_FLASH_LITE_PATTERN.test(model.trim());
}

/**
 * Returns true for transient upstream availability or timeout errors that
 * should trigger an automatic fallback attempt (when the caller did not abort).
 */
export function isTransientGeminiError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  if (name === "AbortError" || name === "TimeoutError") {
    return true;
  }

  const status =
    "status" in error && typeof error.status === "number" ? error.status : null;
  if (status === 503 || status === 504) {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  return (
    message.includes("503") ||
    message.includes("504") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE_EXCEEDED") ||
    message.toLowerCase().includes("high demand")
  );
}

function createAttemptSignal(
  timeoutMs: number,
  callerSignal?: AbortSignal,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
}

function buildGeminiConfig(
  model: string,
  abortSignal?: AbortSignal,
): GenerateContentConfig {
  const config: GenerateContentConfig = {
    systemInstruction: DICTIONARY_SYSTEM_PROMPT,
    responseMimeType: "application/json",
    responseSchema: GEMINI_RESPONSE_SCHEMA,
    temperature: 0.2,
    ...(abortSignal ? { abortSignal } : {}),
  };

  if (supportsMinimalThinking(model)) {
    config.thinkingConfig = {
      thinkingLevel: ThinkingLevel.MINIMAL,
    };
  }

  return config;
}

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

function parseAndValidateGeminiJson(
  rawText: string | undefined,
): DictionaryResponseDTO {
  if (!rawText) {
    throw new Error("Empty response from Gemini API");
  }
  const parsed: unknown = JSON.parse(rawText);
  return DictionaryResponseSchema.parse(parsed);
}

async function executeWithFallback<T>(
  primaryModel: string,
  callerSignal: AbortSignal | undefined,
  runAttempt: (model: string, abortSignal: AbortSignal) => Promise<T>,
  onFallback?: () => void,
): Promise<T> {
  const canFallback = primaryModel !== FALLBACK_GEMINI_MODEL;
  const primaryTimeoutMs = canFallback
    ? PRIMARY_WITH_FALLBACK_TIMEOUT_MS
    : STANDALONE_TIMEOUT_MS;

  try {
    return await runAttempt(
      primaryModel,
      createAttemptSignal(primaryTimeoutMs, callerSignal),
    );
  } catch (error) {
    if (
      canFallback &&
      !callerSignal?.aborted &&
      isTransientGeminiError(error)
    ) {
      onFallback?.();
      return runAttempt(
        FALLBACK_GEMINI_MODEL,
        createAttemptSignal(STANDALONE_TIMEOUT_MS, callerSignal),
      );
    }
    throw error;
  }
}

function isTransientGroqError(error: unknown): boolean {
  if (error instanceof GroqApiError) {
    return error.status === 429 || error.status >= 500;
  }
  return isTransientGeminiError(error);
}

async function routeWithFailover<T>(params: {
  callerSignal?: AbortSignal;
  onReset?: () => void;
  runGroq: (
    apiKey: string,
    model: string,
    abortSignal: AbortSignal,
  ) => Promise<T>;
  runGemini: (
    apiKey: string,
    model: string,
    abortSignal: AbortSignal,
  ) => Promise<T>;
}): Promise<T> {
  const { GROQ_API_KEY, GROQ_MODEL, GEMINI_API_KEY, GEMINI_MODEL } =
    getServerEnv();

  const attemptGemini = () => {
    if (!GEMINI_API_KEY) {
      throw new Error("No Gemini API key configured.");
    }
    return executeWithFallback(
      GEMINI_MODEL,
      params.callerSignal,
      (model, abortSignal) =>
        params.runGemini(GEMINI_API_KEY, model, abortSignal),
      params.onReset,
    );
  };

  if (GROQ_API_KEY && GEMINI_API_KEY) {
    try {
      return await params.runGroq(
        GROQ_API_KEY,
        GROQ_MODEL,
        createAttemptSignal(
          GROQ_WITH_GEMINI_FAILOVER_TIMEOUT_MS,
          params.callerSignal,
        ),
      );
    } catch (error) {
      if (params.callerSignal?.aborted) {
        throw error;
      }
      console.warn(
        "Groq primary failed, failing over to Gemini:",
        error instanceof Error ? error.message : error,
      );
      params.onReset?.();
      return attemptGemini();
    }
  }

  if (GROQ_API_KEY) {
    try {
      return await params.runGroq(
        GROQ_API_KEY,
        GROQ_MODEL,
        createAttemptSignal(GROQ_PRIMARY_ONLY_TIMEOUT_MS, params.callerSignal),
      );
    } catch (error) {
      if (
        !params.callerSignal?.aborted &&
        GROQ_MODEL !== GROQ_FALLBACK_MODEL &&
        isTransientGroqError(error)
      ) {
        params.onReset?.();
        return params.runGroq(
          GROQ_API_KEY,
          GROQ_FALLBACK_MODEL,
          createAttemptSignal(
            GROQ_FALLBACK_ONLY_TIMEOUT_MS,
            params.callerSignal,
          ),
        );
      }
      throw error;
    }
  }

  if (GEMINI_API_KEY) {
    return attemptGemini();
  }

  throw new Error("No AI provider API key is configured.");
}

export type EnrichWordOptions = {
  signal?: AbortSignal;
};

export async function enrichWordWithGemini(
  term: string,
  referenceJson?: string | null,
  options?: EnrichWordOptions,
): Promise<DictionaryResponseDTO> {
  return routeWithFailover({
    callerSignal: options?.signal,
    runGroq: (apiKey, model, abortSignal) =>
      enrichWithGroq({
        apiKey,
        model,
        term,
        referenceJson,
        signal: abortSignal,
      }),
    runGemini: async (apiKey, model, abortSignal) => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model,
        contents: buildDictionaryUserPrompt(term, referenceJson),
        config: buildGeminiConfig(model, abortSignal),
      });
      return parseAndValidateGeminiJson(response.text);
    },
  });
}

export type StreamWordOptions = {
  referenceJson?: string | null;
  signal?: AbortSignal;
  onChunk?: (accumulatedText: string) => void;
  onReset?: () => void;
};

export async function streamWordWithGemini(
  term: string,
  options?: StreamWordOptions,
): Promise<DictionaryResponseDTO> {
  return routeWithFailover({
    callerSignal: options?.signal,
    onReset: options?.onReset,
    runGroq: (apiKey, model, abortSignal) =>
      streamWithGroq({
        apiKey,
        model,
        term,
        referenceJson: options?.referenceJson,
        signal: abortSignal,
        onChunk: options?.onChunk,
      }),
    runGemini: async (apiKey, model, abortSignal) => {
      const ai = new GoogleGenAI({ apiKey });
      const stream = await ai.models.generateContentStream({
        model,
        contents: buildDictionaryUserPrompt(term, options?.referenceJson),
        config: buildGeminiConfig(model, abortSignal),
      });

      let accumulated = "";
      for await (const chunk of stream) {
        if (options?.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        if (chunk.text) {
          accumulated += chunk.text;
          options?.onChunk?.(accumulated);
        }
      }
      return parseAndValidateGeminiJson(accumulated);
    },
  });
}

export const enrichWordWithAi = enrichWordWithGemini;
export const streamWordWithAi = streamWordWithGemini;
