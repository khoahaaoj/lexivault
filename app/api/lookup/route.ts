import { NextResponse } from "next/server";
import { z } from "zod";

import {
  enrichWordWithGemini,
  streamWordWithGemini,
  type DictionaryResponseDTO,
} from "@/lib/ai/dictionary-schema";
import { requireApiUser } from "@/lib/auth/session";
import {
  buildLookupPreview,
  fetchFreeDictionaryReference,
  type FreeDictionaryResult,
} from "@/lib/dictionary/free-dictionary";
import {
  readGlobalDictionaryCache,
  writeGlobalDictionaryCache,
} from "@/lib/dictionary/global-cache";
import {
  buildAiLookupEntries,
  entrySenseKey,
  extractSrsCardId,
  mapCachedEntryToResult,
} from "@/lib/dictionary/mappers";
import { parsePartialDictionaryResponse } from "@/lib/dictionary/partial-json";
import type { LookupStreamEvent } from "@/lib/dictionary/stream";
import {
  lookupRequestSchema,
  normalizeLookupTerm,
  type LookupApiResponse,
  type LookupEntryResult,
} from "@/lib/dictionary/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const PARTIAL_EMIT_INTERVAL_MS = 80;
const NDJSON_HEADERS = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no",
} as const;

function getErrorDetails(error: unknown): {
  name: string;
  status: number | null;
  message: string;
} {
  if (!error || typeof error !== "object") {
    return { name: "", status: null, message: "" };
  }
  return {
    name: "name" in error && typeof error.name === "string" ? error.name : "",
    status:
      "status" in error && typeof error.status === "number"
        ? error.status
        : null,
    message:
      "message" in error && typeof error.message === "string"
        ? error.message
        : "",
  };
}

function isRateLimitError(error: unknown): boolean {
  const { status, message } = getErrorDetails(error);
  return (
    status === 429 ||
    message.includes("429") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota")
  );
}

function isServiceUnavailableError(error: unknown): boolean {
  const { name, status, message } = getErrorDetails(error);
  return (
    name === "TimeoutError" ||
    status === 503 ||
    status === 504 ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE_EXCEEDED") ||
    message.toLowerCase().includes("high demand")
  );
}

function classifyLookupError(error: unknown): {
  status: number;
  error: string;
} {
  if (isRateLimitError(error)) {
    return {
      status: 429,
      error:
        "AI lookup quota is temporarily busy. Please wait a moment and try again.",
    };
  }

  if (isServiceUnavailableError(error)) {
    return {
      status: 503,
      error:
        "Gemini model is temporarily busy or timed out. Please retry in a few seconds.",
    };
  }

  console.error("POST /api/lookup failed:", error);
  return {
    status: 502,
    error: "Unable to look up that term right now. Please try again.",
  };
}

async function hydrateLemmaSavedRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  term: string,
  aiEntries: ReadonlyArray<{ word: string }>,
) {
  // Cache miss in personal `entries` already proved there are no saved rows for `word === term`.
  // Only query Supabase if the model normalized an inflected query to another lemma.
  const lemmaWordsToQuery = Array.from(
    new Set(
      aiEntries
        .map((entry) => {
          const normalized = normalizeLookupTerm(entry.word);
          return normalized.length >= 1 && normalized.length <= 80
            ? normalized
            : term;
        })
        .filter((word) => word !== term),
    ),
  );

  if (lemmaWordsToQuery.length === 0) {
    return [];
  }

  const { data: existingLemmaRows } = await supabase
    .from("entries")
    .select("id, word, part_of_speech, srs_cards(id)")
    .eq("user_id", userId)
    .in("word", lemmaWordsToQuery);

  return existingLemmaRows ?? [];
}

function respondWithCacheHit(
  cachePayload: LookupApiResponse,
  wantsStream: boolean,
): Response {
  if (wantsStream) {
    const event: LookupStreamEvent = { type: "cache", data: cachePayload };
    return new Response(`${JSON.stringify(event)}\n`, {
      headers: NDJSON_HEADERS,
    });
  }

  return NextResponse.json(cachePayload);
}

async function finalizeLookupResponse(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  term: string;
  freeDict: FreeDictionaryResult;
  gemini: DictionaryResponseDTO;
}): Promise<LookupApiResponse> {
  const { supabase, userId, term, freeDict, gemini } = params;

  if (!gemini.is_valid || gemini.entries.length === 0) {
    return {
      source: "ai",
      query: term,
      is_valid: false,
      suggestion: gemini.suggestion ?? null,
      entries: [],
    };
  }

  const existingLemmaRows = await hydrateLemmaSavedRows(
    supabase,
    userId,
    term,
    gemini.entries,
  );

  const entries = buildAiLookupEntries({
    fallbackWord: term,
    aiEntries: gemini.entries,
    audioUkUrl: freeDict.audioUkUrl,
    audioUsUrl: freeDict.audioUsUrl,
    savedRows: existingLemmaRows,
  });

  return {
    source: "ai",
    query: term,
    is_valid: true,
    suggestion: null,
    entries,
  };
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const parsed = lookupRequestSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const message =
      flattened.fieldErrors.term?.[0] ??
      flattened.formErrors[0] ??
      "Invalid lookup query.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { term } = parsed.data;
  const wantsStream =
    request.headers.get("accept")?.includes("application/x-ndjson") ?? false;
  const supabase = await createSupabaseServerClient();

  // 1. Concurrent cache-first lookup: personal `entries` + global L2 cache.
  const [{ data: cachedRows, error: cacheError }, globalCachedSenses] =
    await Promise.all([
      supabase
        .from("entries")
        .select("*, srs_cards(id)")
        .eq("user_id", auth.user.id)
        .eq("word", term)
        .order("created_at", { ascending: true }),
      readGlobalDictionaryCache(supabase, term),
    ]);

  if (cacheError) {
    console.error("Failed to query cached dictionary entries:", cacheError);
    return NextResponse.json(
      { error: "Failed to check your vocabulary cache." },
      { status: 500 },
    );
  }

  if (cachedRows && cachedRows.length > 0) {
    return respondWithCacheHit(
      {
        source: "cache",
        query: term,
        is_valid: true,
        suggestion: null,
        entries: cachedRows.map(mapCachedEntryToResult),
      },
      wantsStream,
    );
  }

  if (globalCachedSenses && globalCachedSenses.length > 0) {
    const existingLemmaRows = await hydrateLemmaSavedRows(
      supabase,
      auth.user.id,
      term,
      globalCachedSenses,
    );
    const savedByKey = new Map(
      existingLemmaRows.map((row) => [
        entrySenseKey(row.word, row.part_of_speech),
        { id: row.id, srsCardId: extractSrsCardId(row.srs_cards) },
      ]),
    );

    const entries: LookupEntryResult[] = globalCachedSenses.map((sense) => {
      const saved = savedByKey.get(
        entrySenseKey(sense.word, sense.part_of_speech),
      );
      return {
        ...sense,
        id: saved?.id ?? null,
        srs_card_id: saved?.srsCardId ?? null,
        is_saved: Boolean(saved?.srsCardId),
      };
    });

    return respondWithCacheHit(
      {
        source: "cache",
        query: term,
        is_valid: true,
        suggestion: null,
        entries,
      },
      wantsStream,
    );
  }

  // 2a. Non-streaming JSON mode (backwards-compatible): run Free Dictionary + AI in parallel.
  if (!wantsStream) {
    try {
      const [freeDict, gemini] = await Promise.all([
        fetchFreeDictionaryReference(term),
        enrichWordWithGemini(term, null, { signal: request.signal }),
      ]);

      const responsePayload = await finalizeLookupResponse({
        supabase,
        userId: auth.user.id,
        term,
        freeDict,
        gemini,
      });

      if (responsePayload.is_valid && responsePayload.entries.length > 0) {
        await writeGlobalDictionaryCache(
          supabase,
          term,
          responsePayload.entries,
        );
      }

      return NextResponse.json(responsePayload);
    } catch (error) {
      const mapped = classifyLookupError(error);
      return NextResponse.json(
        { error: mapped.error },
        { status: mapped.status },
      );
    }
  }

  // 2b. Streaming NDJSON mode: start Free Dictionary + Gemini in parallel and push
  //     instant preview + incremental partial entries as soon as chunks arrive.
  const encoder = new TextEncoder();
  let closed = false;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let latestFreeDict: FreeDictionaryResult | null = null;
      let lastPartialEmitAt = 0;

      const send = (event: LookupStreamEvent) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      const freeDictPromise = fetchFreeDictionaryReference(term);
      void freeDictPromise.then((freeDict) => {
        latestFreeDict = freeDict;
        if (finished || closed) {
          return;
        }
        const preview = buildLookupPreview(term, freeDict);
        if (preview) {
          send({ type: "preview", data: preview });
        }
      });

      try {
        const gemini = await streamWordWithGemini(term, {
          signal: request.signal,
          onReset: () => {
            lastPartialEmitAt = 0;
          },
          onChunk: (accumulated) => {
            if (closed || finished) {
              return;
            }
            const now = Date.now();
            if (now - lastPartialEmitAt < PARTIAL_EMIT_INTERVAL_MS) {
              return;
            }

            const partial = parsePartialDictionaryResponse(accumulated);
            if (
              !partial ||
              partial.is_valid === false ||
              partial.entries.length === 0
            ) {
              return;
            }

            const hasSubstantiveContent = partial.entries.some(
              (entry) =>
                entry.word.length > 0 &&
                (entry.definition_en.trim().length > 0 ||
                  entry.explanation_vi.trim().length > 0),
            );
            if (!hasSubstantiveContent) {
              return;
            }

            lastPartialEmitAt = now;
            const entries = partial.entries.map((entry) => ({
              ...entry,
              audio_uk_url: latestFreeDict?.audioUkUrl ?? null,
              audio_us_url: latestFreeDict?.audioUsUrl ?? null,
            }));

            send({
              type: "partial",
              data: {
                query: term,
                entries,
              },
            });
          },
        });

        finished = true;
        const freeDict = await freeDictPromise;
        const responsePayload = await finalizeLookupResponse({
          supabase,
          userId: auth.user.id,
          term,
          freeDict,
          gemini,
        });
        send({ type: "final", data: responsePayload });

        if (responsePayload.is_valid && responsePayload.entries.length > 0) {
          await writeGlobalDictionaryCache(
            supabase,
            term,
            responsePayload.entries,
          );
        }
      } catch (error) {
        finished = true;
        if (!request.signal.aborted) {
          const mapped = classifyLookupError(error);
          send({
            type: "error",
            error: mapped.error,
            status: mapped.status,
          });
        }
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Stream may already be closed/cancelled by the client.
        }
      }
    },
    cancel() {
      closed = true;
      finished = true;
    },
  });

  return new Response(stream, {
    headers: NDJSON_HEADERS,
  });
}
