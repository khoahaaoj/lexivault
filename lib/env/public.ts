import { parsePublicEnv, type PublicEnv } from "./schema";

let cached: PublicEnv | undefined;

/**
 * Browser-safe env accessor.
 *
 * Each variable is referenced with a literal `process.env.NEXT_PUBLIC_*`
 * expression on purpose: Next.js only inlines public env vars into the client
 * bundle when they are accessed statically.
 */
export function getPublicEnv(): PublicEnv {
  cached ??= parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return cached;
}
