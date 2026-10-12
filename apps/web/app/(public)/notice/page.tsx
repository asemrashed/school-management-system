"use client";

import Link from "next/link";
import { Card, CardContent, LoadingSkeleton, EmptyState } from "@packages/ui";
import { usePublicNotices } from "@/lib/hooks/use-public";

export default function PublicNoticePage() {
  const notices = usePublicNotices();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Back home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Notice board</h1>
      <p className="mt-1 text-sm text-slate-500">Public notices from the school.</p>

      <div className="mt-6 flex flex-col gap-3">
        {notices.isLoading && <LoadingSkeleton rows={4} />}
        {!notices.isLoading && notices.data?.items.length === 0 && (
          <EmptyState title="No notices published yet" />
        )}
        {notices.data?.items.map((n) => (
          <Card key={n.id}>
            <CardContent className="pt-5">
              <p className="text-sm font-semibold text-slate-800">{n.title}</p>
              <div
                className="prose prose-sm mt-2 max-w-none text-slate-600"
                dangerouslySetInnerHTML={{ __html: n.bodyHtml }}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
