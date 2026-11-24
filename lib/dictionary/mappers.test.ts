import { describe, expect, it } from "vitest";

import {
  buildAiLookupEntries,
  extractSrsCardId,
  mapCachedEntryToResult,
} from "@/lib/dictionary/mappers";
import type { EntryRow } from "@/types/database";

const BASE_AI_ENTRY = {
  word: "  Mitigate ",
  part_of_speech: " Verb ",
  cefr_level: "C1" as const,
  ipa_uk: "/ˈmɪt.ɪ.ɡeɪt/",
  ipa_us: "/ˈmɪt̬.ə.ɡeɪt/",
  definition_en: "to make something less harmful",
  explanation_vi: "Làm giảm nhẹ tác hại hoặc rủi ro.",
  nuance_note_vi: "Trang trọng, dùng nhiều trong IELTS Writing.",
  collocations: [{ phrase: "mitigate risks", meaning_vi: "giảm thiểu rủi ro" }],
  synonyms: [{ word: "alleviate", difference_vi: "giảm đau/nỗi khổ" }],
  antonyms: [{ word: "aggravate", meaning_vi: "làm trầm trọng thêm" }],
  examples: [
    { en: "Mitigate climate risks.", vi: "Giảm thiểu rủi ro khí hậu." },
    { en: "It helps mitigate stress.", vi: "Nó giúp giảm căng thẳng." },
  ],
};

describe("extractSrsCardId", () => {
  it("handles object, array, and null relations", () => {
    expect(extractSrsCardId({ id: "card-1" })).toBe("card-1");
    expect(extractSrsCardId([{ id: "card-2" }])).toBe("card-2");
    expect(extractSrsCardId([])).toBeNull();
    expect(extractSrsCardId(null)).toBeNull();
    expect(extractSrsCardId(undefined)).toBeNull();
  });
});

describe("mapCachedEntryToResult", () => {
  it("maps a cached EntryRow with srs_cards into LookupEntryResult", () => {
    const row: EntryRow & { srs_cards: { id: string } | null } = {
      id: "entry-1",
      user_id: "user-1",
      word: "mitigate",
      part_of_speech: "verb",
      cefr_level: "C1",
      ipa_uk: "/ˈmɪt.ɪ.ɡeɪt/",
      ipa_us: "/ˈmɪt̬.ə.ɡeɪt/",
      audio_uk_url: "https://cdn.example.com/mitigate-uk.mp3",
      audio_us_url: null,
      definition_en: "to make less severe",
      explanation_vi: "làm dịu bớt",
      nuance_note_vi: "academic",
      collocations: [],
      synonyms: [],
      antonyms: [],
      examples: [{ en: "Example.", vi: "Ví dụ." }],
      created_at: "2026-11-22T00:00:00.000Z",
      srs_cards: { id: "card-1" },
    };

    const result = mapCachedEntryToResult(row);
    expect(result.is_saved).toBe(true);
    expect(result.srs_card_id).toBe("card-1");
    expect(result.audio_uk_url).toBe("https://cdn.example.com/mitigate-uk.mp3");
    expect("user_id" in result).toBe(false);
  });
});

describe("buildAiLookupEntries", () => {
  it("normalizes words, deduplicates senses, attaches real MP3s, and hydrates saved lemma status", () => {
    const entries = buildAiLookupEntries({
      fallbackWord: "mitigating",
      aiEntries: [BASE_AI_ENTRY, { ...BASE_AI_ENTRY, word: "mitigate" }],
      audioUkUrl: "https://cdn.example.com/mitigate-uk.mp3",
      audioUsUrl: "https://cdn.example.com/mitigate-us.mp3",
      savedRows: [
        {
          id: "entry-saved",
          word: "mitigate",
          part_of_speech: "verb",
          srs_cards: [{ id: "card-saved" }],
        },
      ],
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "entry-saved",
      srs_card_id: "card-saved",
      is_saved: true,
      word: "mitigate",
      part_of_speech: "verb",
      audio_uk_url: "https://cdn.example.com/mitigate-uk.mp3",
      audio_us_url: "https://cdn.example.com/mitigate-us.mp3",
    });
  });

  it("preserves and numbers distinct senses sharing the same part of speech (e.g. pick up)", () => {
    const pickUpEntries = [
      {
        ...BASE_AI_ENTRY,
        word: "pick up",
        part_of_speech: "phrasal verb",
        definition_en: "to lift something up from a surface",
        explanation_vi: "Nhặt hoặc nhấc cái gì đó lên.",
      },
      {
        ...BASE_AI_ENTRY,
        word: "pick up",
        part_of_speech: "phrasal verb",
        definition_en: "to collect someone in a vehicle",
        explanation_vi: "Đón ai đó bằng xe.",
      },
      {
        ...BASE_AI_ENTRY,
        word: "pick up",
        part_of_speech: "phrasal verb",
        definition_en: "to learn a new skill or language informally",
        explanation_vi: "Học lỏm hoặc tiếp thu nhanh một kỹ năng.",
      },
      {
        ...BASE_AI_ENTRY,
        word: "run",
        part_of_speech: "verb",
        definition_en: "to move swiftly on foot",
        explanation_vi: "Chạy bằng chân.",
      },
      {
        ...BASE_AI_ENTRY,
        word: "run",
        part_of_speech: "noun",
        definition_en: "an act of running",
        explanation_vi: "Một lượt chạy bộ.",
      },
    ];

    const results = buildAiLookupEntries({
      fallbackWord: "pick up",
      aiEntries: pickUpEntries,
      audioUkUrl: null,
      audioUsUrl: null,
      savedRows: [
        {
          id: "entry-old",
          word: "pick up",
          part_of_speech: "phrasal verb",
          srs_cards: { id: "card-old" },
        },
        {
          id: "entry-2",
          word: "pick up",
          part_of_speech: "phrasal verb (2)",
          srs_cards: { id: "card-2" },
        },
      ],
    });

    expect(results).toHaveLength(5);
    expect(results.map((item) => [item.word, item.part_of_speech])).toEqual([
      ["pick up", "phrasal verb (1)"],
      ["pick up", "phrasal verb (2)"],
      ["pick up", "phrasal verb (3)"],
      ["run", "verb"],
      ["run", "noun"],
    ]);
    expect(results[0]?.is_saved).toBe(true);
    expect(results[1]?.is_saved).toBe(true);
    expect(results[2]?.is_saved).toBe(false);
  });
});
