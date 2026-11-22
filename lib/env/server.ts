import "server-only";

import {
  parseAuthEnv,
  parseServerEnv,
  type AuthEnv,
  type ServerEnv,
} from "./schema";

let cachedServerEnv: ServerEnv | undefined;
let cachedAuthEnv: AuthEnv | undefined;

/**
 * Server-only env accessor for AI/backend secrets. Importing this module from
 * a Client Component fails the build, guaranteeing secrets never ship to browsers.
 *
 * Validation is lazy (on first call) so `next build` and CI do not require
 * real secrets to be present.
 */
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
  return cachedServerEnv;
}

/**
 * Server-only auth/access-control env accessor. Kept separate from
 * `getServerEnv()` so authentication works before `GEMINI_API_KEY` is set.
 */
export function getAuthEnv(): AuthEnv {
  cachedAuthEnv ??= parseAuthEnv({
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
  });
  return cachedAuthEnv;
}
