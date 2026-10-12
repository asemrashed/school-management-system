"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { usePublicSite } from "@/lib/hooks/use-site";

const HREF = { home: "/", about: "/about", admission: "/admission", gallery: "/gallery", contact: "/contact" } as const;

export function SiteHeader() {
  const site = usePublicSite();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => setOpen(false), [pathname]);

  const g = site.data?.general;
  const links = (g?.nav ?? []).filter((n) => n.visible);

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          {g?.logoUrl ? <img src={g.logoUrl} alt="" className="h-9 w-9 rounded object-contain" /> : <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 font-serif text-lg text-paper">{(g?.schoolName ?? "S").charAt(0)}</span>}
          <span className="font-serif text-lg font-semibold">{g?.schoolName ?? "School"}</span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {links.map((n) => (
            <Link key={n.key} href={HREF[n.key]} aria-current={pathname === HREF[n.key] ? "page" : undefined} className={`text-sm hover:text-ink ${pathname === HREF[n.key] ? "font-medium text-ink" : "text-ink/70"}`}>{n.label}</Link>
          ))}
          <Link href="/login" className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-medium text-paper hover:bg-brand-800">Portal login</Link>
        </nav>
        <button type="button" className="md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-ink/10 px-4 py-3 md:hidden" aria-label="Mobile">
          {links.map((n) => <Link key={n.key} href={HREF[n.key]} className="rounded px-2 py-2 text-sm hover:bg-ink/5">{n.label}</Link>)}
          <Link href="/login" className="rounded px-2 py-2 text-sm font-medium text-brand-700">Portal login</Link>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const g = usePublicSite().data?.general;
  return (
    <footer className="mt-16 border-t border-ink/10 bg-brand-900 text-paper/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-serif text-lg text-paper">{g?.schoolName}</p>
          <p className="mt-1 text-sm">{g?.tagline}</p>
        </div>
        <div className="text-sm">
          <p className="font-medium text-paper">Contact</p>
          {g?.address && <p className="mt-1">{g.address}</p>}
          {g?.phone && <p>{g.phone}</p>}
          {g?.email && <p>{g.email}</p>}
          {g?.officeHours && <p className="mt-1 text-paper/60">{g.officeHours}</p>}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium text-paper">Follow</p>
          {g?.facebookUrl && <a className="hover:text-paper" href={g.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>}
          {g?.youtubeUrl && <a className="hover:text-paper" href={g.youtubeUrl} target="_blank" rel="noopener noreferrer">YouTube</a>}
          <Link className="hover:text-paper" href="/notice">Notice board</Link>
        </div>
      </div>
      <p className="border-t border-paper/10 py-4 text-center text-xs text-paper/50">© {new Date().getFullYear()} {g?.schoolName}</p>
    </footer>
  );
}
