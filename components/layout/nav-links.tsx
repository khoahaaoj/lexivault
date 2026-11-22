"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavRoute = {
  href: "/" | "/review" | "/vault";
  label: string;
  icon: (active: boolean) => ReactNode;
};

const NAV_ROUTES: readonly NavRoute[] = [
  {
    href: "/",
    label: "Lookup",
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    href: "/review",
    label: "Review",
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <rect width="16" height="12" x="4" y="6" rx="2" />
        <path d="M8 2h8" />
        <path d="M8 22h8" />
      </svg>
    ),
  },
  {
    href: "/vault",
    label: "Vault",
    icon: (active) => (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.25 : 1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    ),
  },
];

function isRouteActive(pathname: string, href: NavRoute["href"]): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant }: { variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
        {NAV_ROUTES.map((item) => {
          const active = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed right-0 bottom-0 left-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 px-2 py-1.5">
        {NAV_ROUTES.map((item) => {
          const active = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-xs font-medium transition-colors ${
                active ? "text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {item.icon(active)}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
