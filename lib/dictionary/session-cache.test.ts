import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLookupSessionCache,
  getCachedLookup,
  markCachedEntrySaved,
  setCachedLookup,
} from "@/lib/dictionary/session-cache";
import type { LookupApiResponse } from "@/lib/dictionary/validation";

function makeStorageMock(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function makeLookupResponse(word: string, pos = "verb"): LookupApiResponse {
  return {
    source: "ai",
    query: word,
    is_valid: true,
    suggestion: null,
    entries: [
      {
        id: null,
        srs_card_id: null,
        is_saved: false,
        word,
        part_of_speech: pos,
        cefr_level: "C1",
        ipa_uk: "/test/",
        ipa_us: "/test/",
        audio_uk_url: null,
        audio_us_url: null,
        definition_en: `Definition of ${word}`,
        explanation_vi: `Giải thích ${word}`,
        nuance_note_vi: "Note",
        collocations: [],
        synonyms: [],
        antonyms: [],
        examples: [{ en: `Use ${word}.`, vi: `Dùng ${word}.` }],
      },
    ],
  };
}

describe("session-cache", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { sessionStorage: makeStorageMock() });
    clearLookupSessionCache();
  });

  afterEach(() => {
    clearLookupSessionCache();
    vi.unstubAllGlobals();
  });

  it("normalizes lookup keys across whitespace and case", () => {
    const payload = makeLookupResponse("mitigate");
    setCachedLookup("  MITIGATE  ", payload);

    expect(getCachedLookup("mitigate")).toEqual(payload);
    expect(getCachedLookup("  MiTiGaTe ")).toEqual(payload);
  });

  it("skips invalid responses and empty entries", () => {
    setCachedLookup("asdfgh", {
      source: "ai",
      query: "asdfgh",
      is_valid: false,
      suggestion: "ask",
      entries: [],
    });
    setCachedLookup("empty", {
      source: "ai",
      query: "empty",
      is_valid: true,
      suggestion: null,
      entries: [],
    });

    expect(getCachedLookup("asdfgh")).toBeNull();
    expect(getCachedLookup("empty")).toBeNull();
  });

  it("enforces LRU eviction beyond 50 entries", () => {
    const words = Array.from({ length: 50 }, (_, index) => {
      const codeA = String.fromCharCode(97 + Math.floor(index / 26));
      const codeB = String.fromCharCode(97 + (index % 26));
      return `word${codeA}${codeB}`;
    });

    for (const word of words) {
      setCachedLookup(word, makeLookupResponse(word));
    }

    // Touch the oldest entry so words[1] becomes the least recently used.
    expect(getCachedLookup(words[0])).not.toBeNull();

    setCachedLookup("newestword", makeLookupResponse("newestword"));

    expect(getCachedLookup(words[0])).not.toBeNull();
    expect(getCachedLookup(words[1])).toBeNull();
    expect(getCachedLookup("newestword")).not.toBeNull();
  });

  it("propagates saved status across matching (word, part_of_speech) entries", () => {
    setCachedLookup("mitigating", makeLookupResponse("mitigate", "verb"));
    setCachedLookup("mitigate", makeLookupResponse("mitigate", "verb"));

    markCachedEntrySaved("Mitigate", "VERB", {
      entryId: "entry-123",
      srsCardId: "card-456",
    });

    const hit1 = getCachedLookup("mitigating");
    const hit2 = getCachedLookup("mitigate");
    expect(hit1?.entries[0]?.is_saved).toBe(true);
    expect(hit1?.entries[0]?.id).toBe("entry-123");
    expect(hit2?.entries[0]?.srs_card_id).toBe("card-456");
  });

  it("falls back safely when sessionStorage throws or window is absent", () => {
    vi.stubGlobal("window", undefined);
    clearLookupSessionCache();
    setCachedLookup("ubiquitous", makeLookupResponse("ubiquitous"));
    expect(getCachedLookup("ubiquitous")).not.toBeNull();

    const throwingStorage: Storage = {
      length: 0,
      clear: () => {
        throw new Error("blocked");
      },
      getItem: () => {
        throw new Error("blocked");
      },
      key: () => null,
      removeItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    vi.stubGlobal("window", { sessionStorage: throwingStorage });
    clearLookupSessionCache();
    expect(() =>
      setCachedLookup("resilient", makeLookupResponse("resilient")),
    ).not.toThrow();
    expect(getCachedLookup("resilient")).not.toBeNull();
  });
});
