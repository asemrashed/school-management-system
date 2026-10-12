"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Input, Label, Button } from "@packages/ui";

const PLANS = [
  {
    name: "Starter",
    fit: "Up to 300 students",
    features: ["Attendance & fees", "Notices & events", "Parent & student portals", "Email notifications"],
  },
  {
    name: "Growth",
    fit: "Up to 1,000 students",
    features: ["Everything in Starter", "LMS: assignments & exams", "Library management", "SMS notifications (optional)"],
    featured: true,
  },
  {
    name: "Enterprise",
    fit: "Multiple campuses or shifts",
    features: ["Everything in Growth", "Salary & payroll", "Custom reports", "Dedicated onboarding support"],
  },
];

export function Pricing() {
  const [students, setStudents] = React.useState(400);
  // Illustrative estimate only — minutes saved per student per week across
  // attendance, fee follow-up and result distribution, based on replacing
  // manual paper/phone processes with the automated flows already in this
  // system (attendance, invoicing, publish-and-notify).
  const minutesSavedPerWeek = Math.round((students * 3.5) / 60) * 60;
  const hoursPerMonth = Math.round((minutesSavedPerWeek * 4) / 60);

  return (
    <section id="pricing" className="border-t border-ink/10 bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-lg">
          <h2 className="font-serif text-3xl font-semibold text-ink">Priced around your school, not a seat count</h2>
          <p className="mt-3 text-ink/70">
            Every school's shifts, sections and staffing look different — talk
            to us and we'll quote for yours. Here's roughly where most
            schools land.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="border border-ink/10 bg-white p-6">
            <h3 className="font-serif text-lg text-ink">Estimate your time saved</h3>
            <p className="mt-1 text-sm text-ink/60">
              A rough, illustrative estimate — not a guarantee — based on
              replacing manual attendance, fee follow-up and result
              distribution with the automated flows in this system.
            </p>
            <div className="mt-5 flex flex-col gap-1.5">
              <Label htmlFor="roi-students">Number of students</Label>
              <Input
                id="roi-students"
                type="number"
                min={50}
                max={5000}
                value={students}
                onChange={(e) => setStudents(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className="mt-6 border-t border-ink/10 pt-5">
              <p className="text-sm text-ink/60">Estimated staff time saved</p>
              <p className="mt-1 font-serif text-3xl text-brand-700">~{hoursPerMonth} hours / month</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`flex flex-col border p-5 ${
                  plan.featured ? "border-brass-400 bg-white" : "border-ink/10 bg-white"
                }`}
              >
                <h3 className="font-serif text-lg text-ink">{plan.name}</h3>
                <p className="mt-1 text-xs text-ink/50">{plan.fit}</p>
                <ul className="mt-4 flex flex-1 flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink/75">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#contact" className="mt-5">
                  <Button variant={plan.featured ? "default" : "outline"} size="sm" className="w-full">
                    Contact us for pricing
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
