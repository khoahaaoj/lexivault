import { describe, expect, it } from "vitest";

import {
  buildVaultListResponse,
  extractEmbeddedEntry,
  extractEmbeddedSrsCard,
  type RawVaultEntryRow,
} from "@/lib/srs/mappers";
import {
  entryIdParamSchema,
  submitReviewSchema,
  vaultQuerySchema,
} from "@/lib/srs/schemas";

const SAMPLE_UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeVaultRow(
  overrides: Partial<RawVaultEntryRow> = {},
): RawVaultEntryRow {
  return {
    id: SAMPLE_UUID,
    word: "mitigate",
    part_of_speech: "verb",
    cefr_level: "C1",
    ipa_uk: "/ˈmɪt.ɪ.ɡeɪt/",
    ipa_us: "/ˈmɪt̬.ə.ɡeɪt/",
    audio_uk_url: null,
    audio_us_url: null,
    definition_en: "to make something less harmful or bad",
    explanation_vi: "làm giảm nhẹ mức độ nghiêm trọng",
    nuance_note_vi: "trang trọng",
    collocations: [],
    synonyms: [],
    antonyms: [],
    examples: [{ en: "Mitigate risks.", vi: "Giảm thiểu rủi ro." }],
    created_at: "2026-11-22T00:00:00.000Z",
    srs_cards: null,
    ...overrides,
  };
}

describe("submitReviewSchema", () => {
  it("accepts valid UUID card_id and ratings 1..4", () => {
    for (const rating of [1, 2, 3, 4] as const) {
      expect(
        submitReviewSchema.parse({ card_id: SAMPLE_UUID, rating }),
      ).toEqual({
        card_id: SAMPLE_UUID,
        rating,
      });
    }
  });

  it("rejects non-UUID card_id or invalid rating", () => {
    expect(
      submitReviewSchema.safeParse({ card_id: "not-a-uuid", rating: 3 })
        .success,
    ).toBe(false);
    expect(
      submitReviewSchema.safeParse({ card_id: SAMPLE_UUID, rating: 5 }).success,
    ).toBe(false);
    expect(
      submitReviewSchema.safeParse({ card_id: SAMPLE_UUID, rating: 2.5 })
        .success,
    ).toBe(false);
  });
});

describe("vaultQuerySchema & entryIdParamSchema", () => {
  it("normalizes blank query strings to undefined", () => {
    expect(vaultQuerySchema.parse({ q: "   ", cefr: "", status: "" })).toEqual({
      q: undefined,
      cefr: undefined,
      status: undefined,
    });
  });

  it("accepts valid search, cefr, and status filters", () => {
    expect(
      vaultQuerySchema.parse({
        q: " mitigate ",
        cefr: "C1",
        status: "mastered",
      }),
    ).toEqual({
      q: "mitigate",
      cefr: "C1",
      status: "mastered",
    });
  });

  it("rejects invalid cefr, invalid status, overly long query, and bad UUID", () => {
    expect(vaultQuerySchema.safeParse({ cefr: "D2" }).success).toBe(false);
    expect(vaultQuerySchema.safeParse({ status: "archived" }).success).toBe(
      false,
    );
    expect(vaultQuerySchema.safeParse({ q: "a".repeat(81) }).success).toBe(
      false,
    );
    expect(entryIdParamSchema.safeParse("bad-id").success).toBe(false);
    expect(entryIdParamSchema.safeParse(SAMPLE_UUID).success).toBe(true);
  });
});

describe("SRS relation mappers & Vault filtering", () => {
  it("extracts embedded PostgREST object or array relations safely", () => {
    const row = makeVaultRow();
    expect(extractEmbeddedEntry(row)?.word).toBe("mitigate");
    expect(extractEmbeddedEntry([row])?.word).toBe("mitigate");
    expect(extractEmbeddedEntry(null)).toBeNull();

    const card = {
      id: "card-1",
      ease_factor: 2.5,
      interval_days: 6,
      repetitions: 2,
      next_review_at: "2026-11-28T00:00:00.000Z",
      last_reviewed_at: "2026-11-22T00:00:00.000Z",
    };
    expect(extractEmbeddedSrsCard(card)).toEqual(card);
    expect(extractEmbeddedSrsCard([card])).toEqual(card);
    expect(extractEmbeddedSrsCard([])).toBeNull();
  });

  it("computes full counts and applies q, cefr, and status filters", () => {
    const nowMs = new Date("2026-11-22T12:00:00.000Z").getTime();
    const rows: RawVaultEntryRow[] = [
      makeVaultRow({
        id: "e1",
        word: "mitigate",
        cefr_level: "C1",
        srs_cards: {
          id: "c1",
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          next_review_at: "2026-11-22T11:00:00.000Z",
          last_reviewed_at: null,
        },
      }),
      makeVaultRow({
        id: "e2",
        word: "resilient",
        cefr_level: "B2",
        definition_en: "able to recover quickly",
        explanation_vi: "kiên cường phục hồi nhanh",
        srs_cards: [
          {
            id: "c2",
            ease_factor: 2.6,
            interval_days: 30,
            repetitions: 4,
            next_review_at: "2026-12-22T12:00:00.000Z",
            last_reviewed_at: "2026-11-22T10:00:00.000Z",
          },
        ],
      }),
      makeVaultRow({
        id: "e3",
        word: "ubiquitous",
        cefr_level: "C2",
        srs_cards: {
          id: "c3",
          ease_factor: 2.36,
          interval_days: 3,
          repetitions: 1,
          next_review_at: "2026-11-22T12:00:00.000Z",
          last_reviewed_at: "2026-11-19T12:00:00.000Z",
        },
      }),
    ];

    const filtered = buildVaultListResponse(
      rows,
      { q: "phục hồi", cefr: "B2", status: "mastered" },
      nowMs,
    );

    expect(filtered.counts).toEqual({
      total: 3,
      new: 1,
      learning: 1,
      mastered: 1,
      due: 2,
    });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.word).toBe("resilient");
    expect(filtered.items[0]?.is_due).toBe(false);
  });
});
