import "server-only";

import {
  DICTIONARY_SYSTEM_PROMPT,
  buildDictionaryUserPrompt,
} from "@/lib/ai/dictionary-prompt";
import {
  DictionaryResponseSchema,
  type DictionaryResponseDTO,
} from "@/lib/ai/dictionary-schema";
import { stripMarkdownCodeFence } from "@/lib/dictionary/partial-json";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";

export class GroqApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GroqApiError";
    this.status = status;
  }
}

export function buildGroqReasoningParams(model: string): {
  reasoning_effort?: "low" | "none";
} {
  const normalized = model.trim();
  if (/^openai\/gpt-oss-/i.test(normalized)) {
    return { reasoning_effort: "low" };
  }
  if (/^qwen\/qwen3/i.test(normalized)) {
    return { reasoning_effort: "none" };
  }
  return {};
}

const GROQ_JSON_SCHEMA = {
  name: "dictionary_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      is_valid: { type: "boolean" },
      suggestion: { type: ["string", "null"] },
      entries: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            word: { type: "string" },
            part_of_speech: { type: "string" },
            cefr_level: {
              type: "string",
              enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
            },
            ipa_uk: { type: "string" },
            ipa_us: { type: "string" },
            definition_en: { type: "string" },
            explanation_vi: { type: "string" },
            nuance_note_vi: { type: "string" },
            collocations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  phrase: { type: "string" },
                  meaning_vi: { type: "string" },
                },
                required: ["phrase", "meaning_vi"],
              },
            },
            synonyms: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  word: { type: "string" },
                  difference_vi: { type: "string" },
                },
                required: ["word", "difference_vi"],
              },
            },
            antonyms: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  word: { type: "string" },
                  meaning_vi: { type: "string" },
                },
                required: ["word", "meaning_vi"],
              },
            },
            examples: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  en: { type: "string" },
                  vi: { type: "string" },
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
  },
} as const;

const GROQ_RAW_JSON_INSTRUCTION =
  'CRITICAL: Output ONLY a single raw JSON object (no markdown code fences, no prose) matching: {"is_valid":boolean,"suggestion":string|null,"entries":[{"word":string,"part_of_speech":string,"cefr_level":"A1"|"A2"|"B1"|"B2"|"C1"|"C2","ipa_uk":string,"ipa_us":string,"definition_en":string,"explanation_vi":string,"nuance_note_vi":string,"collocations":[{"phrase":string,"meaning_vi":string}],"synonyms":[{"word":string,"difference_vi":string}],"antonyms":[{"word":string,"meaning_vi":string}],"examples":[{"en":string,"vi":string}]}]}';

function parseGroqJsonText(rawText: string | undefined): DictionaryResponseDTO {
  const cleaned = rawText ? stripMarkdownCodeFence(rawText).trim() : "";
  if (!cleaned) {
    throw new Error("Empty response from Groq API");
  }
  const parsed: unknown = JSON.parse(cleaned);
  return DictionaryResponseSchema.parse(parsed);
}

async function postGroqChatCompletions(params: {
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<Response> {
  const fetchFn = params.fetchImpl ?? fetch;
  const response = await fetchFn(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.body),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new GroqApiError(
      response.status,
      `Groq API HTTP ${response.status}: ${errorText.slice(0, 300)}`,
    );
  }

  return response;
}

export type GroqEnrichParams = {
  apiKey: string;
  model: string;
  term: string;
  referenceJson?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

export async function enrichWithGroq(
  params: GroqEnrichParams,
): Promise<DictionaryResponseDTO> {
  const response = await postGroqChatCompletions({
    apiKey: params.apiKey,
    signal: params.signal,
    fetchImpl: params.fetchImpl,
    body: {
      model: params.model,
      temperature: 0.2,
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: GROQ_JSON_SCHEMA,
      },
      ...buildGroqReasoningParams(params.model),
      messages: [
        { role: "system", content: DICTIONARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildDictionaryUserPrompt(params.term, params.referenceJson),
        },
      ],
    },
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return parseGroqJsonText(payload.choices?.[0]?.message?.content);
}

export type GroqStreamParams = GroqEnrichParams & {
  onChunk?: (accumulatedText: string) => void;
};

export async function streamWithGroq(
  params: GroqStreamParams,
): Promise<DictionaryResponseDTO> {
  // Omit `response_format` during streaming so Groq pushes incremental SSE tokens
  // immediately instead of buffering structured JSON into a single final chunk.
  const response = await postGroqChatCompletions({
    apiKey: params.apiKey,
    signal: params.signal,
    fetchImpl: params.fetchImpl,
    body: {
      model: params.model,
      temperature: 0.2,
      stream: true,
      ...buildGroqReasoningParams(params.model),
      messages: [
        {
          role: "system",
          content: `${DICTIONARY_SYSTEM_PROMPT}\n\n${GROQ_RAW_JSON_INSTRUCTION}`,
        },
        {
          role: "user",
          content: buildDictionaryUserPrompt(params.term, params.referenceJson),
        },
      ],
    },
  });

  if (!response.body) {
    throw new Error("Empty stream body from Groq API");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";

  const processLine = (rawLine: string) => {
    const trimmed = rawLine.trim();
    if (!trimmed.startsWith("data:")) {
      return;
    }
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") {
      return;
    }
    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        accumulated += delta;
        params.onChunk?.(accumulated);
      }
    } catch {
      // Ignore non-JSON heartbeat/comment SSE payloads.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (params.signal?.aborted) {
      await reader.cancel().catch(() => {});
      throw new DOMException("Aborted", "AbortError");
    }

    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    } else if (done) {
      buffer += decoder.decode();
    }

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processLine(line);
    }

    if (done) {
      if (buffer.trim()) {
        processLine(buffer);
      }
      break;
    }
  }

  return parseGroqJsonText(accumulated);
}
