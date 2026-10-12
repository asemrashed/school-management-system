"use client";

import { CmsBody } from "@/components/public/cms-body";
import { usePublicSite } from "@/lib/hooks/use-site";

export default function AboutPage() {
  const site = usePublicSite().data;
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <CmsBody slug="about" fallbackTitle={`About ${site?.general.schoolName ?? "our school"}`} fallbackText={site?.home.aboutText} />
    </main>
  );
}
