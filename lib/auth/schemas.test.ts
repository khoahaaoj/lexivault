import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "@/lib/auth/schemas";

describe("signInSchema", () => {
  it("normalizes email casing and whitespace", () => {
    const result = signInSchema.safeParse({
      email: "  User@Example.COM ",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid emails and empty passwords", () => {
    const result = signInSchema.safeParse({
      email: "not-an-email",
      password: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts matching passwords of at least 8 characters", () => {
    const result = signUpSchema.safeParse({
      email: "learner@example.com",
      password: "strong-password-123",
      confirmPassword: "strong-password-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = signUpSchema.safeParse({
      email: "learner@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirmation passwords", () => {
    const result = signUpSchema.safeParse({
      email: "learner@example.com",
      password: "strong-password-123",
      confirmPassword: "different-password",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });
});
