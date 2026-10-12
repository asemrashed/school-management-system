export function AboutSection() {
  return (
    <section id="about" className="border-t border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <h2 className="font-serif text-3xl font-semibold text-ink">About us</h2>
          <div className="flex flex-col gap-4 text-ink/75">
            <p>
              This portal was built for one English-medium school in
              Bangladesh first — Green Valley English Medium School — with a
              simple test: would a teacher actually use it instead of the
              paper register, and would a parent actually check it instead of
              calling the office?
            </p>
            <p>
              That meant building attendance, fees, gradebooks and notices as
              one connected system rather than separate tools with separate
              logins, and giving every role — admin, teacher, accountant,
              librarian, parent, student — a dashboard scoped to exactly what
              they need.
            </p>
            <p>
              The school's own office, teachers and parents shaped what got
              built and in what order, which is why the roadmap keeps
              growing: attendance and fees first, then a full LMS, then a
              library and public school website, with offline support and
              scale next.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
