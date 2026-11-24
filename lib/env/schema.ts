import { z } from "zod";

/**
 * Environment variable schemas.
 *
 * This module is intentionally pure (no `process.env` access, no `server-only`)
 * so it can be unit-tested in isolation. Runtime accessors live in
 * `./public.ts` (browser-safe) and `./server.ts` (server-only).
 */

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Safe to expose to the browser (inlined at build time by Next.js). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/**
 * Optional server-only email allowlist (`ALLOWED_EMAILS=a@x.com,b@y.com`).
 *
 * - Unset or blank -> `null` (unrestricted; convenient for local development).
 * - Non-empty -> validated, deduplicated lowercase email list.
 * - Malformed entries (e.g. typos or bare commas) throw loudly instead of
 *   silently opening access.
 */
const allowedEmailsSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return null;
    }
    const items = value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0);
    return Array.from(new Set(items));
  })
  .pipe(z.array(z.email()).min(1).nullable());

/** Server-only access control variables (independent of Gemini config). */
export const authEnvSchema = z.object({
  ALLOWED_EMAILS: allowedEmailsSchema,
});

/** Secrets that must never reach the client bundle. */
export const serverEnvSchema = z
  .object({
    GROQ_API_KEY: z.string().trim().min(1).optional(),
    GROQ_MODEL: z
      .string()
      .trim()
      .min(1)
      .optional()
      .transform((value) => value ?? DEFAULT_GROQ_MODEL),
    GEMINI_API_KEY: z.string().trim().min(1).optional(),
    GEMINI_MODEL: z
      .string()
      .trim()
      .min(1)
      .optional()
      .transform((value) => value ?? DEFAULT_GEMINI_MODEL),
  })
  .refine((env) => Boolean(env.GROQ_API_KEY || env.GEMINI_API_KEY), {
    message:
      "At least one AI provider key (GROQ_API_KEY or GEMINI_API_KEY) must be configured.",
  });

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type AuthEnv = z.infer<typeof authEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

type RawEnv = Record<string, string | undefined>;

/** Treat empty strings (common in copied `.env` files) as "not set". */
function normalize(source: RawEnv): RawEnv {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      value === "" ? undefined : value,
    ]),
  );
}

function parseOrThrow<T extends z.ZodType>(
  schema: T,
  source: RawEnv,
  label: string,
): z.infer<T> {
  const result = schema.safeParse(normalize(source));
  if (!result.success) {
    throw new Error(
      `Invalid ${label} environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export function parsePublicEnv(source: RawEnv): PublicEnv {
  return parseOrThrow(publicEnvSchema, source, "public");
}

export function parseAuthEnv(source: RawEnv): AuthEnv {
  return parseOrThrow(authEnvSchema, source, "auth");
}

export function parseServerEnv(source: RawEnv): ServerEnv {
  return parseOrThrow(serverEnvSchema, source, "server");
}
