"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@packages/ui";
import { Check } from "lucide-react";

const ROLES = [
  {
    id: "admin",
    label: "Administrators",
    summary: "Run the whole school from one seat, without chasing six spreadsheets.",
    points: [
      "Create staff accounts and manage exactly what each role can see and do",
      "Publish notices, manage the school's public pages, and run the calendar",
      "Fee collection, attendance % and defaulter reports whenever you need them",
      "Turn SMS on for the notices that need it, and leave it off for the rest",
    ],
  },
  {
    id: "teacher",
    label: "Teachers",
    summary: "Less time on paperwork, more of it actually teaching.",
    points: [
      "Take a whole section's attendance in under a minute",
      "Post materials, assignments and live-class links by subject and section",
      "Grade submissions and publish results only when you're ready",
      "Enter exam marks once — publishing notifies every guardian for you",
    ],
  },
  {
    id: "parent",
    label: "Parents",
    summary: "Know what's happening with your child without a phone call to the office.",
    points: [
      "See fee status for every child and what's still due",
      "Get notified the moment your child is marked absent",
      "See results the moment a teacher publishes them",
      "Raise a support ticket and get a reply in the same thread",
    ],
  },
  {
    id: "student",
    label: "Students",
    summary: "One place for today's work instead of a dozen group messages.",
    points: [
      "See today's materials and recorded classes by subject",
      "Submit assignments with a file or a written answer",
      "Check published results as soon as they're out",
      "See school notices without asking a classmate what was announced",
    ],
  },
] as const;

export function RolesSection() {
  const [active, setActive] = React.useState<string>("admin");

  React.useEffect(() => {
    const fromHash = window.location.hash.replace("#roles-", "");
    if (ROLES.some((r) => r.id === fromHash)) setActive(fromHash);

    function onHashChange() {
      const id = window.location.hash.replace("#roles-", "");
      if (ROLES.some((r) => r.id === id)) setActive(id);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <section id="roles" className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-lg">
          <h2 className="font-serif text-3xl font-semibold text-ink">Built differently for each person who opens it</h2>
          <p className="mt-3 text-ink/70">
            The same system, four different jobs to do — nobody wades through
            a screen meant for someone else's role.
          </p>
        </div>

        <Tabs value={active} onValueChange={setActive} className="mt-10">
          <TabsList>
            {ROLES.map((r) => (
              <TabsTrigger key={r.id} value={r.id} id={`roles-${r.id}`}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ROLES.map((r) => (
            <TabsContent key={r.id} value={r.id}>
              <div className="grid grid-cols-1 gap-8 border border-ink/10 bg-white p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <h3 className="font-serif text-xl text-ink">{r.label}</h3>
                  <p className="mt-2 text-sm text-ink/65">{r.summary}</p>
                </div>
                <ul className="flex flex-col gap-3">
                  {r.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-ink/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
