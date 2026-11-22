import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/app/login/auth-form";
import { sanitizeRedirectPath } from "@/lib/auth/allowlist";
import { getAuthEnv } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your personal LexiVault dictionary and flashcards.",
};

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "This account is not authorized to access LexiVault.",
  auth_callback_failed:
    "The confirmation link is invalid or has expired. Please try again.",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function LoginFormSection({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const params = await searchParams;
  const nextPath = sanitizeRedirectPath(firstParam(params.next));
  const errorCode = firstParam(params.error);
  const initialError = errorCode ? ERROR_MESSAGES[errorCode] : undefined;
  const isRestricted = getAuthEnv().ALLOWED_EMAILS !== null;

  return (
    <AuthForm
      nextPath={nextPath}
      initialError={initialError}
      isRestricted={isRestricted}
    />
  );
}

function LoginFormSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-96 w-full animate-pulse rounded-2xl border border-border bg-surface p-6 sm:p-8"
    />
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-foreground shadow-sm">
          LV
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          LexiVault
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Personal English–Vietnamese dictionary &amp; SM-2 flashcards
        </p>
      </div>

      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginFormSection searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
