"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Badge, Button, Card, CardContent, CardHeader, CardTitle, DataTable, FormModal, Input, Label, Switch,
  Tabs, TabsContent, TabsList, TabsTrigger, useToast,
} from "@packages/ui";
import {
  generalSettingsSchema, homeSettingsSchema, admissionSettingsSchema,
  type GeneralSettings, type HomeSettings, type AdmissionSettings, type WebsiteTeacher,
} from "@packages/shared-types";
import { apiUpload } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import {
  useAddGalleryImage, useAdminGallery, useContactMessages, useDeleteGalleryImage, useMarkContactRead,
  useSaveSiteSetting, useSiteSettings, useUpdateWebsiteTeacher, useWebsiteTeachers,
} from "@/lib/hooks/use-site";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["general", "home", "admission", "teachers", "gallery", "messages"] as const;

/** Super Admin / Admin: everything the public website shows, no code or IDs needed. */
export function WebsitePanel() {
  const [tab, setTab] = useUrlTab("sub", "general", TAB_VALUES);
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="general">School info & menu</TabsTrigger>
        <TabsTrigger value="home">Home page</TabsTrigger>
        <TabsTrigger value="admission">Admission page</TabsTrigger>
        <TabsTrigger value="teachers">Teachers</TabsTrigger>
        <TabsTrigger value="gallery">Gallery</TabsTrigger>
        <TabsTrigger value="messages">Messages</TabsTrigger>
      </TabsList>
      <TabsContent value="general"><GeneralForm /></TabsContent>
      <TabsContent value="home"><HomeForm /></TabsContent>
      <TabsContent value="admission"><AdmissionForm /></TabsContent>
      <TabsContent value="teachers"><TeachersList /></TabsContent>
      <TabsContent value="gallery"><GalleryManager /></TabsContent>
      <TabsContent value="messages"><MessagesInbox /></TabsContent>
    </Tabs>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Image upload button that hands the resulting URL back. Validates type/size before sending. */
function ImageUpload({ onUploaded, label = "Upload image" }: { onUploaded: (url: string) => void; label?: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
        const { url } = await apiUpload(file);
        onUploaded(url);
      }
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : errorMessage(err), variant: "error" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : label}</Button>
    </>
  );
}

/** Shared load/draft/save plumbing for one settings key. */
function useSettingsForm<T extends object>(pick: (all: NonNullable<ReturnType<typeof useSiteSettings>["data"]>) => T, key: "general" | "home" | "admission", schema: { safeParse: (v: unknown) => any }) {
  const { toast } = useToast();
  const settings = useSiteSettings();
  const save = useSaveSiteSetting();
  const [draft, setDraft] = React.useState<T | null>(null);
  React.useEffect(() => { if (settings.data) setDraft(pick(settings.data)); }, [settings.data]); // eslint-disable-line react-hooks/exhaustive-deps
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(draft);
    if (!parsed.success) return toast({ title: "Check the form", description: parsed.error.issues[0]?.path.join(".") + ": " + parsed.error.issues[0]?.message, variant: "error" });
    try {
      await save.mutateAsync({ key, value: parsed.data });
      toast({ title: "Saved. The public site is updated.", variant: "success" });
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err), variant: "error" });
    }
  }
  return { draft, setDraft, submit, loading: settings.isLoading, error: settings.isError, saving: save.isPending };
}

function GeneralForm() {
  const f = useSettingsForm<GeneralSettings>((a) => a.general, "general", generalSettingsSchema);
  const d = f.draft;
  if (f.loading || !d) return <p className="p-4 text-sm text-slate-500">{f.error ? "Could not load settings." : "Loading…"}</p>;
  const set = <K extends keyof GeneralSettings>(k: K, v: GeneralSettings[K]) => f.setDraft({ ...d, [k]: v });
  return (
    <Card><CardContent className="pt-5">
      <form onSubmit={f.submit} className="grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field id="g-name" label="School name"><Input id="g-name" value={d.schoolName} onChange={(e) => set("schoolName", e.target.value)} /></Field>
        <Field id="g-tag" label="Tagline"><Input id="g-tag" value={d.tagline} onChange={(e) => set("tagline", e.target.value)} /></Field>
        <Field id="g-phone" label="Phone"><Input id="g-phone" value={d.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field id="g-email" label="Email"><Input id="g-email" value={d.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field id="g-addr" label="Address"><Input id="g-addr" value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field id="g-hours" label="Office hours"><Input id="g-hours" value={d.officeHours} onChange={(e) => set("officeHours", e.target.value)} /></Field>
        <Field id="g-map" label="Google Maps embed URL" hint="Maps → Share → Embed a map → copy the src=… link."><Input id="g-map" value={d.mapEmbedUrl} onChange={(e) => set("mapEmbedUrl", e.target.value)} /></Field>
        <Field id="g-fb" label="Facebook page URL"><Input id="g-fb" value={d.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} /></Field>
        <Field id="g-yt" label="YouTube URL"><Input id="g-yt" value={d.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} /></Field>
        <Field id="g-logo" label="Logo">
          <div className="flex items-center gap-3">
            {d.logoUrl && <img src={d.logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain" />}
            <ImageUpload label={d.logoUrl ? "Replace logo" : "Upload logo"} onUploaded={(url) => set("logoUrl", url)} />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-slate-700">Menu</p>
          <div className="flex flex-col gap-2">
            {d.nav.map((n, i) => (
              <div key={n.key} className="flex items-center gap-3">
                <span className="w-24 text-sm capitalize text-slate-500">{n.key}</span>
                <Input aria-label={`${n.key} menu label`} className="max-w-xs" value={n.label} onChange={(e) => set("nav", d.nav.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <label className="flex items-center gap-2 text-sm"><Switch checked={n.visible} onChange={(e) => set("nav", d.nav.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)))} /> Show</label>
              </div>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2"><Button type="submit" disabled={f.saving}>{f.saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </CardContent></Card>
  );
}

function HomeForm() {
  const f = useSettingsForm<HomeSettings>((a) => a.home, "home", homeSettingsSchema);
  const d = f.draft;
  if (f.loading || !d) return <p className="p-4 text-sm text-slate-500">{f.error ? "Could not load settings." : "Loading…"}</p>;
  const set = <K extends keyof HomeSettings>(k: K, v: HomeSettings[K]) => f.setDraft({ ...d, [k]: v });
  return (
    <Card><CardContent className="pt-5">
      <form onSubmit={f.submit} className="flex max-w-3xl flex-col gap-4">
        <Field id="h-title" label="Headline"><Input id="h-title" value={d.heroTitle} onChange={(e) => set("heroTitle", e.target.value)} /></Field>
        <Field id="h-sub" label="Sub-headline"><Input id="h-sub" value={d.heroSubtitle} onChange={(e) => set("heroSubtitle", e.target.value)} /></Field>
        <Field id="h-btn" label="Main button text"><Input id="h-btn" value={d.heroPrimaryLabel} onChange={(e) => set("heroPrimaryLabel", e.target.value)} /></Field>
        <Field id="h-img" label="Hero image">
          <div className="flex items-center gap-3">
            {d.heroImageUrl && <img src={d.heroImageUrl} alt="Hero" className="h-16 w-28 rounded object-cover" />}
            <ImageUpload label={d.heroImageUrl ? "Replace image" : "Upload image"} onUploaded={(url) => set("heroImageUrl", url)} />
            {d.heroImageUrl && <Button type="button" size="sm" variant="outline" onClick={() => set("heroImageUrl", "")}>Remove</Button>}
          </div>
        </Field>
        <Field id="h-hl-t" label="“Why choose us” section title"><Input id="h-hl-t" value={d.highlightsTitle} onChange={(e) => set("highlightsTitle", e.target.value)} /></Field>
        <Field id="h-about-t" label="About section title"><Input id="h-about-t" value={d.aboutTitle} onChange={(e) => set("aboutTitle", e.target.value)} /></Field>
        <Field id="h-about" label="About section text"><textarea id="h-about" rows={4} className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={d.aboutText} onChange={(e) => set("aboutText", e.target.value)} /></Field>
        <Field id="h-about-img" label="About section image">
          <div className="flex items-center gap-3">
            {d.aboutImageUrl && <img src={d.aboutImageUrl} alt="About" className="h-16 w-28 rounded object-cover" />}
            <ImageUpload label={d.aboutImageUrl ? "Replace image" : "Upload image"} onUploaded={(url) => set("aboutImageUrl", url)} />
            {d.aboutImageUrl && <Button type="button" size="sm" variant="outline" onClick={() => set("aboutImageUrl", "")}>Remove</Button>}
          </div>
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">“Why families choose us” cards</p>
          <div className="flex flex-col gap-3">
            {d.highlights.map((ft, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Input aria-label={`Card ${i + 1} title`} value={ft.title} onChange={(e) => set("highlights", d.highlights.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Input aria-label={`Card ${i + 1} text`} value={ft.text} onChange={(e) => set("highlights", d.highlights.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
                </div>
                <Button type="button" size="sm" variant="outline" aria-label={`Remove card ${i + 1}`} onClick={() => set("highlights", d.highlights.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {d.highlights.length < 8 && <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => set("highlights", [...d.highlights, { title: "New card", text: "" }])}><Plus className="h-4 w-4" /> Add card</Button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><Switch checked={d.showNotices} onChange={(e) => set("showNotices", e.target.checked)} /> Show notices</label>
          <label className="flex items-center gap-2"><Switch checked={d.showTeachers} onChange={(e) => set("showTeachers", e.target.checked)} /> Show teachers</label>
          <label className="flex items-center gap-2"><Switch checked={d.showGallery} onChange={(e) => set("showGallery", e.target.checked)} /> Show gallery</label>
        </div>
        <div><Button type="submit" disabled={f.saving}>{f.saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </CardContent></Card>
  );
}

function AdmissionForm() {
  const f = useSettingsForm<AdmissionSettings>((a) => a.admission, "admission", admissionSettingsSchema);
  const d = f.draft;
  if (f.loading || !d) return <p className="p-4 text-sm text-slate-500">{f.error ? "Could not load settings." : "Loading…"}</p>;
  return (
    <Card><CardContent className="pt-5">
      <form onSubmit={f.submit} className="flex max-w-2xl flex-col gap-4">
        <label className="flex items-center gap-2 text-sm"><Switch checked={d.open} onChange={(e) => f.setDraft({ ...d, open: e.target.checked })} /> Admissions are open (the application form is shown)</label>
        <Field id="a-intro" label="Introduction above the form"><textarea id="a-intro" rows={3} className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={d.intro} onChange={(e) => f.setDraft({ ...d, intro: e.target.value })} /></Field>
        <Field id="a-closed" label="Message when admissions are closed"><Input id="a-closed" value={d.closedMessage} onChange={(e) => f.setDraft({ ...d, closedMessage: e.target.value })} /></Field>
        <p className="text-xs text-slate-500">The page’s long text (fees, dates, documents needed) is edited in “CMS Pages” → slug <code>admission</code>.</p>
        <div><Button type="submit" disabled={f.saving}>{f.saving ? "Saving…" : "Save"}</Button></div>
      </form>
    </CardContent></Card>
  );
}

function TeachersList() {
  const { toast } = useToast();
  const teachers = useWebsiteTeachers();
  const update = useUpdateWebsiteTeacher();
  const [editing, setEditing] = React.useState<WebsiteTeacher | null>(null);
  const [draft, setDraft] = React.useState({ designation: "", bio: "", photoUrl: "", websiteOrder: "0" });

  function edit(t: WebsiteTeacher) {
    setEditing(t);
    setDraft({ designation: t.designation ?? "", bio: t.bio ?? "", photoUrl: t.photoUrl ?? "", websiteOrder: String(t.websiteOrder) });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, designation: draft.designation, bio: draft.bio, photoUrl: draft.photoUrl, websiteOrder: Number(draft.websiteOrder) || 0 });
      toast({ title: "Teacher profile saved", variant: "success" });
      setEditing(null);
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err), variant: "error" });
    }
  }
  async function toggle(t: WebsiteTeacher, show: boolean) {
    try { await update.mutateAsync({ id: t.id, showOnWebsite: show }); }
    catch (err) { toast({ title: "Could not update", description: errorMessage(err), variant: "error" }); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Teachers on the website</CardTitle><p className="text-sm text-slate-500">Switch a teacher on to list them on the Home page. Only name, title, bio and photo are public.</p></CardHeader>
      <CardContent>
        <DataTable
          columns={[
            { key: "photo", header: "", render: (t) => (t.photoUrl ? <img src={t.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="inline-block h-9 w-9 rounded-full bg-slate-200" />) },
            { key: "name", header: "Name", render: (t) => t.name },
            { key: "role", header: "Title", render: (t) => t.designation ?? "—" },
            { key: "show", header: "Show", render: (t) => <Switch aria-label={`Show ${t.name} on website`} checked={t.showOnWebsite} onChange={(e) => toggle(t, e.target.checked)} /> },
            { key: "edit", header: "", render: (t) => <Button size="sm" variant="outline" onClick={() => edit(t)}>Edit profile</Button> },
          ]}
          data={teachers.data?.items ?? []}
          keyField={(t) => t.id}
          isLoading={teachers.isLoading}
          isError={teachers.isError}
          onRetry={() => teachers.refetch()}
          emptyTitle="No teachers yet"
        />
      </CardContent>
      <FormModal open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)} title={editing ? `Edit ${editing.name}` : "Edit"}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <Field id="t-des" label="Title shown on website"><Input id="t-des" value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })} placeholder="e.g. Senior Mathematics Teacher" /></Field>
          <Field id="t-bio" label="Short bio"><textarea id="t-bio" rows={3} maxLength={500} className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} /></Field>
          <Field id="t-order" label="Order (small numbers first)"><Input id="t-order" type="number" min={0} value={draft.websiteOrder} onChange={(e) => setDraft({ ...draft, websiteOrder: e.target.value })} /></Field>
          <Field id="t-photo" label="Photo">
            <div className="flex items-center gap-3">
              {draft.photoUrl && <img src={draft.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />}
              <ImageUpload label={draft.photoUrl ? "Replace photo" : "Upload photo"} onUploaded={(url) => setDraft((d) => ({ ...d, photoUrl: url }))} />
            </div>
          </Field>
          <Button type="submit" disabled={update.isPending}>Save</Button>
        </form>
      </FormModal>
    </Card>
  );
}

function GalleryManager() {
  const { toast } = useToast();
  const gallery = useAdminGallery();
  const add = useAddGalleryImage();
  const remove = useDeleteGalleryImage();

  async function uploaded(url: string) {
    try { await add.mutateAsync({ url }); }
    catch (err) { toast({ title: "Could not add image", description: errorMessage(err), variant: "error" }); }
  }
  async function del(id: string) {
    if (!window.confirm("Remove this photo from the gallery?")) return;
    try { await remove.mutateAsync(id); }
    catch (err) { toast({ title: "Could not remove", description: errorMessage(err), variant: "error" }); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Gallery</CardTitle>
        <ImageUpload label="Upload photos" onUploaded={uploaded} />
      </CardHeader>
      <CardContent>
        {gallery.isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {gallery.data?.items.length === 0 && <p className="text-sm text-slate-500">No photos yet. Upload some to fill the gallery page.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {gallery.data?.items.map((g) => (
            <figure key={g.id} className="relative overflow-hidden rounded-lg border border-slate-200">
              <img src={g.url} alt={g.caption ?? "Gallery photo"} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <Button size="sm" variant="outline" className="absolute right-2 top-2 bg-white" aria-label="Remove photo" onClick={() => del(g.id)}><Trash2 className="h-4 w-4" /></Button>
            </figure>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MessagesInbox() {
  const messages = useContactMessages();
  const mark = useMarkContactRead();
  return (
    <Card>
      <CardHeader><CardTitle>Messages from the Contact page</CardTitle></CardHeader>
      <CardContent>
        <DataTable
          columns={[
            { key: "from", header: "From", render: (m) => <div><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">{m.email}{m.phone ? ` · ${m.phone}` : ""}</div></div> },
            // Rendered as text by React, so any markup a visitor typed is shown literally, never executed.
            { key: "msg", header: "Message", render: (m) => <p className="max-w-md whitespace-pre-wrap text-sm">{m.message}</p> },
            { key: "date", header: "Received", render: (m) => new Date(m.createdAt).toLocaleString() },
            { key: "state", header: "", render: (m) => (m.isRead ? <Badge variant="muted">Read</Badge> : <Button size="sm" variant="outline" disabled={mark.isPending} onClick={() => mark.mutate(m.id)}>Mark read</Button>) },
          ]}
          data={messages.data?.items ?? []}
          keyField={(m) => m.id}
          isLoading={messages.isLoading}
          isError={messages.isError}
          onRetry={() => messages.refetch()}
          emptyTitle="No messages yet"
        />
      </CardContent>
    </Card>
  );
}
