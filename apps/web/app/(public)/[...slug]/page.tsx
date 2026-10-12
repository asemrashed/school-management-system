"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LoadingSkeleton } from "@packages/ui";
import { usePublicPage } from "@/lib/hooks/use-public";

export default function PublicCmsPage() {
  const params = useParams<{ slug: string | string[] }>();
  const slug = Array.isArray(params.slug) ? params.slug.join("/") : params.slug ?? "";
  const page = usePublicPage(slug);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Back home
      </Link>

      {page.isLoading && (
        <div className="mt-6">
          <LoadingSkeleton rows={4} />
        </div>
      )}

      {page.isError && (
        <div className="mt-6">
          <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            This page hasn&apos;t been published yet, or the link is incorrect.
          </p>
        </div>
      )}

      {page.data && (
        <article className="mt-6">
          <h1 className="text-2xl font-semibold text-slate-900">{page.data.page.title}</h1>
          <div
            className="prose prose-sm mt-4 max-w-none text-slate-700"
            dangerouslySetInnerHTML={{ __html: page.data.page.bodyHtml }}
          />
        </article>
      )}
    </main>
  );
}
