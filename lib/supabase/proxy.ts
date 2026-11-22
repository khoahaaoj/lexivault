import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed, isPublicRoute } from "@/lib/auth/allowlist";
import { getPublicEnv } from "@/lib/env/public";
import { getAuthEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

const AUTH_CACHE_HEADERS = ["cache-control", "expires", "pragma"] as const;

function applyCookiesAndAuthHeaders(
  source: NextResponse,
  target: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
  AUTH_CACHE_HEADERS.forEach((header) => {
    const value = source.headers.get(header);
    if (value) {
      target.headers.set(header, value);
    }
  });
  return target;
}

/**
 * Refreshes the Supabase auth session on every matched request and enforces
 * route-level authentication + `ALLOWED_EMAILS` access control.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getPublicEnv();

  const supabase = createServerClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  // IMPORTANT: Do not insert logic between createServerClient and getClaims().
  // `getClaims()` verifies the JWT (locally via JWKS when asymmetric keys are
  // enabled) and transparently refreshes expiring sessions.
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : (data?.claims ?? null);

  const { pathname, search } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");
  const isPublic = isPublicRoute(pathname);

  if (!claims) {
    if (isApiRoute) {
      return applyCookiesAndAuthHeaders(
        supabaseResponse,
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
    }

    if (!isPublic) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      if (pathname !== "/") {
        loginUrl.searchParams.set("next", `${pathname}${search}`);
      }
      return applyCookiesAndAuthHeaders(
        supabaseResponse,
        NextResponse.redirect(loginUrl),
      );
    }

    return supabaseResponse;
  }

  // Defense in depth: verify authenticated email against server allowlist.
  const email = typeof claims.email === "string" ? claims.email : null;
  const { ALLOWED_EMAILS } = getAuthEnv();

  if (!isEmailAllowed(email, ALLOWED_EMAILS)) {
    await supabase.auth.signOut();

    if (isApiRoute) {
      return applyCookiesAndAuthHeaders(
        supabaseResponse,
        NextResponse.json(
          { error: "Forbidden: account is not authorized." },
          { status: 403 },
        ),
      );
    }

    if (pathname !== "/login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("error", "unauthorized");
      return applyCookiesAndAuthHeaders(
        supabaseResponse,
        NextResponse.redirect(loginUrl),
      );
    }

    return supabaseResponse;
  }

  // Signed-in, authorized user visiting `/login` -> redirect to the app.
  if (pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return applyCookiesAndAuthHeaders(
      supabaseResponse,
      NextResponse.redirect(homeUrl),
    );
  }

  return supabaseResponse;
}
