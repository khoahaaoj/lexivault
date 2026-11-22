import "server-only";

import { parseServerEnv, type ServerEnv } from "./schema";

let cached: ServerEnv | undefined;

/**
 * Server-only env accessor. Importing this from a Client Component fails the
 * build, which guarantees secrets like GEMINI_API_KEY never ship to browsers.
 *
 * Validation is lazy (on first call) so `next build` and CI do not require
 * real secrets to be present.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
  return cached;
}
