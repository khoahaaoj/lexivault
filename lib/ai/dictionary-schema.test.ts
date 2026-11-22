import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockGenerateContent, mockGetServerEnv, mockConstructorArgs } =
  vi.hoisted(() => ({
    mockGenerateContent: vi.fn(),
    mockGetServerEnv: vi.fn(),
    mockConstructorArgs: vi.fn(),
  }));

vi.mock("@/lib/env/server", () => ({
  getServerEnv: mockGetServerEnv,
}));

vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
    constructor(options: { apiKey: string }) {
      mockConstructorArgs(options);
    }
  }
  return {
    ...actual,
    GoogleGenAI: MockGoogleGenAI,
  };
});

import {
  DICTIONARY_SYSTEM_PROMPT,
  buildDictionaryUserPrompt,
} from "@/lib/ai/dictionary-prompt";
import {
  DictionaryResponseSchema,
  GEMINI_RESPONSE_SCHEMA,
  enrichWordWithGemini,
} from "@/lib/ai/dictionary-schema";

const SAMPLE_ENTRY = {
  word: "mitigate",
  part_of_speech: "verb",
  cefr_level: "C1" as const,
  ipa_uk: "/ˈmɪt.ɪ.ɡeɪt/",
  ipa_us: "/ˈmɪt̬.ə.ɡeɪt/",
  definition_en: "to make something less harmful, unpleasant, or bad",
  explanation_vi:
    "Làm giảm nhẹ mức độ nghiêm trọng, tác hại hoặc tính chất tiêu cực của một vấn đề, rủi ro hay hậu quả.",
  nuance_note_vi:
    "Mang sắc thái trang trọng/học thuật, rất hay dùng trong IELTS Writing Task 2 với các danh từ chỉ rủi ro hoặc tác động xấu.",
  collocations: [
    { phrase: "mitigate the effects", meaning_vi: "giảm thiểu tác động" },
    { phrase: "mitigate risks", meaning_vi: "giảm thiểu rủi ro" },
  ],
  synonyms: [
    {
      word: "alleviate",
      difference_vi:
        "Thường nhấn mạnh việc làm dịu cơn đau hoặc nỗi khổ, trong khi mitigate hay đi với rủi ro/thiệt hại.",
    },
  ],
  antonyms: [{ word: "aggravate", meaning_vi: "làm trầm trọng thêm" }],
  examples: [
    {
      en: "Governments must take urgent measures to mitigate the impacts of climate change.",
      vi: "Chính phủ cần thực hiện các biện pháp khẩn cấp để giảm thiểu tác động của biến đổi khí hậu.",
    },
    {
      en: "Good planning can help mitigate most of the risks on a tight deadline.",
      vi: "Lập kế hoạch tốt có thể giúp giảm nhẹ phần lớn rủi ro khi thời hạn gấp.",
    },
  ],
};

describe("buildDictionaryUserPrompt", () => {
  it("wraps trimmed term and falls back to NONE_AVAILABLE when reference is null", () => {
    const prompt = buildDictionaryUserPrompt("  bite the bullet  ", null);
    expect(prompt).toContain("<target_term>bite the bullet</target_term>");
    expect(prompt).toContain(
      "<reference_data>\nNONE_AVAILABLE\n</reference_data>",
    );
  });

  it("embeds provided referenceJson inside <reference_data>", () => {
    const ref = '{"word":"mitigate"}';
    const prompt = buildDictionaryUserPrompt("mitigate", ref);
    expect(prompt).toContain(`<reference_data>\n${ref}\n</reference_data>`);
  });
});

describe("DictionaryResponseSchema", () => {
  it("accepts a valid enriched dictionary response", () => {
    const payload = {
      is_valid: true,
      suggestion: null,
      entries: [SAMPLE_ENTRY],
    };
    expect(DictionaryResponseSchema.parse(payload)).toEqual(payload);
  });

  it("accepts an invalid-word response with suggestion and empty entries", () => {
    const payload = {
      is_valid: false,
      suggestion: "mitigate",
      entries: [],
    };
    expect(DictionaryResponseSchema.parse(payload)).toEqual(payload);
  });

  it("rejects out-of-range CEFR levels and invalid example counts", () => {
    expect(() =>
      DictionaryResponseSchema.parse({
        is_valid: true,
        suggestion: null,
        entries: [{ ...SAMPLE_ENTRY, cefr_level: "D1" }],
      }),
    ).toThrow();

    expect(() =>
      DictionaryResponseSchema.parse({
        is_valid: true,
        suggestion: null,
        entries: [{ ...SAMPLE_ENTRY, examples: [] }],
      }),
    ).toThrow();

    expect(() =>
      DictionaryResponseSchema.parse({
        is_valid: true,
        suggestion: null,
        entries: [
          {
            ...SAMPLE_ENTRY,
            examples: [
              ...SAMPLE_ENTRY.examples,
              { en: "Three.", vi: "Ba." },
              { en: "Four.", vi: "Bốn." },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

describe("enrichWordWithGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetServerEnv.mockReturnValue({
      GEMINI_API_KEY: "test-gemini-key",
      GEMINI_MODEL: "gemini-3.5-flash-lite",
    });
  });

  it("calls Gemini with lazy server env, structured schema, and temperature 0.2", async () => {
    const validResponse = {
      is_valid: true,
      suggestion: null,
      entries: [SAMPLE_ENTRY],
    };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(validResponse),
    });

    const result = await enrichWordWithGemini(
      "mitigate",
      '{"word":"mitigate"}',
    );

    expect(mockGetServerEnv).toHaveBeenCalledTimes(1);
    expect(mockConstructorArgs).toHaveBeenCalledWith({
      apiKey: "test-gemini-key",
    });
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "gemini-3.5-flash-lite",
      contents: buildDictionaryUserPrompt("mitigate", '{"word":"mitigate"}'),
      config: {
        systemInstruction: DICTIONARY_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });
    expect(result).toEqual(validResponse);
  });

  it("throws when Gemini returns an empty text payload", async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });
    await expect(enrichWordWithGemini("mitigate")).rejects.toThrow(
      /Empty response from Gemini API/,
    );
  });

  it("throws when Gemini JSON fails Zod schema validation", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        is_valid: true,
        suggestion: null,
        entries: [{ ...SAMPLE_ENTRY, cefr_level: "Z9" }],
      }),
    });
    await expect(enrichWordWithGemini("mitigate")).rejects.toThrow();
  });
});
