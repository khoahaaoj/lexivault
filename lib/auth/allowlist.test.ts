import { describe, expect, it } from "vitest";

import {
  isEmailAllowed,
  isPublicRoute,
  sanitizeRedirectPath,
} from "@/lib/auth/allowlist";

describe("isEmailAllowed", () => {
  it("allows any email (including missing) when allowlist is null", () => {
    expect(isEmailAllowed("anyone@example.com", null)).toBe(true);
    expect(isEmailAllowed(null, null)).toBe(true);
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    const allowlist = ["owner@example.com", "partner@example.com"];
    expect(isEmailAllowed("OWNER@Example.com", allowlist)).toBe(true);
    expect(isEmailAllowed("  partner@example.com  ", allowlist)).toBe(true);
  });

  it("rejects unlisted, blank, or missing emails when allowlist is set", () => {
    const allowlist = ["owner@example.com"];
    expect(isEmailAllowed("stranger@example.com", allowlist)).toBe(false);
    expect(isEmailAllowed("", allowlist)).toBe(false);
    expect(isEmailAllowed(null, allowlist)).toBe(false);
    expect(isEmailAllowed(undefined, allowlist)).toBe(false);
  });
});

describe("isPublicRoute", () => {
  it("matches /login and /auth/callback routes", () => {
    expect(isPublicRoute("/login")).toBe(true);
    expect(isPublicRoute("/auth/callback")).toBe(true);
    expect(isPublicRoute("/auth/callback/extra")).toBe(true);
  });

  it("does not match protected app or API routes", () => {
    expect(isPublicRoute("/")).toBe(false);
    expect(isPublicRoute("/review")).toBe(false);
    expect(isPublicRoute("/vault")).toBe(false);
    expect(isPublicRoute("/api/lookup")).toBe(false);
    expect(isPublicRoute("/login-settings")).toBe(false);
  });
});

describe("sanitizeRedirectPath", () => {
  it("preserves safe relative paths with query strings and hashes", () => {
    expect(sanitizeRedirectPath("/")).toBe("/");
    expect(sanitizeRedirectPath("/vault?cefr=C1")).toBe("/vault?cefr=C1");
    expect(sanitizeRedirectPath("/review#card-1")).toBe("/review#card-1");
  });

  it("blocks open-redirect payloads", () => {
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
    expect(sanitizeRedirectPath("//evil.com/phish")).toBe("/");
    expect(sanitizeRedirectPath("/\\evil.com")).toBe("/");
    expect(sanitizeRedirectPath("/\r\nSet-Cookie: a=1")).toBe("/");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("avoids redirect loops back to auth routes", () => {
    expect(sanitizeRedirectPath("/login")).toBe("/");
    expect(sanitizeRedirectPath("/login?error=unauthorized")).toBe("/");
    expect(sanitizeRedirectPath("/auth/callback?code=123")).toBe("/");
  });

  it("falls back to / when empty", () => {
    expect(sanitizeRedirectPath(undefined)).toBe("/");
    expect(sanitizeRedirectPath(null)).toBe("/");
    expect(sanitizeRedirectPath("")).toBe("/");
  });
});
