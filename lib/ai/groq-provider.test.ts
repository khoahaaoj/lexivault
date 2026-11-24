import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  GroqApiError,
  buildGroqReasoningParams,
  enrichWithGroq,
  streamWithGroq,
} from "@/lib/ai/groq-provider";

const SAMPLE_RESPONSE = {
  is_valid: true,
  suggestion: null,
  entries: [
    {
      word: "ephemeral",
      part_of_speech: "adjective",
      cefr_level: "C1" as const,
      ipa_uk: "/ɪˈfem.ər.əl/",
      ipa_us: "/ɪˈfem.ɚ.əl/",
      definition_en: "lasting for only a short time",
      explanation_vi:
        "Chỉ tồn tại trong một khoảng thời gian ngắn ngủi rồi biến mất.",
      nuance_note_vi:
        "Trang trọng, thường gặp trong IELTS Writing Task 2 hoặc mô tả xu hướng.",
      collocations: [
        { phrase: "ephemeral nature", meaning_vi: "bản chất ngắn ngủi" },
      ],
      synonyms: [
        { word: "transient", difference_vi: "nhấn mạnh sự chuyển tiếp nhanh" },
      ],
      antonyms: [{ word: "permanent", meaning_vi: "vĩnh viễn" }],
      examples: [
        {
          en: "Social media trends are often ephemeral.",
          vi: "Các xu hướng mạng xã hội thường sớm nở tối tàn.",
        },
      ],
    },
  ],
};

describe("buildGroqReasoningParams", () => {
  it("sets low reasoning_effort on openai/gpt-oss models and none on qwen3 models", () => {
    expect(buildGroqReasoningParams("openai/gpt-oss-120b")).toEqual({
      reasoning_effort: "low",
    });
    expect(buildGroqReasoningParams("openai/gpt-oss-20b")).toEqual({
      reasoning_effort: "low",
    });
    expect(buildGroqReasoningParams("qwen/qwen3.8-27b")).toEqual({
      reasoning_effort: "none",
    });
    expect(buildGroqReasoningParams("llama-3.3-70b-versatile")).toEqual({});
  });
});

describe("enrichWithGroq", () => {
  it("sends structured json_schema request and returns validated dictionary DTO", async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(SAMPLE_RESPONSE) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await enrichWithGroq({
      apiKey: "gsk_test",
      model: "openai/gpt-oss-120b",
      term: "ephemeral",
      fetchImpl: mockFetch,
    });

    expect(result).toEqual(SAMPLE_RESPONSE);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gsk_test");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.stream).toBe(false);
    expect(body.reasoning_effort).toBe("low");
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "dictionary_response", strict: true },
    });
  });

  it("throws GroqApiError on HTTP 429 or 503 responses", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));

    await expect(
      enrichWithGroq({
        apiKey: "gsk_test",
        model: "openai/gpt-oss-120b",
        term: "ephemeral",
        fetchImpl: mockFetch,
      }),
    ).rejects.toMatchObject({
      name: "GroqApiError",
      status: 429,
    });
  });
});

describe("streamWithGroq", () => {
  it("streams unbuffered SSE delta chunks, strips fences, and parses final JSON", async () => {
    const fencedJson = `\`\`\`json\n${JSON.stringify(SAMPLE_RESPONSE)}\n\`\`\``;
    const part1 = fencedJson.slice(0, Math.floor(fencedJson.length / 2));
    const part2 = fencedJson.slice(Math.floor(fencedJson.length / 2));
    const sseFrame1 = `data: ${JSON.stringify({ choices: [{ delta: { content: part1 } }] })}\n\n`;
    const sseFrame2 = `data: ${JSON.stringify({ choices: [{ delta: { content: part2 } }] })}\n\ndata: [DONE]\n\n`;

    const encoder = new TextEncoder();
    const splitAt = Math.floor(sseFrame1.length / 2);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseFrame1.slice(0, splitAt)));
        controller.enqueue(
          encoder.encode(sseFrame1.slice(splitAt) + sseFrame2),
        );
        controller.close();
      },
    });

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      }),
    );

    const chunks: string[] = [];
    const result = await streamWithGroq({
      apiKey: "gsk_test",
      model: "openai/gpt-oss-120b",
      term: "ephemeral",
      onChunk: (acc) => chunks.push(acc),
      fetchImpl: mockFetch,
    });

    const body = JSON.parse(
      String(mockFetch.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body.stream).toBe(true);
    expect(body.response_format).toBeUndefined();
    expect(chunks).toEqual([part1, fencedJson]);
    expect(result).toEqual(SAMPLE_RESPONSE);
  });

  it("throws GroqApiError when stream endpoint returns 503", async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("overloaded", { status: 503 }));

    await expect(
      streamWithGroq({
        apiKey: "gsk_test",
        model: "openai/gpt-oss-120b",
        term: "ephemeral",
        fetchImpl: mockFetch,
      }),
    ).rejects.toBeInstanceOf(GroqApiError);
  });
});
