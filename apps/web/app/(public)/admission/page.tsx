"use client";

import { CmsBody } from "@/components/public/cms-body";
import { AdmissionForm } from "@/components/public/public-forms";
import { usePublicSite } from "@/lib/hooks/use-site";

export default function AdmissionPage() {
  const site = usePublicSite().data;
  return (
    <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <CmsBody slug="admission" fallbackTitle="Admission" />
      <section aria-labelledby="apply" className="mt-12 rounded-2xl border border-ink/10 bg-white p-6 sm:p-8">
        <h2 id="apply" className="font-serif text-2xl font-semibold">Apply online</h2>
        {site?.admission.intro && <p className="mb-6 mt-1 text-sm text-ink/70">{site.admission.intro}</p>}
        <AdmissionForm />
      </section>
    </main>
  );
}
