import { z } from "zod";

/**
 * Environment variable schemas.
 *
 * This module is intentionally pure (no `process.env` access, no `server-only`)
 * so it can be unit-tested in isolation. Runtime accessors live in
 * `./public.ts` (browser-safe) and `./server.ts` (server-only).
 */

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Safe to expose to the browser (inlined at build time by Next.js). */
export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/** Secrets that must never reach the client bundle. */
export const serverEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z
    .string()
    .trim()
    .min(1)
    .optional()
    .transform((value) => value ?? DEFAULT_GEMINI_MODEL),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
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

export function parseServerEnv(source: RawEnv): ServerEnv {
  return parseOrThrow(serverEnvSchema, source, "server");
}
