import { NextResponse } from "next/server";
import { z } from "zod";

import { enrichWordWithGemini } from "@/lib/ai/dictionary-schema";
import { requireApiUser } from "@/lib/auth/session";
import { fetchFreeDictionaryReference } from "@/lib/dictionary/free-dictionary";
import {
  buildAiLookupEntries,
  mapCachedEntryToResult,
} from "@/lib/dictionary/mappers";
import {
  lookupRequestSchema,
  type LookupApiResponse,
} from "@/lib/dictionary/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getErrorDetails(error: unknown): {
  status: number | null;
  message: string;
} {
  if (!error || typeof error !== "object") {
    return { status: null, message: "" };
  }
  return {
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
  const { status, message } = getErrorDetails(error);
  return (
    status === 503 ||
    status === 504 ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("UNAVAILABLE") ||
    message.includes("DEADLINE_EXCEEDED") ||
    message.toLowerCase().includes("high demand")
  );
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
  const supabase = await createSupabaseServerClient();

  // 1. Cache-first lookup in the authenticated user's entries table.
  const { data: cachedRows, error: cacheError } = await supabase
    .from("entries")
    .select("*, srs_cards(id)")
    .eq("user_id", auth.user.id)
    .eq("word", term)
    .order("created_at", { ascending: true });

  if (cacheError) {
    console.error("Failed to query cached dictionary entries:", cacheError);
    return NextResponse.json(
      { error: "Failed to check your vocabulary cache." },
      { status: 500 },
    );
  }

  if (cachedRows && cachedRows.length > 0) {
    const responsePayload: LookupApiResponse = {
      source: "cache",
      query: term,
      is_valid: true,
      suggestion: null,
      entries: cachedRows.map(mapCachedEntryToResult),
    };
    return NextResponse.json(responsePayload);
  }

  // 2. Cache miss -> fetch Free Dictionary API grounding + real MP3 audio URLs,
  //    then enrich with Gemini server-side.
  try {
    const freeDict = await fetchFreeDictionaryReference(term);
    const gemini = await enrichWordWithGemini(term, freeDict.referenceJson);

    if (!gemini.is_valid || gemini.entries.length === 0) {
      const invalidPayload: LookupApiResponse = {
        source: "ai",
        query: term,
        is_valid: false,
        suggestion: gemini.suggestion ?? null,
        entries: [],
      };
      return NextResponse.json(invalidPayload);
    }

    const preliminaryEntries = buildAiLookupEntries({
      fallbackWord: term,
      aiEntries: gemini.entries,
      audioUkUrl: freeDict.audioUkUrl,
      audioUsUrl: freeDict.audioUsUrl,
      savedRows: [],
    });

    const uniqueWords = Array.from(
      new Set(preliminaryEntries.map((entry) => entry.word)),
    );

    const { data: existingLemmaRows } =
      uniqueWords.length > 0
        ? await supabase
            .from("entries")
            .select("id, word, part_of_speech, srs_cards(id)")
            .eq("user_id", auth.user.id)
            .in("word", uniqueWords)
        : { data: [] };

    const entries = buildAiLookupEntries({
      fallbackWord: term,
      aiEntries: gemini.entries,
      audioUkUrl: freeDict.audioUkUrl,
      audioUsUrl: freeDict.audioUsUrl,
      savedRows: existingLemmaRows ?? [],
    });

    const responsePayload: LookupApiResponse = {
      source: "ai",
      query: term,
      is_valid: true,
      suggestion: null,
      entries,
    };
    return NextResponse.json(responsePayload);
  } catch (error) {
    if (isRateLimitError(error)) {
      return NextResponse.json(
        {
          error:
            "AI lookup quota is temporarily busy. Please wait a moment and try again.",
        },
        { status: 429 },
      );
    }

    if (isServiceUnavailableError(error)) {
      return NextResponse.json(
        {
          error:
            "Gemini model is temporarily busy or timed out. Please retry in a few seconds.",
        },
        { status: 503 },
      );
    }

    console.error("POST /api/lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to look up that term right now. Please try again." },
      { status: 502 },
    );
  }
}
