"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Is our students' data secure?",
    a: "Every request goes through session-based authentication and role-based permissions, sessions are revocable instantly, and any user-submitted content is sanitized before it's stored. Only the people who should see a record can see it — a parent never sees another family's data, and the server re-checks every permission even if the interface already hid an option.",
  },
  {
    q: "Can we migrate from our existing spreadsheets or register books?",
    a: "Yes. Student, class and section records can be imported to get you started, so your first term on the system doesn't mean re-typing everything from paper.",
  },
  {
    q: "What if we don't have a budget for SMS?",
    a: "Email notifications work out of the box for every category — absences, fee reminders, results, notices. SMS is an optional add-on your admin can turn on later, per category, once you're ready.",
  },
  {
    q: "What happens if our internet connection is unreliable?",
    a: "An installable, offline-capable version — so a teacher can take attendance without signal and have it sync once they're back online — is on the roadmap (Phase 5). Today, the portal works over any normal mobile or broadband connection.",
  },
  {
    q: "How long does onboarding take?",
    a: "Most schools are running attendance and fees within the first week, with the rest of the modules turned on gradually as staff get comfortable — you don't have to switch everything on at once.",
  },
  {
    q: "Do parents need to install an app?",
    a: "No. It's a web portal that works in any phone or desktop browser — nothing to install, nothing to update.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold text-ink">Common questions</h2>

        <div className="mt-8 border-t border-ink/10">
          {FAQS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className="border-b border-ink/10">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-serif text-base text-ink">{item.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-ink/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && <p className="pb-5 text-sm leading-relaxed text-ink/70">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
