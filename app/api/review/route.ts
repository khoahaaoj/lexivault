import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth/session";
import { calculateSm2, getMasteryStatus } from "@/lib/sm2";
import {
  extractEmbeddedEntry,
  type EmbeddedEntryRelation,
} from "@/lib/srs/mappers";
import {
  submitReviewSchema,
  type ReviewCardItem,
  type ReviewQueueResponse,
  type ReviewSubmitResponse,
} from "@/lib/srs/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) {
    return auth.response;
  }

  const nowIso = new Date().toISOString();
  const supabase = await createSupabaseServerClient();

  const [dueResult, totalResult, nextUpcomingResult] = await Promise.all([
    supabase
      .from("srs_cards")
      .select(
        "id, entry_id, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at, entries!inner(id, word, part_of_speech, cefr_level, ipa_uk, ipa_us, audio_uk_url, audio_us_url, definition_en, explanation_vi, nuance_note_vi, collocations, synonyms, antonyms, examples, created_at)",
      )
      .eq("user_id", auth.user.id)
      .lte("next_review_at", nowIso)
      .order("next_review_at", { ascending: true }),
    supabase
      .from("srs_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.user.id),
    supabase
      .from("srs_cards")
      .select("next_review_at")
      .eq("user_id", auth.user.id)
      .gt("next_review_at", nowIso)
      .order("next_review_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (dueResult.error) {
    console.error("Failed to load due flashcards:", dueResult.error);
    return NextResponse.json(
      { error: "Failed to load review queue." },
      { status: 500 },
    );
  }

  const cards: ReviewCardItem[] = [];
  for (const row of dueResult.data ?? []) {
    const entry = extractEmbeddedEntry(
      row.entries as unknown as EmbeddedEntryRelation,
    );
    if (!entry) {
      continue;
    }
    cards.push({
      id: row.id,
      entry_id: row.entry_id,
      ease_factor: row.ease_factor,
      interval_days: row.interval_days,
      repetitions: row.repetitions,
      next_review_at: row.next_review_at,
      last_reviewed_at: row.last_reviewed_at,
      entry,
    });
  }

  const payload: ReviewQueueResponse = {
    due_count: cards.length,
    total_cards: totalResult.count ?? cards.length,
    next_upcoming_at: nextUpcomingResult.data?.next_review_at ?? null,
    cards,
  };

  return NextResponse.json(payload);
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

  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const firstError =
      flattened.fieldErrors.card_id?.[0] ??
      flattened.fieldErrors.rating?.[0] ??
      flattened.formErrors[0] ??
      "Invalid review submission.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { card_id, rating } = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: existingCard, error: loadError } = await supabase
    .from("srs_cards")
    .select("id, entry_id, ease_factor, interval_days, repetitions")
    .eq("id", card_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (loadError) {
    console.error("Failed to fetch flashcard for review:", loadError);
    return NextResponse.json(
      { error: "Failed to load flashcard." },
      { status: 500 },
    );
  }

  if (!existingCard) {
    return NextResponse.json(
      { error: "Flashcard not found." },
      { status: 404 },
    );
  }

  const nextState = calculateSm2(
    {
      ease_factor: existingCard.ease_factor,
      interval_days: existingCard.interval_days,
      repetitions: existingCard.repetitions,
    },
    rating,
    new Date(),
  );

  const nextReviewIso = nextState.next_review_at.toISOString();
  const lastReviewedIso = nextState.last_reviewed_at.toISOString();

  const { data: updatedCard, error: updateError } = await supabase
    .from("srs_cards")
    .update({
      ease_factor: nextState.ease_factor,
      interval_days: nextState.interval_days,
      repetitions: nextState.repetitions,
      next_review_at: nextReviewIso,
      last_reviewed_at: lastReviewedIso,
    })
    .eq("id", card_id)
    .eq("user_id", auth.user.id)
    .select(
      "id, entry_id, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at",
    )
    .single();

  if (updateError || !updatedCard) {
    console.error("Failed to update flashcard SM-2 state:", updateError);
    return NextResponse.json(
      { error: "Failed to save review progress." },
      { status: 500 },
    );
  }

  const responsePayload: ReviewSubmitResponse = {
    id: updatedCard.id,
    entry_id: updatedCard.entry_id,
    ease_factor: updatedCard.ease_factor,
    interval_days: updatedCard.interval_days,
    repetitions: updatedCard.repetitions,
    next_review_at: updatedCard.next_review_at,
    last_reviewed_at: updatedCard.last_reviewed_at ?? lastReviewedIso,
    mastery_status: getMasteryStatus(updatedCard),
  };

  return NextResponse.json(responsePayload);
}
