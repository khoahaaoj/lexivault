import { describe, expect, it } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  parseAuthEnv,
  parsePublicEnv,
  parseServerEnv,
} from "@/lib/env/schema";

describe("parsePublicEnv", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxx",
  };

  it("accepts a valid configuration", () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it("rejects a non-http(s) Supabase URL", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "ftp://abc" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("treats empty strings as missing", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});

describe("parseAuthEnv", () => {
  it("returns null when ALLOWED_EMAILS is unset or blank", () => {
    expect(parseAuthEnv({})).toEqual({ ALLOWED_EMAILS: null });
    expect(parseAuthEnv({ ALLOWED_EMAILS: "" })).toEqual({
      ALLOWED_EMAILS: null,
    });
    expect(parseAuthEnv({ ALLOWED_EMAILS: "   " })).toEqual({
      ALLOWED_EMAILS: null,
    });
  });

  it("normalizes, trims, and deduplicates comma-separated emails", () => {
    expect(
      parseAuthEnv({
        ALLOWED_EMAILS:
          " Owner@Example.com, partner@example.com , owner@example.com ",
      }),
    ).toEqual({
      ALLOWED_EMAILS: ["owner@example.com", "partner@example.com"],
    });
  });

  it("rejects malformed emails in ALLOWED_EMAILS", () => {
    expect(() =>
      parseAuthEnv({ ALLOWED_EMAILS: "owner@example.com, not-an-email" }),
    ).toThrow(/ALLOWED_EMAILS/);
  });

  it("rejects bare commas without any email", () => {
    expect(() => parseAuthEnv({ ALLOWED_EMAILS: " , , " })).toThrow(
      /ALLOWED_EMAILS/,
    );
  });
});

describe("parseServerEnv", () => {
  it(`defaults GEMINI_MODEL to ${DEFAULT_GEMINI_MODEL} and GROQ_MODEL to ${DEFAULT_GROQ_MODEL}`, () => {
    expect(parseServerEnv({ GEMINI_API_KEY: "gemini-key" })).toEqual({
      GROQ_API_KEY: undefined,
      GROQ_MODEL: DEFAULT_GROQ_MODEL,
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: DEFAULT_GEMINI_MODEL,
    });
  });

  it("accepts a Groq-only configuration", () => {
    expect(parseServerEnv({ GROQ_API_KEY: "gsk_test" })).toEqual({
      GROQ_API_KEY: "gsk_test",
      GROQ_MODEL: DEFAULT_GROQ_MODEL,
      GEMINI_API_KEY: undefined,
      GEMINI_MODEL: DEFAULT_GEMINI_MODEL,
    });
  });

  it("accepts both providers configured with custom models", () => {
    expect(
      parseServerEnv({
        GROQ_API_KEY: "gsk_test",
        GROQ_MODEL: "openai/gpt-oss-20b",
        GEMINI_API_KEY: "gemini-key",
        GEMINI_MODEL: "gemini-3.8-flash",
      }),
    ).toEqual({
      GROQ_API_KEY: "gsk_test",
      GROQ_MODEL: "openai/gpt-oss-20b",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "gemini-3.8-flash",
    });
  });

  it("falls back to default models when model env vars are empty", () => {
    const parsed = parseServerEnv({
      GROQ_API_KEY: "gsk_test",
      GROQ_MODEL: "",
      GEMINI_API_KEY: "gemini-key",
      GEMINI_MODEL: "",
    });
    expect(parsed.GROQ_MODEL).toBe(DEFAULT_GROQ_MODEL);
    expect(parsed.GEMINI_MODEL).toBe(DEFAULT_GEMINI_MODEL);
  });

  it("throws a readable error when neither GROQ_API_KEY nor GEMINI_API_KEY is set", () => {
    expect(() => parseServerEnv({})).toThrow(
      /Invalid server environment variables[\s\S]*GROQ_API_KEY or GEMINI_API_KEY/,
    );
  });
});
