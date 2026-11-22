import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isEmailAllowed, sanitizeRedirectPath } from "@/lib/auth/allowlist";
import { getAuthEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const otpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function getRedirectOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.VERCEL === "1") {
    return `https://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}

/**
 * Handles Supabase Auth email confirmation links (both PKCE `code` exchange
 * and `token_hash` OTP verification) and enforces `ALLOWED_EMAILS`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const nextPath = sanitizeRedirectPath(searchParams.get("next"));
  const origin = getRedirectOrigin(request);

  const supabase = await createSupabaseServerClient();
  let authFailed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authFailed = Boolean(error);
  } else if (tokenHash && rawType) {
    const parsedType = otpTypeSchema.safeParse(rawType);
    if (parsedType.success) {
      const { error } = await supabase.auth.verifyOtp({
        type: parsedType.data as EmailOtpType,
        token_hash: tokenHash,
      });
      authFailed = Boolean(error);
    }
  }

  if (authFailed) {
    return NextResponse.redirect(
      new URL("/login?error=auth_callback_failed", origin),
    );
  }

  const { data } = await supabase.auth.getUser();
  const { ALLOWED_EMAILS } = getAuthEnv();

  if (!data.user || !isEmailAllowed(data.user.email, ALLOWED_EMAILS)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=unauthorized", origin));
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
