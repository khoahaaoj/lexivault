import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 Proxy (replaces legacy `middleware.ts`).
 * Refreshes Supabase auth cookies and enforces session/allowlist checks before
 * requests reach pages or Route Handlers.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - `_next/static` (static files)
     * - `_next/image` (image optimization files)
     * - `favicon.ico`, PWA manifests, `robots.txt`, `sitemap.xml`
     * - common static image/icon extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.(?:json|webmanifest)|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
