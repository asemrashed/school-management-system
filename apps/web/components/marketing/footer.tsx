import Link from "next/link";
import { Button } from "@packages/ui";

export function FooterCta() {
  return (
    <section className="border-t border-ink/10 bg-brand-700">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
        <h2 className="max-w-md font-serif text-2xl font-semibold text-white sm:text-3xl">
          See it running on your own school's classes and sections.
        </h2>
        <Button
          size="lg"
          className="bg-brass-400 text-ink hover:bg-brass-500"
          asChild
        >
          <a href="#contact">Book a demo</a>
        </Button>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "#about" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    heading: "Portal",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Notice board", href: "/notice" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "/policies/privacy" },
      { label: "Terms of service", href: "/policies/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <p className="font-serif text-sm text-white">{col.heading}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/40">
          © {new Date().getFullYear()} School Portal. Built for Green Valley
          English Medium School.
        </div>
      </div>
    </footer>
  );
}
