import { describe, expect, it } from "vitest";

import {
  DEFAULT_GEMINI_MODEL,
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
  it(`defaults GEMINI_MODEL to ${DEFAULT_GEMINI_MODEL}`, () => {
    expect(parseServerEnv({ GEMINI_API_KEY: "key" })).toEqual({
      GEMINI_API_KEY: "key",
      GEMINI_MODEL: DEFAULT_GEMINI_MODEL,
    });
  });

  it("falls back to the default model when GEMINI_MODEL is empty", () => {
    expect(
      parseServerEnv({ GEMINI_API_KEY: "key", GEMINI_MODEL: "" }).GEMINI_MODEL,
    ).toBe(DEFAULT_GEMINI_MODEL);
  });

  it("respects an explicit GEMINI_MODEL", () => {
    expect(
      parseServerEnv({ GEMINI_API_KEY: "key", GEMINI_MODEL: "gemini-2.5-pro" })
        .GEMINI_MODEL,
    ).toBe("gemini-2.5-pro");
  });

  it("throws a readable error when GEMINI_API_KEY is missing", () => {
    expect(() => parseServerEnv({})).toThrow(
      /Invalid server environment variables[\s\S]*GEMINI_API_KEY/,
    );
  });
});
