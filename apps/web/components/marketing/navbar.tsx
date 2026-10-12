"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@packages/ui";

const SOLUTIONS = [
  { label: "Administrators", href: "#roles-admin" },
  { label: "Teachers", href: "#roles-teacher" },
  { label: "Parents", href: "#roles-parent" },
  { label: "Students", href: "#roles-student" },
];

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "About us", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [solutionsOpen, setSolutionsOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="#top" className="flex items-center gap-2">
          <BellMark />
          <span className="font-serif text-lg font-semibold text-ink">School Portal</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          <Link href="#top" className="text-sm text-ink/70 hover:text-ink">
            Home
          </Link>
          <div
            className="relative"
            onMouseEnter={() => setSolutionsOpen(true)}
            onMouseLeave={() => setSolutionsOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-ink/70 hover:text-ink"
              onClick={() => setSolutionsOpen((v) => !v)}
            >
              Solutions <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {solutionsOpen && (
              <div className="absolute left-0 top-full w-48 border border-ink/10 bg-paper py-1 shadow-sm">
                {SOLUTIONS.map((s) => (
                  <a
                    key={s.href}
                    href={s.href}
                    className="block px-4 py-2 text-sm text-ink/70 hover:bg-brand-50 hover:text-ink"
                    onClick={() => setSolutionsOpen(false)}
                  >
                    For {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-ink/70 hover:text-ink">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a href="#contact" className="text-sm font-medium text-ink/70 hover:text-ink">
            Book a demo
          </a>
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-ink/10 bg-paper px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            <a href="#top" className="text-sm text-ink/80" onClick={() => setMobileOpen(false)}>
              Home
            </a>
            {SOLUTIONS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                className="text-sm text-ink/80"
                onClick={() => setMobileOpen(false)}
              >
                For {s.label}
              </a>
            ))}
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-ink/80"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link href="/login" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="mt-2 w-full">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function BellMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c-3.5 0-5.5 2.5-5.5 6v3.5L4 16h16l-2.5-3.5V9c0-3.5-2-6-5.5-6Z"
        stroke="#2a655c"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke="#c99a3d" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
