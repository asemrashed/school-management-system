import {
  Users, ClipboardCheck, Wallet, GraduationCap, FileCheck2, Bell, BookOpen, LayoutGrid,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "Student information",
    body: "Enroll students and manage classes, sections and shifts in one record system — no more duplicate spreadsheets per teacher.",
  },
  {
    icon: ClipboardCheck,
    title: "Attendance",
    body: "A teacher marks a whole section in seconds. Guardians of absent students are notified automatically, the same day.",
  },
  {
    icon: Wallet,
    title: "Fees & payments",
    body: "Fee structures, invoices and payments in one place, with bKash, Nagad and SSLCommerz on the way for online payment.",
  },
  {
    icon: FileCheck2,
    title: "Assignments & gradebooks",
    body: "Post assignments, collect submissions, grade them, and publish results only when they're ready for parents to see.",
  },
  {
    icon: GraduationCap,
    title: "Exams & results",
    body: "Enter marks once, publish once — every guardian gets their child's result the moment it's out.",
  },
  {
    icon: Bell,
    title: "Notices, events & support",
    body: "A notice board and calendar every parent actually sees, plus a support ticket system instead of a queue at the school gate.",
  },
  {
    icon: BookOpen,
    title: "Library",
    body: "Catalog, issue and return books with automatic overdue fines, and record book sales at the counter.",
  },
  {
    icon: LayoutGrid,
    title: "A dashboard for every role",
    body: "Admins, teachers, accountants, librarians, parents and students each open the portal to exactly what's theirs.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-lg">
          <h2 className="font-serif text-3xl font-semibold text-ink">
            Everything your school runs on, in one register
          </h2>
          <p className="mt-3 text-ink/70">
            Each module below is a working part of the same system — not a
            separate tool bolted on with a login of its own.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 border-l border-t border-ink/10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="border-b border-r border-ink/10 p-6">
              <f.icon className="h-5 w-5 text-brand-600" />
              <h3 className="mt-4 font-serif text-lg text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
