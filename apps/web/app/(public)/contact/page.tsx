"use client";

import { ContactForm } from "@/components/public/public-forms";
import { usePublicSite } from "@/lib/hooks/use-site";

/** Only Google Maps embeds are rendered, whatever an admin pastes. */
function safeMapSrc(url: string): string | null {
  try {
    const u = new URL(url);
    const ok = u.protocol === "https:" && (u.hostname === "www.google.com" || u.hostname === "maps.google.com") && u.pathname.startsWith("/maps");
    return ok ? u.toString() : null;
  } catch { return null; }
}

export default function ContactPage() {
  const g = usePublicSite().data?.general;
  const map = g?.mapEmbedUrl ? safeMapSrc(g.mapEmbedUrl) : null;
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold">Contact us</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <ContactForm />
        </div>
        <div className="flex flex-col gap-4">
          <address className="rounded-2xl border border-ink/10 bg-white p-5 not-italic text-sm leading-relaxed">
            <p className="font-semibold">{g?.schoolName}</p>
            {g?.address && <p>{g.address}</p>}
            {g?.phone && <p>Phone: <a className="text-brand-700 hover:underline" href={`tel:${g.phone.replace(/[^+\d]/g, "")}`}>{g.phone}</a></p>}
            {g?.email && <p>Email: <a className="text-brand-700 hover:underline" href={`mailto:${g.email}`}>{g.email}</a></p>}
            {g?.officeHours && <p className="text-ink/60">{g.officeHours}</p>}
          </address>
          {map && <iframe title="School location" src={map} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full rounded-2xl border border-ink/10" />}
        </div>
      </div>
    </main>
  );
}
