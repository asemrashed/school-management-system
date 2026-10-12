const QUOTES = [
  {
    quote:
      "Attendance used to mean a paper register and a phone call for every absence. Now it's done in the app before the first period ends.",
    role: "Headteacher, Green Valley English Medium School",
  },
  {
    quote:
      "I post one assignment and every guardian who needs to know already does. That used to be a dozen messages on three different apps.",
    role: "Class teacher",
  },
  {
    quote:
      "I can see what my son owes in fees and what he scored in his last exam without calling the office. That alone is worth it.",
    role: "Parent",
  },
];

export function Testimonials() {
  return (
    <section className="border-t border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-serif text-3xl font-semibold text-ink">In their own words</h2>
        <p className="mt-3 max-w-lg text-ink/70">
          Illustrative feedback from the kind of day-to-day use this system
          is built for.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-px bg-ink/10 sm:grid-cols-3">
          {QUOTES.map((q) => (
            <figure key={q.role} className="flex flex-col justify-between bg-white p-6">
              <blockquote className="font-serif text-lg leading-snug text-ink">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 text-sm text-ink/50">{q.role}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
