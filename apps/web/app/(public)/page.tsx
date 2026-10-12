"use client";

import Link from "next/link";
import { usePublicSite } from "@/lib/hooks/use-site";

/** The single-page Home: hero, about, how the system helps, notices, teachers, gallery, call to action. */
export default function HomePage() {
  const { data: site, isLoading, isError } = usePublicSite();
  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-24 text-center text-ink/60">Loading…</div>;
  if (isError || !site) return <div className="mx-auto max-w-6xl px-4 py-24 text-center text-ink/60">The website could not be loaded. Please try again shortly.</div>;
  const { home, general, admission } = site;

  return (
    <main>
      <section className="relative isolate overflow-hidden bg-brand-900 text-paper">
        {home.heroImageUrl && <img src={home.heroImageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />}
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight sm:text-6xl">{home.heroTitle}</h1>
          <p className="mt-5 max-w-2xl text-lg text-paper/85">{home.heroSubtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {admission.open && <Link href="/admission" className="rounded-full bg-brass-400 px-6 py-3 text-sm font-semibold text-ink hover:bg-brass-300">{home.heroPrimaryLabel || "Apply for admission"}</Link>}
            <Link href="/contact" className="rounded-full border border-paper/40 px-6 py-3 text-sm font-medium hover:bg-paper/10">Contact us</Link>
          </div>
        </div>
      </section>

      {home.showNotices && site.notices.length > 0 && (
        <section aria-label="Latest notices" className="border-b border-ink/10 bg-brass-50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 text-sm sm:px-6">
            <span className="font-semibold text-brass-600">Latest</span>
            {site.notices.slice(0, 3).map((n) => <Link key={n.id} href="/notice" className="hover:underline">{n.title}</Link>)}
            <Link href="/notice" className="ml-auto text-brand-700 hover:underline">All notices →</Link>
          </div>
        </section>
      )}

      <section id="about" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold">{home.aboutTitle}</h2>
        <p className="mt-4 max-w-3xl whitespace-pre-line text-lg leading-relaxed text-ink/75">{home.aboutText}</p>
        <Link href="/about" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">Read more about us →</Link>
      </section>

      {home.features.length > 0 && (
        <section className="bg-white/60 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-serif text-3xl font-semibold">How our school management system helps</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {home.features.map((f, i) => (
                <div key={i} className="rounded-2xl border border-ink/10 bg-paper p-5">
                  <span className="font-serif text-2xl text-brass-500">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink/70">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {home.showTeachers && site.teachers.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-serif text-3xl font-semibold">Our teachers</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {site.teachers.map((t) => (
              <article key={t.id} className="text-center">
                {t.photoUrl ? <img src={t.photoUrl} alt={t.name} loading="lazy" className="mx-auto h-32 w-32 rounded-full object-cover" /> : <div aria-hidden className="mx-auto grid h-32 w-32 place-items-center rounded-full bg-brand-100 font-serif text-4xl text-brand-700">{t.name.charAt(0)}</div>}
                <h3 className="mt-3 font-semibold">{t.name}</h3>
                {t.designation && <p className="text-sm text-brand-700">{t.designation}</p>}
                {t.bio && <p className="mt-1 text-sm text-ink/65">{t.bio}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {home.showGallery && site.gallery.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex items-end justify-between">
            <h2 className="font-serif text-3xl font-semibold">Life at our school</h2>
            <Link href="/gallery" className="text-sm font-medium text-brand-700 hover:underline">Full gallery →</Link>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {site.gallery.slice(0, 8).map((g) => <img key={g.id} src={g.url} alt={g.caption ?? "School photo"} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />)}
          </div>
        </section>
      )}

      <section className="bg-brand-800 py-14 text-center text-paper">
        <h2 className="font-serif text-3xl font-semibold">{admission.open ? "Admissions are open" : general.schoolName}</h2>
        <p className="mx-auto mt-2 max-w-xl text-paper/80">{admission.open ? admission.intro : admission.closedMessage}</p>
        {admission.open && <Link href="/admission" className="mt-6 inline-block rounded-full bg-brass-400 px-6 py-3 text-sm font-semibold text-ink hover:bg-brass-300">Apply now</Link>}
      </section>
    </main>
  );
}
