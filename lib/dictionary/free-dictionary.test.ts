import { describe, expect, it, vi } from "vitest";

import {
  buildLookupPreview,
  extractAudioUrls,
  fetchFreeDictionaryReference,
  normalizeAudioUrl,
  parseFreeDictionaryPayload,
} from "@/lib/dictionary/free-dictionary";

describe("normalizeAudioUrl", () => {
  it("keeps valid https .mp3 URLs and upgrades protocol-relative URLs", () => {
    expect(
      normalizeAudioUrl(
        "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-uk.mp3",
      ),
    ).toBe(
      "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-uk.mp3",
    );
    expect(
      normalizeAudioUrl(
        "//api.dictionaryapi.dev/media/pronunciations/en/mitigate-us.mp3",
      ),
    ).toBe(
      "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-us.mp3",
    );
  });

  it("rejects blank, http-only, malformed, or non-mp3 URLs", () => {
    expect(normalizeAudioUrl("")).toBeNull();
    expect(normalizeAudioUrl("http://example.com/a-uk.mp3")).toBeNull();
    expect(normalizeAudioUrl("https://example.com/a-uk.ogg")).toBeNull();
    expect(normalizeAudioUrl("not-a-url")).toBeNull();
  });
});

describe("extractAudioUrls", () => {
  it("extracts UK/GB and US mp3 links while avoiding false positives", () => {
    const result = extractAudioUrls([
      { audio: "" },
      { audio: "https://cdn.example.com/words/focus.mp3" },
      { audio: "https://cdn.example.com/words/duke.mp3" },
      {
        audio:
          "//api.dictionaryapi.dev/media/pronunciations/en/resilient_gb_1.mp3",
      },
      {
        audio:
          "https://api.dictionaryapi.dev/media/pronunciations/en/resilient-us.mp3",
      },
      {
        audio:
          "https://api.dictionaryapi.dev/media/pronunciations/en/resilient-uk.mp3",
      },
    ]);

    expect(result).toEqual({
      audioUkUrl:
        "https://api.dictionaryapi.dev/media/pronunciations/en/resilient_gb_1.mp3",
      audioUsUrl:
        "https://api.dictionaryapi.dev/media/pronunciations/en/resilient-us.mp3",
    });
  });

  it("supports directory-segmented accent URLs like /uk/ and /us/", () => {
    const result = extractAudioUrls([
      { audio: "https://cdn.example.com/en/uk/ubiquitous.mp3" },
      { audio: "https://cdn.example.com/en/us/ubiquitous.mp3" },
    ]);
    expect(result).toEqual({
      audioUkUrl: "https://cdn.example.com/en/uk/ubiquitous.mp3",
      audioUsUrl: "https://cdn.example.com/en/us/ubiquitous.mp3",
    });
  });
});

describe("parseFreeDictionaryPayload", () => {
  it("condenses word, IPA phonetics, partOfSpeech, and at most 3 definitions per POS", () => {
    const raw = [
      {
        word: "mitigate",
        phonetics: [
          {
            text: "/ˈmɪt.ɪ.ɡeɪt/",
            audio:
              "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-uk.mp3",
          },
          {
            text: "/ˈmɪt̬.ə.ɡeɪt/",
            audio:
              "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-us.mp3",
          },
          { text: "/ˈmɪt.ɪ.ɡeɪt/", audio: "" },
        ],
        meanings: [
          {
            partOfSpeech: "verb",
            definitions: [
              { definition: "Def 1", example: "Ignored example" },
              { definition: "Def 2" },
              { definition: "Def 3" },
              { definition: "Def 4 should be truncated" },
            ],
            synonyms: ["alleviate"],
          },
          {
            partOfSpeech: "adjective",
            definitions: [{ definition: "Adj 1" }],
          },
        ],
      },
    ];

    const result = parseFreeDictionaryPayload(raw);

    expect(result.audioUkUrl).toBe(
      "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-uk.mp3",
    );
    expect(result.audioUsUrl).toBe(
      "https://api.dictionaryapi.dev/media/pronunciations/en/mitigate-us.mp3",
    );
    expect(result.referenceJson).not.toBeNull();

    const parsedRef = JSON.parse(result.referenceJson!);
    expect(parsedRef).toEqual({
      word: "mitigate",
      phonetics: ["/ˈmɪt.ɪ.ɡeɪt/", "/ˈmɪt̬.ə.ɡeɪt/"],
      meanings: [
        { partOfSpeech: "verb", definitions: ["Def 1", "Def 2", "Def 3"] },
        { partOfSpeech: "adjective", definitions: ["Adj 1"] },
      ],
    });
    expect(result.referenceJson).not.toContain(".mp3");
  });

  it("returns empty result on malformed or empty payloads", () => {
    expect(parseFreeDictionaryPayload([])).toEqual({
      audioUkUrl: null,
      audioUsUrl: null,
      referenceJson: null,
    });
    expect(
      parseFreeDictionaryPayload({ title: "No Definitions Found" }),
    ).toEqual({
      audioUkUrl: null,
      audioUsUrl: null,
      referenceJson: null,
    });
  });
});

describe("fetchFreeDictionaryReference", () => {
  it("returns condensed result on HTTP 200", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            word: "resilient",
            phonetics: [
              {
                text: "/rɪˈzɪl.i.ənt/",
                audio: "https://cdn.example.com/resilient-uk.mp3",
              },
            ],
            meanings: [
              {
                partOfSpeech: "adjective",
                definitions: [{ definition: "Able to recover quickly." }],
              },
            ],
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchFreeDictionaryReference("resilient", mockFetch);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.dictionaryapi.dev/api/v2/entries/en/resilient",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(result.audioUkUrl).toBe("https://cdn.example.com/resilient-uk.mp3");
    expect(result.audioUsUrl).toBeNull();
    expect(JSON.parse(result.referenceJson!)).toEqual({
      word: "resilient",
      phonetics: ["/rɪˈzɪl.i.ənt/"],
      meanings: [
        {
          partOfSpeech: "adjective",
          definitions: ["Able to recover quickly."],
        },
      ],
    });
  });

  it("returns null metadata gracefully on HTTP 404 (e.g. idioms)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Not Found", { status: 404 }));

    const result = await fetchFreeDictionaryReference(
      "bite the bullet",
      mockFetch,
    );
    expect(result).toEqual({
      audioUkUrl: null,
      audioUsUrl: null,
      referenceJson: null,
    });
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("fails open on network/timeout errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("Network timeout"));

    const result = await fetchFreeDictionaryReference("mitigate", mockFetch);
    expect(result).toEqual({
      audioUkUrl: null,
      audioUsUrl: null,
      referenceJson: null,
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("buildLookupPreview", () => {
  it("extracts word, IPA, audio URLs, and top 2 meanings with up to 2 definitions each", () => {
    const preview = buildLookupPreview("mitigate", {
      audioUkUrl: "https://cdn.example.com/mitigate-uk.mp3",
      audioUsUrl: "https://cdn.example.com/mitigate-us.mp3",
      referenceJson: JSON.stringify({
        word: "Mitigate",
        phonetics: ["/ˈmɪt.ɪ.ɡeɪt/", "/ˈmɪt̬.ə.ɡeɪt/"],
        meanings: [
          { partOfSpeech: "verb", definitions: ["Def 1", "Def 2", "Def 3"] },
          { partOfSpeech: "adjective", definitions: ["Adj 1"] },
          { partOfSpeech: "noun", definitions: ["Noun 1 should be skipped"] },
        ],
      }),
    });

    expect(preview).toEqual({
      query: "mitigate",
      word: "mitigate",
      ipa_texts: ["/ˈmɪt.ɪ.ɡeɪt/", "/ˈmɪt̬.ə.ɡeɪt/"],
      audio_uk_url: "https://cdn.example.com/mitigate-uk.mp3",
      audio_us_url: "https://cdn.example.com/mitigate-us.mp3",
      meanings: [
        { part_of_speech: "verb", definitions: ["Def 1", "Def 2"] },
        { part_of_speech: "adjective", definitions: ["Adj 1"] },
      ],
    });
  });

  it("supports audio-only results without referenceJson", () => {
    const preview = buildLookupPreview("resilient", {
      audioUkUrl: "https://cdn.example.com/resilient-uk.mp3",
      audioUsUrl: null,
      referenceJson: null,
    });

    expect(preview).toEqual({
      query: "resilient",
      word: "resilient",
      ipa_texts: [],
      audio_uk_url: "https://cdn.example.com/resilient-uk.mp3",
      audio_us_url: null,
      meanings: [],
    });
  });

  it("returns null when no audio, IPA, or meanings are present", () => {
    expect(
      buildLookupPreview("bite the bullet", {
        audioUkUrl: null,
        audioUsUrl: null,
        referenceJson: null,
      }),
    ).toBeNull();
  });
});
