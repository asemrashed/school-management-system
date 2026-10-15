import Link from "next/link";
import { Button } from "@packages/ui";

export function Hero() {
  return (
    <section
      id="top"
      className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20"
    >
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h1 className="max-w-xl font-serif text-[2.5rem] font-semibold leading-[1.1] text-ink sm:text-5xl">
            Run your school on one system, not six spreadsheets.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink/70">
            Attendance, fees, gradebooks, exams and parent communication — one
            platform built for English-medium schools in Bangladesh, with a
            dashboard made for every admin, teacher, parent and student.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              className="bg-brass-400 text-ink hover:bg-brass-500"
              asChild
            >
              <a href="#contact">Book a demo</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-ink/50">
            Built with Green Valley English Medium School, Dhaka.
          </p>
        </div>

        <MarksheetMock />
      </div>
    </section>
  );
}

/** A stylized mock of the product's own attendance/marks grid — grounds the
 * hero in the real subject matter instead of a decorative gradient. */
function MarksheetMock() {
  const rows = [
    { name: "Ayesha Rahman", roll: "01", status: "Present", mark: "88" },
    { name: "Tanvir Ahmed", roll: "02", status: "Present", mark: "76" },
    { name: "Nusrat Jahan", roll: "03", status: "Absent", mark: "—" },
    { name: "Farhan Kabir", roll: "04", status: "Present", mark: "91" },
    { name: "Sadia Islam", roll: "05", status: "Present", mark: "84" },
  ];

  return (
    <div className="rotate-1 border border-ink/15 bg-white shadow-[6px_6px_0_0_rgba(28,32,31,0.08)]">
      <div className="flex items-center justify-between border-b border-ink/10 bg-brand-700 px-4 py-3">
        <span className="font-serif text-sm text-white">
          Class 6 — Section A
        </span>
        <span className="text-xs text-white/70">Mid-term · Mathematics</span>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink/10 text-xs uppercase tracking-normal text-ink/50">
            <th className="px-4 py-2 font-medium">Roll</th>
            <th className="px-4 py-2 font-medium">Student</th>
            <th className="px-4 py-2 font-medium">Attendance</th>
            <th className="px-4 py-2 font-medium">Marks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.roll} className="border-b border-ink/5 last:border-0">
              <td className="px-4 py-2.5 text-ink/60">{r.roll}</td>
              <td className="px-4 py-2.5 text-ink">{r.name}</td>
              <td className="px-4 py-2.5">
                <span
                  className={
                    r.status === "Absent" ? "text-red-600" : "text-brand-600"
                  }
                >
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-ink/80">{r.mark}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
