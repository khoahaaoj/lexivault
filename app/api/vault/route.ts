import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/auth/session";
import {
  buildVaultListResponse,
  type RawVaultEntryRow,
} from "@/lib/srs/mappers";
import { vaultQuerySchema, type VaultListResponse } from "@/lib/srs/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) {
    return auth.response;
  }

  const searchParams = request.nextUrl.searchParams;
  const parsed = vaultQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
    cefr: searchParams.get("cefr") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  if (!parsed.success) {
    const flattened = z.flattenError(parsed.error);
    const firstError =
      Object.values(flattened.fieldErrors).flat()[0] ??
      flattened.formErrors[0] ??
      "Invalid vault query parameters.";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entries")
    .select(
      "id, word, part_of_speech, cefr_level, ipa_uk, ipa_us, audio_uk_url, audio_us_url, definition_en, explanation_vi, nuance_note_vi, collocations, synonyms, antonyms, examples, created_at, srs_cards(id, ease_factor, interval_days, repetitions, next_review_at, last_reviewed_at)",
    )
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch vault entries:", error);
    return NextResponse.json(
      { error: "Failed to load saved vocabulary." },
      { status: 500 },
    );
  }

  const responsePayload: VaultListResponse = buildVaultListResponse(
    (data ?? []) as unknown as RawVaultEntryRow[],
    parsed.data,
  );

  return NextResponse.json(responsePayload);
}
