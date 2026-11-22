import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth/session";
import { saveEntryRequestSchema } from "@/lib/dictionary/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const parsed = saveEntryRequestSchema.safeParse(body);
  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const firstFieldError = Object.values(flattened.fieldErrors).flat()[0];
    return NextResponse.json(
      {
        error:
          firstFieldError ??
          flattened.formErrors[0] ??
          "Invalid entry payload.",
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data: savedEntry, error: entryError } = await supabase
    .from("entries")
    .upsert(
      {
        user_id: auth.user.id,
        word: payload.word,
        part_of_speech: payload.part_of_speech,
        cefr_level: payload.cefr_level,
        ipa_uk: payload.ipa_uk,
        ipa_us: payload.ipa_us,
        audio_uk_url: payload.audio_uk_url,
        audio_us_url: payload.audio_us_url,
        definition_en: payload.definition_en,
        explanation_vi: payload.explanation_vi,
        nuance_note_vi: payload.nuance_note_vi,
        collocations: payload.collocations,
        synonyms: payload.synonyms,
        antonyms: payload.antonyms,
        examples: payload.examples,
      },
      { onConflict: "user_id,word,part_of_speech" },
    )
    .select("id")
    .single();

  if (entryError || !savedEntry) {
    console.error("Failed to upsert dictionary entry:", entryError);
    return NextResponse.json(
      { error: "Failed to save entry to your vault." },
      { status: 500 },
    );
  }

  // Check for an existing flashcard first so re-saving preserves SM-2 stats.
  const { data: existingCard, error: existingCardError } = await supabase
    .from("srs_cards")
    .select("id")
    .eq("entry_id", savedEntry.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingCardError) {
    console.error("Failed to query existing SRS card:", existingCardError);
    return NextResponse.json(
      { error: "Entry saved, but failed to verify flashcard status." },
      { status: 500 },
    );
  }

  if (existingCard) {
    return NextResponse.json(
      {
        entry_id: savedEntry.id,
        srs_card_id: existingCard.id,
        saved: true,
      },
      { status: 200 },
    );
  }

  const { error: cardUpsertError } = await supabase.from("srs_cards").upsert(
    {
      user_id: auth.user.id,
      entry_id: savedEntry.id,
    },
    { onConflict: "entry_id", ignoreDuplicates: true },
  );

  if (cardUpsertError) {
    console.error("Failed to create SRS card:", cardUpsertError);
    return NextResponse.json(
      { error: "Failed to create flashcard for this entry." },
      { status: 500 },
    );
  }

  const { data: card, error: cardSelectError } = await supabase
    .from("srs_cards")
    .select("id")
    .eq("entry_id", savedEntry.id)
    .eq("user_id", auth.user.id)
    .single();

  if (cardSelectError || !card) {
    console.error("Failed to load created SRS card:", cardSelectError);
    return NextResponse.json(
      { error: "Flashcard was created, but its ID could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      entry_id: savedEntry.id,
      srs_card_id: card.id,
      saved: true,
    },
    { status: 201 },
  );
}
