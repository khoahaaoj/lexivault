"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isEmailAllowed, sanitizeRedirectPath } from "@/lib/auth/allowlist";
import { signInSchema, signUpSchema } from "@/lib/auth/schemas";
import { getAuthEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  success?: string;
  fieldErrors?: {
    email?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
};

async function resolveRequestOrigin(): Promise<string | undefined> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) {
    return origin;
  }
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    return undefined;
  }
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { email, password } = parsed.data;
  const { ALLOWED_EMAILS } = getAuthEnv();

  if (!isEmailAllowed(email, ALLOWED_EMAILS)) {
    return {
      error: "Access is restricted to authorized accounts.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        error: "Please confirm your email address before signing in.",
      };
    }
    return {
      error: "Invalid email or password.",
    };
  }

  const nextPath = sanitizeRedirectPath(
    typeof formData.get("next") === "string"
      ? String(formData.get("next"))
      : null,
  );
  redirect(nextPath);
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { email, password } = parsed.data;
  const { ALLOWED_EMAILS } = getAuthEnv();

  // Block unauthorized emails BEFORE touching Supabase Auth.
  if (!isEmailAllowed(email, ALLOWED_EMAILS)) {
    return {
      error: "Sign-up is restricted to authorized accounts.",
    };
  }

  const origin = await resolveRequestOrigin();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: origin ? { emailRedirectTo: `${origin}/auth/callback` } : {},
  });

  if (error) {
    if (
      error.message.toLowerCase().includes("signups not allowed") ||
      error.code === "signup_disabled"
    ) {
      return {
        error: "New account sign-ups are currently disabled.",
      };
    }
    return {
      error: "Unable to create account. Please try again.",
    };
  }

  // If email confirmation is disabled in Supabase, session is active right away.
  if (data.session) {
    redirect("/");
  }

  return {
    success:
      "Check your inbox for a confirmation link to finish activating your account.",
  };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
