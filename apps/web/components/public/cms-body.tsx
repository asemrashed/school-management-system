"use client";

import { usePublicPage } from "@/lib/hooks/use-public";

/** Renders a CMS page (server-sanitised HTML) edited under Admin → CMS Pages. */
export function CmsBody({ slug, fallbackTitle, fallbackText }: { slug: string; fallbackTitle: string; fallbackText?: string }) {
  const page = usePublicPage(slug);
  if (page.isLoading) return <div className="h-24 animate-pulse rounded-lg bg-ink/5" />;
  if (page.data) {
    return (
      <article>
        <h1 className="font-serif text-4xl font-semibold">{page.data.page.title}</h1>
        <div className="prose mt-5 max-w-none text-ink/80" dangerouslySetInnerHTML={{ __html: page.data.page.bodyHtml }} />
      </article>
    );
  }
  return (
    <article>
      <h1 className="font-serif text-4xl font-semibold">{fallbackTitle}</h1>
      {fallbackText && <p className="mt-4 text-ink/70">{fallbackText}</p>}
    </article>
  );
}
