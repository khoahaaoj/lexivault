/**
 * Pure, framework-agnostic access-control and redirect helpers.
 * Unit-tested in `allowlist.test.ts`.
 */

const PUBLIC_ROUTE_PREFIXES = ["/login", "/auth/callback"] as const;
const PLACEHOLDER_ORIGIN = "https://lexivault.local";
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/**
 * Checks whether an email is permitted by the server-side `ALLOWED_EMAILS`
 * allowlist.
 *
 * - When `allowedEmails` is `null` (env var unset), access is unrestricted.
 * - Otherwise, comparison is case-insensitive and trimmed.
 */
export function isEmailAllowed(
  email: string | null | undefined,
  allowedEmails: readonly string[] | null,
): boolean {
  if (allowedEmails === null) {
    return true;
  }
  if (!email) {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return allowedEmails.some(
    (allowed) => allowed.trim().toLowerCase() === normalized,
  );
}

/**
 * Returns true if the pathname can be accessed without an active session.
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Prevents open-redirect vulnerabilities on `?next=...` query parameters and
 * avoids redirect loops back into auth routes.
 */
export function sanitizeRedirectPath(next: string | null | undefined): string {
  if (!next) {
    return "/";
  }
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    CONTROL_CHARS.test(next)
  ) {
    return "/";
  }

  try {
    const parsed = new URL(next, PLACEHOLDER_ORIGIN);
    if (parsed.origin !== PLACEHOLDER_ORIGIN) {
      return "/";
    }
    if (isPublicRoute(parsed.pathname)) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
