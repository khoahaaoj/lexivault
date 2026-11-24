import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  readGlobalDictionaryCache,
  resetGlobalDictionaryCacheForTests,
  writeGlobalDictionaryCache,
  type DictionaryCacheClient,
} from "@/lib/dictionary/global-cache";
import type { LookupEntryResult } from "@/lib/dictionary/validation";

function makeEntry(overrides?: Partial<LookupEntryResult>): LookupEntryResult {
  return {
    id: "user-entry-id",
    srs_card_id: "user-card-id",
    is_saved: true,
    word: "mitigate",
    part_of_speech: "verb",
    cefr_level: "C1",
    ipa_uk: "/ˈmɪt.ɪ.ɡeɪt/",
    ipa_us: "/ˈmɪt̬.ə.ɡeɪt/",
    audio_uk_url: "https://cdn.example.com/mitigate-uk.mp3",
    audio_us_url: null,
    definition_en: "to make something less harmful or unpleasant",
    explanation_vi: "Làm giảm nhẹ mức độ nghiêm trọng của rủi ro.",
    nuance_note_vi: "Trang trọng, dùng nhiều trong IELTS Writing Task 2.",
    collocations: [{ phrase: "mitigate risks", meaning_vi: "giảm rủi ro" }],
    synonyms: [{ word: "alleviate", difference_vi: "làm dịu nỗi đau" }],
    antonyms: [{ word: "aggravate", meaning_vi: "làm trầm trọng" }],
    examples: [
      {
        en: "Policies help mitigate climate risks.",
        vi: "Chính sách giúp giảm thiểu rủi ro khí hậu.",
      },
    ],
    ...overrides,
  };
}

describe("global-cache (L2 warm LRU + Supabase fail-open)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
    resetGlobalDictionaryCacheForTests();
  });

  afterEach(() => {
    resetGlobalDictionaryCacheForTests();
    vi.useRealTimers();
  });

  it("reads from Supabase on cold instance and serves warm LRU hits afterwards", async () => {
    const entry = makeEntry();
    const {
      id: _id,
      srs_card_id: _cardId,
      is_saved: _saved,
      ...senseWithoutUserFields
    } = entry;
    void _id;
    void _cardId;
    void _saved;

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        entries: [senseWithoutUserFields],
        updated_at: "2026-11-24T11:00:00Z",
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as unknown as DictionaryCacheClient;

    const first = await readGlobalDictionaryCache(client, "mitigate");
    const second = await readGlobalDictionaryCache(client, "mitigate");

    expect(first).toEqual([senseWithoutUserFields]);
    expect(second).toEqual([senseWithoutUserFields]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith("term", "mitigate");
  });

  it("strips user-specific IDs on write and populates warm cache immediately", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const client = { from } as unknown as DictionaryCacheClient;

    const entry = makeEntry();
    await writeGlobalDictionaryCache(client, "mitigating", [entry]);

    expect(upsert).toHaveBeenCalledTimes(1);
    const [payload] = upsert.mock.calls[0]!;
    expect(payload.term).toBe("mitigating");
    expect(payload.entries[0]).not.toHaveProperty("id");
    expect(payload.entries[0]).not.toHaveProperty("srs_card_id");
    expect(payload.entries[0]).not.toHaveProperty("is_saved");

    // Subsequent read hits warm LRU without calling Supabase again.
    const cached = await readGlobalDictionaryCache(client, "mitigating");
    expect(cached).toHaveLength(1);
    expect(cached?.[0]?.word).toBe("mitigate");
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("fails open and backs off for 5 minutes when dictionary_cache table is missing (PGRST205)", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST205",
        message: "Could not find the table 'public.dictionary_cache'",
      },
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select, upsert });
    const client = { from } as unknown as DictionaryCacheClient;

    expect(await readGlobalDictionaryCache(client, "ubiquitous")).toBeNull();
    // During 5-minute cooldown, neither reads nor DB upserts hit Supabase again.
    expect(await readGlobalDictionaryCache(client, "ephemeral")).toBeNull();
    await writeGlobalDictionaryCache(client, "ephemeral", [
      makeEntry({ word: "ephemeral" }),
    ]);

    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();

    // After 5 minutes cooldown expires, reads retry Supabase cleanly.
    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    await readGlobalDictionaryCache(client, "lucid");
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });
});
