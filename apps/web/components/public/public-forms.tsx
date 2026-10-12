"use client";

import * as React from "react";
import { admissionFormSchema, contactFormSchema } from "@packages/shared-types";
import { errorMessage } from "@/lib/errors";
import { usePublicSite, useSubmitAdmission, useSubmitContact } from "@/lib/hooks/use-site";

const input = "w-full rounded-lg border border-ink/20 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Honeypot: invisible to people, tempting to bots. A filled value makes the API drop the submission. */
function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>Website <input tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} /></label>
    </div>
  );
}

function fieldErrors(issues: Array<{ path: Array<string | number>; message: string }>) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export function ContactForm() {
  const submit = useSubmitContact();
  const [v, setV] = React.useState({ name: "", email: "", phone: "", message: "", website: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const parsed = contactFormSchema.safeParse({ ...v, phone: v.phone || undefined });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    try { await submit.mutateAsync(parsed.data); setDone(true); }
    catch (err) { setServerError(errorMessage(err)); }
  }

  if (done) return <p role="status" className="rounded-xl bg-brand-50 p-5 text-brand-800">Thank you. We have received your message and will reply soon.</p>;
  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-4">
      <Honeypot value={v.website} onChange={(website) => setV({ ...v, website })} />
      <Field id="c-name" label="Your name" error={errors.name}><input id="c-name" className={input} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-email" label="Email" error={errors.email}><input id="c-email" type="email" className={input} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field id="c-phone" label="Phone (optional)" error={errors.phone}><input id="c-phone" className={input} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
      </div>
      <Field id="c-msg" label="Message" error={errors.message}><textarea id="c-msg" rows={5} className={input} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></Field>
      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
      <button type="submit" disabled={submit.isPending} className="self-start rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-paper hover:bg-brand-800 disabled:opacity-60">{submit.isPending ? "Sending…" : "Send message"}</button>
    </form>
  );
}

export function AdmissionForm() {
  const site = usePublicSite().data;
  const submit = useSubmitAdmission();
  const empty = { studentName: "", dateOfBirth: "", gender: "", appliedClassId: "", previousSchool: "", guardianName: "", guardianPhone: "", guardianEmail: "", address: "", message: "", website: "" };
  const [v, setV] = React.useState(empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  if (site && !site.admission.open) return <p role="status" className="rounded-xl bg-brass-50 p-5 text-brass-600">{site.admission.closedMessage}</p>;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const blank = (s: string) => (s === "" ? undefined : s);
    const parsed = admissionFormSchema.safeParse({
      ...v, dateOfBirth: blank(v.dateOfBirth), gender: blank(v.gender), previousSchool: blank(v.previousSchool), address: blank(v.address), message: blank(v.message),
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error.issues));
    setErrors({});
    try { await submit.mutateAsync(parsed.data); setDone(true); }
    catch (err) { setServerError(errorMessage(err)); }
  }

  if (done) return <p role="status" className="rounded-xl bg-brand-50 p-5 text-brand-800">Thank you. Your application was received and a confirmation was emailed to you. Our office will contact you soon.</p>;
  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-4">
      <Honeypot value={v.website} onChange={(website) => setV({ ...v, website })} />
      <h2 className="font-serif text-xl font-semibold">Student</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="a-sname" label="Student's full name" error={errors.studentName}><input id="a-sname" className={input} value={v.studentName} onChange={set("studentName")} /></Field>
        <Field id="a-class" label="Class applying for" error={errors.appliedClassId}>
          <select id="a-class" className={input} value={v.appliedClassId} onChange={set("appliedClassId")}>
            <option value="">Select a class…</option>
            {site?.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field id="a-dob" label="Date of birth" error={errors.dateOfBirth}><input id="a-dob" type="date" className={input} value={v.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
        <Field id="a-gender" label="Gender" error={errors.gender}>
          <select id="a-gender" className={input} value={v.gender} onChange={set("gender")}><option value="">—</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>
        </Field>
      </div>
      <Field id="a-prev" label="Previous school (if any)" error={errors.previousSchool}><input id="a-prev" className={input} value={v.previousSchool} onChange={set("previousSchool")} /></Field>
      <h2 className="mt-2 font-serif text-xl font-semibold">Parent / guardian</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="a-gname" label="Name" error={errors.guardianName}><input id="a-gname" className={input} value={v.guardianName} onChange={set("guardianName")} /></Field>
        <Field id="a-gphone" label="Phone" error={errors.guardianPhone}><input id="a-gphone" className={input} value={v.guardianPhone} onChange={set("guardianPhone")} /></Field>
        <Field id="a-gemail" label="Email" error={errors.guardianEmail}><input id="a-gemail" type="email" className={input} value={v.guardianEmail} onChange={set("guardianEmail")} /></Field>
      </div>
      <Field id="a-addr" label="Address" error={errors.address}><input id="a-addr" className={input} value={v.address} onChange={set("address")} /></Field>
      <Field id="a-msg" label="Anything else we should know?" error={errors.message}><textarea id="a-msg" rows={3} className={input} value={v.message} onChange={set("message")} /></Field>
      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
      <button type="submit" disabled={submit.isPending} className="self-start rounded-full bg-brand-700 px-6 py-2.5 text-sm font-semibold text-paper hover:bg-brand-800 disabled:opacity-60">{submit.isPending ? "Submitting…" : "Submit application"}</button>
    </form>
  );
}
