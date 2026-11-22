"use client";

import { useActionState, useState } from "react";

import { signIn, signUp, type AuthActionState } from "@/app/login/actions";

type AuthMode = "signin" | "signup";

type AuthFormProps = {
  nextPath: string;
  initialError?: string;
  isRestricted: boolean;
};

const INITIAL_STATE: AuthActionState = {};

export function AuthForm({
  nextPath,
  initialError,
  isRestricted,
}: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    INITIAL_STATE,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    INITIAL_STATE,
  );

  const state = mode === "signin" ? signInState : signUpState;
  const action = mode === "signin" ? signInAction : signUpAction;
  const pending = mode === "signin" ? signInPending : signUpPending;
  const bannerError =
    state.error ??
    (!state.success && !state.fieldErrors ? initialError : undefined);

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="mb-6 grid grid-cols-2 rounded-xl bg-background p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => setMode("signin")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "signin"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted hover:text-foreground"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => setMode("signup")}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "signup"
              ? "bg-surface text-foreground shadow-xs"
              : "text-muted hover:text-foreground"
          }`}
        >
          Create account
        </button>
      </div>

      {bannerError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {bannerError}
        </div>
      )}

      {state.success && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {state.success}
        </div>
      )}

      <form action={action} className="space-y-4" noValidate>
        {mode === "signin" && (
          <input type="hidden" name="next" value={nextPath} />
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-invalid={Boolean(state.fieldErrors?.email)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {state.fieldErrors?.email?.[0] && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.email[0]}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            required
            placeholder={
              mode === "signin"
                ? "Enter your password"
                : "At least 8 characters"
            }
            aria-invalid={Boolean(state.fieldErrors?.password)}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {state.fieldErrors?.password?.[0] && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>

        {mode === "signup" && (
          <div>
            <label
              htmlFor="auth-confirm-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Confirm password
            </label>
            <input
              id="auth-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Re-enter your password"
              aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            {state.fieldErrors?.confirmPassword?.[0] && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.confirmPassword[0]}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? mode === "signin"
              ? "Signing in…"
              : "Creating account…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted">
        {isRestricted
          ? "Private vault · Access restricted to authorized accounts."
          : "Your vocabulary and flashcards sync securely with Row Level Security."}
      </p>
    </div>
  );
}
