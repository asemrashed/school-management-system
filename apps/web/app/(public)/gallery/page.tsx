"use client";

import * as React from "react";
import { usePublicGallery } from "@/lib/hooks/use-site";

export default function GalleryPage() {
  const gallery = usePublicGallery();
  const [active, setActive] = React.useState<{ url: string; caption: string | null } | null>(null);
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold">Gallery</h1>
      {gallery.isLoading && <p className="mt-6 text-ink/60">Loading…</p>}
      {gallery.isError && <p className="mt-6 text-ink/60">The gallery could not be loaded.</p>}
      {gallery.data?.items.length === 0 && <p className="mt-6 text-ink/60">Photos will appear here soon.</p>}
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {gallery.data?.items.map((g) => (
          <button key={g.id} type="button" onClick={() => setActive(g)} className="group overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">
            <img src={g.url} alt={g.caption ?? "School photo"} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
          </button>
        ))}
      </div>
      {active && (
        <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setActive(null)}>
          <figure className="max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img src={active.url} alt={active.caption ?? "School photo"} className="max-h-[80vh] rounded-lg object-contain" />
            {active.caption && <figcaption className="mt-2 text-center text-sm text-white/80">{active.caption}</figcaption>}
          </figure>
          <button type="button" aria-label="Close" className="absolute right-4 top-4 text-3xl text-white" onClick={() => setActive(null)}>×</button>
        </div>
      )}
    </main>
  );
}
