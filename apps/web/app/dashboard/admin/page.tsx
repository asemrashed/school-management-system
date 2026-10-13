"use client";

import { ExamManagement } from "@/components/exams/exam-management";
import { ResultSheet } from "@/components/exams/result-sheet";
import * as React from "react";
import { Plus } from "lucide-react";
import {
  PageHeader,
  DataTable,
  type DataTableColumn,
  Button,
  Badge,
  FormModal,
  Input,
  Label,
  Select,
  Switch,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  RichTextEditor,
  useToast,
} from "@packages/ui";
import {
  createUserSchema,
  createClassAssignmentSchema,
  createNoticeSchema,
  createEventSchema,
  createPageSchema,
  PAGE_STATUSES,
  type UserDto,
  type Role,
  type NoticeAudience,
  type PageStatus,
} from "@packages/shared-types";
import { useUsers, useCreateUser } from "@/lib/hooks/use-users";
import { useMessagingToggles, useUpdateMessagingToggle } from "@/lib/hooks/use-messaging";
import {
  useSubjects,
  useClassAssignments,
  useCreateClassAssignment,
  useDeleteClassAssignment,
} from "@/lib/hooks/use-academics";
import { useNotices, useCreateNotice, useEvents, useCreateEvent } from "@/lib/hooks/use-engagement";
import { usePages, useCreatePage, useUpdatePage } from "@/lib/hooks/use-cms";
import { useFeeCollectionReport, useAttendanceReport, useDefaulterReport } from "@/lib/hooks/use-reports";
import { useDeviceLimits, useSetDeviceLimit } from "@/lib/hooks/use-device";
import { ApiError } from "@/lib/api-client";
import { useSession } from "@/lib/hooks/use-auth";
import { SetupPanel } from "@/components/admin/setup-panel";
import { AssignmentsPanel } from "@/components/admin/assignments-panel";
import { RoutineAdminPanel } from "@/components/admin/routine-admin-panel";
import { RoleLimitsPanel } from "@/components/admin/role-limits-panel";
import { StudentsPanel } from "@/components/admin/students-panel";
import { WebsitePanel } from "@/components/admin/website-panel";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["users", "students", "setup", "assignments", "routine", "exams", "results", "limits", "notices", "events", "website", "cms", "reports"] as const;

const CREATABLE_ROLES: Role[] = ["admin", "coordinator", "teacher", "accountant", "librarian"];

const userColumns: DataTableColumn<UserDto>[] = [
  { key: "name", header: "Name", render: (u) => u.name },
  { key: "email", header: "Email", render: (u) => u.email },
  { key: "role", header: "Role", render: (u) => <Badge variant="muted">{u.role.replace("_", " ")}</Badge> },
  {
    key: "isActive",
    header: "Status",
    render: (u) => <Badge variant={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Disabled"}</Badge>,
  },
];

export default function AdminDashboardPage() {
  const session = useSession();
  const isSuperAdmin = session.data?.user?.role === "super_admin";
  // The API only lets Super Admin / Admin edit the website; coordinators never see the tab.
  const canEditWebsite = isSuperAdmin || session.data?.user?.role === "admin";
  // A URL asking for a tab this role cannot see falls back to the default tab.
  const allowedTabs = TAB_VALUES.filter((t) => (t !== "limits" || isSuperAdmin) && (t !== "website" || canEditWebsite));
  const [tab, setTab] = useUrlTab("tab", "users", allowedTabs);
  return (
    <div>
      <PageHeader title="Administration" description="Users, students and admissions, academic setup, website, notices and events." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">Users & Messaging</TabsTrigger>
          <TabsTrigger value="students">Students & Admissions</TabsTrigger>
          <TabsTrigger value="setup">Academic Setup</TabsTrigger>
          <TabsTrigger value="assignments">Teacher Assignments</TabsTrigger>
          <TabsTrigger value="routine">Routine</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="limits">Role Limits</TabsTrigger>}
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          {canEditWebsite && <TabsTrigger value="website">Website</TabsTrigger>}
          <TabsTrigger value="cms">CMS Pages</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UsersAndMessagingPanel />
        </TabsContent>
        <TabsContent value="students">
          <StudentsPanel />
        </TabsContent>
        <TabsContent value="setup">
          <SetupPanel />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsPanel />
        </TabsContent>
        <TabsContent value="exams">
          <ExamManagement />
        </TabsContent>
        <TabsContent value="results">
          <ResultSheet />
        </TabsContent>
        <TabsContent value="routine">
          <RoutineAdminPanel />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="limits">
            <RoleLimitsPanel />
          </TabsContent>
        )}
        <TabsContent value="notices">
          <NoticesPanel />
        </TabsContent>
        <TabsContent value="events">
          <EventsPanel />
        </TabsContent>
        {canEditWebsite && (
          <TabsContent value="website">
            <WebsitePanel />
          </TabsContent>
        )}
        <TabsContent value="cms">
          <CmsPanel />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Users & Messaging -------------------------------------------------

function UsersAndMessagingPanel() {
  const { toast } = useToast();
  const usersQuery = useUsers({ page: 1, limit: 20 });
  const createUser = useCreateUser();
  const togglesQuery = useMessagingToggles();
  const updateToggle = useUpdateMessagingToggle();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", email: "", role: "teacher" as Role, password: "" });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createUserSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createUser.mutateAsync(parsed.data);
      toast({ title: "User created", variant: "success" });
      setOpen(false);
      setForm({ name: "", email: "", role: "teacher", password: "" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create the user.";
      toast({ title: "Could not create user", description: message, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader
          title="Users"
          description="Create and manage staff accounts."
          actions={
            <FormModal
              open={open}
              onOpenChange={setOpen}
              title="Create user"
              description="An email is sent so they can set their password."
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New user
                </Button>
              }
            >
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-name">Full name</Label>
                  <Input id="new-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-role">Role</Label>
                  <Select id="new-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    {CREATABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-password">Temporary password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={createUser.isPending} className="mt-2">
                  {createUser.isPending ? "Creating..." : "Create user"}
                </Button>
              </form>
            </FormModal>
          }
        />
        <DataTable
          columns={userColumns}
          data={usersQuery.data?.items ?? []}
          keyField={(u) => u.id}
          isLoading={usersQuery.isLoading}
          isError={usersQuery.isError}
          onRetry={() => usersQuery.refetch()}
          emptyTitle="No users yet"
          emptyDescription="Create the first staff account with the button above."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messaging — SMS per category</CardTitle>
        </CardHeader>
        <CardContent>
          {!togglesQuery.data?.smsGatewayEnabled ? (
            <p className="text-sm text-slate-500">
              SMS_GATEWAY is off in the environment, so all SMS is disabled regardless of these toggles (see devops.md).
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {togglesQuery.data?.items.map((item) => (
                <div key={item.category} className="flex items-center justify-between py-3">
                  <span className="text-sm text-slate-700">{item.category.replace(/_/g, " ")}</span>
                  <Switch
                    checked={item.smsEnabled}
                    onChange={(e) => updateToggle.mutate({ category: item.category, smsEnabled: e.target.checked })}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DeviceLimitsCard />
    </div>
  );
}

function DeviceLimitsCard() {
  const limits = useDeviceLimits();
  const setLimit = useSetDeviceLimit();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device control — max concurrent sessions per role</CardTitle>
      </CardHeader>
      <CardContent>
        {!limits.data?.deviceControlEnabled ? (
          <p className="text-sm text-slate-500">
            DEVICE_CONTROL_ENABLED is off in the environment, so no session limit is enforced regardless of these
            values.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {limits.data?.items.map((item) => (
              <div key={item.role} className="flex items-center justify-between py-3">
                <span className="text-sm text-slate-700">{item.role.replace("_", " ")}</span>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  defaultValue={item.maxSessions ?? ""}
                  placeholder="No limit"
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value > 0) setLimit.mutate({ role: item.role, maxSessions: value });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Notices ---------------------------------------------------------------

const AUDIENCES: NoticeAudience[] = ["all", "parents", "teachers", "students", "staff"];

function NoticesPanel() {
  const { toast } = useToast();
  const notices = useNotices();
  const createNotice = useCreateNotice();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [audience, setAudience] = React.useState<NoticeAudience>("all");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createNoticeSchema.safeParse({ title, bodyHtml, audience, publishNow: true });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createNotice.mutateAsync(parsed.data);
      toast({ title: "Notice published", variant: "success" });
      setOpen(false);
      setTitle("");
      setBodyHtml("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not publish the notice.";
      toast({ title: "Could not publish", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Notice board"
        description="Publishing sends an email to everyone in the chosen audience."
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="New notice"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New notice
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notice-title">Title</Label>
                <Input id="notice-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notice-audience">Audience</Label>
                <Select
                  id="notice-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as NoticeAudience)}
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Body</Label>
                <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
              </div>
              <Button type="submit" disabled={createNotice.isPending} className="mt-2">
                {createNotice.isPending ? "Publishing..." : "Publish now"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <div className="flex flex-col gap-3">
        {(notices.data?.items ?? []).map((n) => (
          <Card key={n.id}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                <Badge variant="muted">{n.audience}</Badge>
              </div>
              <div className="prose prose-sm mt-2 max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: n.bodyHtml }} />
            </CardContent>
          </Card>
        ))}
        {notices.data?.items.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No notices published yet.</p>
        )}
      </div>
    </div>
  );
}

// --- Events ------------------------------------------------------------

function EventsPanel() {
  const { toast } = useToast();
  const events = useEvents();
  const createEvent = useCreateEvent();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [startAt, setStartAt] = React.useState("");
  const [location, setLocation] = React.useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createEventSchema.safeParse({
      title,
      startAt: startAt ? new Date(startAt).toISOString() : "",
      location: location || undefined,
    });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createEvent.mutateAsync(parsed.data);
      toast({ title: "Event added", variant: "success" });
      setOpen(false);
      setTitle("");
      setStartAt("");
      setLocation("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not add the event.";
      toast({ title: "Could not add event", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Event calendar"
        description="School-wide events shown to every dashboard."
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="New event"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New event
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-title">Title</Label>
                <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-start">Starts at</Label>
                <Input id="event-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="event-location">Location (optional)</Label>
                <Input id="event-location" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <Button type="submit" disabled={createEvent.isPending} className="mt-2">
                {createEvent.isPending ? "Adding..." : "Add event"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <DataTable
        columns={[
          { key: "title", header: "Title", render: (e) => e.title },
          { key: "startAt", header: "When", render: (e) => new Date(e.startAt).toLocaleString() },
          { key: "location", header: "Location", render: (e) => e.location ?? "—" },
        ]}
        data={events.data?.items ?? []}
        keyField={(e) => e.id}
        isLoading={events.isLoading}
        isError={events.isError}
        onRetry={() => events.refetch()}
        emptyTitle="No upcoming events"
      />
    </div>
  );
}

// --- CMS Pages -----------------------------------------------------------

function CmsPanel() {
  const { toast } = useToast();
  const pages = usePages();
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ slug: "", title: "", bodyHtml: "", status: "draft" as PageStatus });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createPageSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createPage.mutateAsync(parsed.data);
      toast({ title: "Page saved", variant: "success" });
      setOpen(false);
      setForm({ slug: "", title: "", bodyHtml: "", status: "draft" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not save the page.";
      toast({ title: "Could not save", description: message, variant: "error" });
    }
  }

  async function handleStatusChange(id: string, status: PageStatus) {
    try {
      await updatePage.mutateAsync({ id, status });
      toast({ title: `Page ${status}`, variant: "success" });
      setEditing(null);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not update the page.";
      toast({ title: "Could not update", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="CMS pages"
        description="Public pages at /<slug> (e.g. 'about', 'policies/refund') once published."
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="New page"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New page
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-slug">Slug</Label>
                <Input
                  id="page-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="about, policies/refund, contact..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-title">Title</Label>
                <Input id="page-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="page-status">Status</Label>
                <Select id="page-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PageStatus })}>
                  {PAGE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Body</Label>
                <RichTextEditor value={form.bodyHtml} onChange={(html) => setForm({ ...form, bodyHtml: html })} />
              </div>
              <Button type="submit" disabled={createPage.isPending} className="mt-2">
                {createPage.isPending ? "Saving..." : "Save page"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <DataTable
        columns={[
          { key: "slug", header: "Slug", render: (p) => `/${p.slug}` },
          { key: "title", header: "Title", render: (p) => p.title },
          {
            key: "status",
            header: "Status",
            render: (p) => (
              <Badge variant={p.status === "published" ? "success" : p.status === "review" ? "warning" : "muted"}>
                {p.status}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            render: (p) => (
              <div className="flex gap-2">
                {p.status !== "published" && (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange(p.id, "published")}>
                    Publish
                  </Button>
                )}
                {p.status === "published" && (
                  <Button variant="ghost" size="sm" onClick={() => handleStatusChange(p.id, "draft")}>
                    Unpublish
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        data={pages.data?.items ?? []}
        keyField={(p) => p.id}
        isLoading={pages.isLoading}
        isError={pages.isError}
        onRetry={() => pages.refetch()}
        emptyTitle="No pages yet"
      />
    </div>
  );
}

// --- Reports ---------------------------------------------------------------

function ReportsPanel() {
  const feeReport = useFeeCollectionReport();
  const attendanceReport = useAttendanceReport();
  const defaulters = useDefaulterReport();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <PageHeader title="Fee collection" description="Total due vs. collected." />
        {feeReport.data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Total due</p>
                <p className="mt-1 text-xl font-semibold">৳{(feeReport.data.totalDue / 100).toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Total collected</p>
                <p className="mt-1 text-xl font-semibold text-emerald-700">
                  ৳{(feeReport.data.totalCollected / 100).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Outstanding invoices</p>
                <p className="mt-1 text-xl font-semibold text-amber-700">{feeReport.data.outstandingCount}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div>
        <PageHeader title="Attendance %" description="Present vs. total attendance records, by section." />
        <DataTable
          columns={[
            { key: "section", header: "Section", render: (r) => r.sectionName },
            { key: "present", header: "Present", render: (r) => `${r.presentCount} / ${r.totalCount}` },
            { key: "pct", header: "Percentage", render: (r) => `${r.percentage}%` },
          ]}
          data={attendanceReport.data?.items ?? []}
          keyField={(r) => r.sectionId}
          isLoading={attendanceReport.isLoading}
          isError={attendanceReport.isError}
          onRetry={() => attendanceReport.refetch()}
          emptyTitle="No attendance recorded yet"
        />
      </div>

      <div>
        <PageHeader title="Defaulter list" description="Unpaid, partial or overdue invoices." />
        <DataTable
          columns={[
            { key: "student", header: "Student", render: (d) => d.studentName },
            { key: "guardian", header: "Guardian", render: (d) => d.guardianName ?? "—" },
            { key: "amount", header: "Outstanding", render: (d) => `৳${(d.amountOutstanding / 100).toFixed(2)}` },
            { key: "due", header: "Due date", render: (d) => d.dueDate },
            { key: "overdue", header: "Days overdue", render: (d) => String(d.daysOverdue) },
          ]}
          data={defaulters.data?.items ?? []}
          keyField={(d) => d.invoiceId}
          isLoading={defaulters.isLoading}
          isError={defaulters.isError}
          onRetry={() => defaulters.refetch()}
          emptyTitle="No defaulters — nice!"
        />
      </div>
    </div>
  );
}
