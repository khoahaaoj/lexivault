import "server-only";

import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/auth/allowlist";
import { getAuthEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthUser = {
  id: string;
  email: string;
};

export type AuthSessionResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" }
  | { status: "forbidden"; email: string | null };

/**
 * Data Access Layer (DAL) auth verification.
 *
 * Calls `supabase.auth.getUser()` so every sensitive server render, Server
 * Action, and Route Handler verifies live session validity against Supabase
 * Auth (not just cookies) AND checks `ALLOWED_EMAILS`.
 */
export async function getAuthSession(): Promise<AuthSessionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { status: "unauthenticated" };
  }

  const email = data.user.email ?? null;
  const { ALLOWED_EMAILS } = getAuthEnv();

  if (!isEmailAllowed(email, ALLOWED_EMAILS)) {
    return { status: "forbidden", email };
  }

  return {
    status: "authenticated",
    user: {
      id: data.user.id,
      email: email ?? "",
    },
  };
}

/**
 * Enforces an authenticated, allowlisted user inside Server Components /
 * Server Actions. Redirects to `/login` otherwise.
 */
export async function requirePageUser(): Promise<AuthUser> {
  const session = await getAuthSession();

  if (session.status === "unauthenticated") {
    redirect("/login");
  }

  if (session.status === "forbidden") {
    redirect("/login?error=unauthorized");
  }

  return session.user;
}

/**
 * Enforces an authenticated, allowlisted user inside `/api/*` Route Handlers.
 * Always use this before calling external APIs (like Gemini) or touching DB.
 */
export async function requireApiUser(): Promise<
  | { user: AuthUser; response?: never }
  | { user?: never; response: NextResponse }
> {
  const session = await getAuthSession();

  if (session.status === "unauthenticated") {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (session.status === "forbidden") {
    return {
      response: NextResponse.json(
        { error: "Forbidden: account is not authorized." },
        { status: 403 },
      ),
    };
  }

  return { user: session.user };
}
