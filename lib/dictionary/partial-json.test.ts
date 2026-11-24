import { describe, expect, it } from "vitest";

import {
  parsePartialDictionaryResponse,
  repairPartialJson,
  stripMarkdownCodeFence,
} from "@/lib/dictionary/partial-json";

describe("repairPartialJson", () => {
  it("returns null for whitespace or non-container garbage", () => {
    expect(repairPartialJson("")).toBeNull();
    expect(repairPartialJson("   \n\t ")).toBeNull();
    expect(repairPartialJson("hello world")).toBeNull();
  });

  it("closes open value strings, arrays, and objects cleanly", () => {
    expect(
      JSON.parse(
        repairPartialJson(
          '{"is_valid":true,"entries":[{"word":"mitigate","definition_en":"to make someth',
        )!,
      ),
    ).toEqual({
      is_valid: true,
      entries: [{ word: "mitigate", definition_en: "to make someth" }],
    });
  });

  it("strips incomplete trailing escapes and partial \\uXXXX sequences", () => {
    expect(JSON.parse(repairPartialJson('{"word":"say \\"hi\\"\\')!)).toEqual({
      word: 'say "hi"',
    });

    expect(
      JSON.parse(repairPartialJson('{"explanation_vi":"gi\\u1ea3m\\u1e')!),
    ).toEqual({
      explanation_vi: "giảm",
    });

    expect(
      JSON.parse(repairPartialJson('{"explanation_vi":"dùng cho \\\\')!),
    ).toEqual({
      explanation_vi: "dùng cho \\",
    });
  });

  it("strips dangling keys, colons, commas, and incomplete booleans", () => {
    expect(JSON.parse(repairPartialJson('{"is_valid": tru')!)).toEqual({});
    expect(JSON.parse(repairPartialJson('{"is_valid": true, "sugge')!)).toEqual(
      { is_valid: true },
    );
    expect(
      JSON.parse(repairPartialJson('{"is_valid": true, "suggestion": ')!),
    ).toEqual({ is_valid: true });
    expect(
      JSON.parse(
        repairPartialJson(
          '{"entries":[{"word":"mitigate","collocations":[{"phrase":"mitigate risks",',
        )!,
      ),
    ).toEqual({
      entries: [
        {
          word: "mitigate",
          collocations: [{ phrase: "mitigate risks" }],
        },
      ],
    });
  });

  it("handles complete JSON cleanly without trailing modifications", () => {
    const full = '{"is_valid":false,"suggestion":"mitigate","entries":[]}';
    expect(repairPartialJson(full)).toBe(full);
  });
});

describe("parsePartialDictionaryResponse", () => {
  it("parses progressive UTF-8 Vietnamese prefixes and filters empty nested items", () => {
    const sample = JSON.stringify({
      is_valid: true,
      suggestion: null,
      entries: [
        {
          word: "Mitigate",
          part_of_speech: "verb",
          cefr_level: "C1",
          ipa_uk: "/ˈmɪt.ɪ.ɡeɪt/",
          ipa_us: "/ˈmɪt̬.ə.ɡeɪt/",
          definition_en: "to make something less harmful or unpleasant",
          explanation_vi: "Làm giảm nhẹ mức độ nghiêm trọng của rủi ro.",
          nuance_note_vi: "Trang trọng, rất phổ biến trong IELTS Writing.",
          collocations: [
            { phrase: "mitigate risks", meaning_vi: "giảm thiểu rủi ro" },
          ],
          synonyms: [
            { word: "alleviate", difference_vi: "thường dùng với cơn đau" },
          ],
          antonyms: [{ word: "aggravate", meaning_vi: "làm trầm trọng" }],
          examples: [
            {
              en: "Policies help mitigate climate risks.",
              vi: "Chính sách giúp giảm thiểu rủi ro khí hậu.",
            },
          ],
        },
      ],
    });

    // Test truncations across every 7-character increment.
    for (let len = 1; len <= sample.length; len += 7) {
      const slice = sample.slice(0, len);
      const parsed = parsePartialDictionaryResponse(slice);
      if (parsed) {
        expect(Array.isArray(parsed.entries)).toBe(true);
        for (const entry of parsed.entries) {
          expect(entry.word.length).toBeGreaterThan(0);
        }
      }
    }

    const full = parsePartialDictionaryResponse(sample);
    expect(full?.is_valid).toBe(true);
    expect(full?.entries).toHaveLength(1);
    expect(full?.entries[0]?.word).toBe("mitigate");
    expect(full?.entries[0]?.cefr_level).toBe("C1");
    expect(full?.entries[0]?.explanation_vi).toBe(
      "Làm giảm nhẹ mức độ nghiêm trọng của rủi ro.",
    );
  });

  it("sets partial or unknown cefr_level to null and filters incomplete sub-items", () => {
    const raw =
      '{"is_valid":true,"entries":[{"word":"ubiquitous","cefr_level":"C","synonyms":[{"word":"","difference_vi":""},{"word":"omnipresent","difference_vi":"trang trọng hơn"}],"collocations":[{"phrase":""}]}]}';
    const parsed = parsePartialDictionaryResponse(raw);
    expect(parsed?.entries[0]?.cefr_level).toBeNull();
    expect(parsed?.entries[0]?.collocations).toEqual([]);
    expect(parsed?.entries[0]?.synonyms).toEqual([
      { word: "omnipresent", difference_vi: "trang trọng hơn" },
    ]);
  });

  it("handles is_valid: false responses cleanly", () => {
    const parsed = parsePartialDictionaryResponse(
      '{"is_valid":false,"suggestion":"mitigate","entries":[]}',
    );
    expect(parsed).toEqual({
      is_valid: false,
      suggestion: "mitigate",
      entries: [],
    });
  });

  it("strips markdown code fences before repairing or parsing partial JSON", () => {
    expect(stripMarkdownCodeFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
    const parsed = parsePartialDictionaryResponse(
      '```json\n{"is_valid":true,"entries":[{"word":"lucid","definition_en":"clear and',
    );
    expect(parsed?.entries[0]?.word).toBe("lucid");
    expect(parsed?.entries[0]?.definition_en).toBe("clear and");
  });

  it("numbers streaming entries that share the same part of speech", () => {
    const raw =
      '{"is_valid":true,"entries":[{"word":"pick up","part_of_speech":"phrasal verb","definition_en":"to lift something"},{"word":"pick up","part_of_speech":"phrasal verb","definition_en":"to collect someone in a vehicle"}]}';
    const parsed = parsePartialDictionaryResponse(raw);
    expect(parsed?.entries.map((e) => e.part_of_speech)).toEqual([
      "phrasal verb (1)",
      "phrasal verb (2)",
    ]);
  });
});
