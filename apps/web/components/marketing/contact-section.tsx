import { Mail, Phone } from "lucide-react";
import { Button } from "@packages/ui";

export function ContactSection() {
  return (
    <section id="contact" className="border-t border-ink/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-ink">
              Book a demo
            </h2>
            <p className="mt-3 text-ink/70">
              Tell us a bit about your school and we'll walk you through the
              portal with your own class structure in mind.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <a
              href="mailto:info@greenvalleyschool.edu.bd?subject=School%20Portal%20demo%20request"
              className="flex items-center gap-3 border border-ink/10 p-4 text-sm text-ink/80 hover:border-ink/25"
            >
              <Mail className="h-4 w-4 text-brand-600" />
              info@greenvalleyschool.edu.bd
            </a>
            <div className="flex items-center gap-3 border border-ink/10 p-4 text-sm text-ink/60">
              <Phone className="h-4 w-4 text-brand-600" />
              Prefer a call? Include a good number to reach you in your email.
            </div>
            <Button
              size="lg"
              className="bg-brass-400 text-ink hover:bg-brass-500"
              asChild
            >
              <a href="mailto:info@greenvalleyschool.edu.bd?subject=School%20Portal%20demo%20request">
                Email us to book a demo
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
