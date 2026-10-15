"use client";

import { PaymentReturnNotice } from "@/components/fees/payment-return-notice";
import { OverviewTiles, PerformanceView } from "@/components/performance/performance-view";
import { useSelectedChild } from "@/components/performance/child-picker";
import { MyFeesPanel } from "@/components/fees/my-fees-panel";
import * as React from "react";
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  Tabs,
  TabsContent,
  EmptyState,
  LoadingSkeleton,
  useToast,
} from "@packages/ui";
import { submitAssignmentSchema } from "@packages/shared-types";
import { useNotices } from "@/lib/hooks/use-engagement";
import { useResources } from "@/lib/hooks/use-resources";
import { useAssignments, useSubmissions, useSubmitAssignment } from "@/lib/hooks/use-assignments";
import { MyResults } from "@/components/exams/my-results";
import { ApiError } from "@/lib/api-client";
import { MyRoutine } from "@/components/routine/my-routine";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["overview", "performance", "routine", "notices", "resources", "assignments", "results", "fees"] as const;

export default function StudentDashboardPage() {
  const [tab, setTab] = useUrlTab("tab", "overview", TAB_VALUES);
  const me = useSelectedChild();
  return (
    <div>
      <PaymentReturnNotice />
      <PageHeader title="My learning" description="Notices, materials, assignments and results." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="overview"><OverviewTiles studentId={me.studentId} /></TabsContent>
        <TabsContent value="performance"><PerformanceView studentId={me.studentId} /></TabsContent>
        <TabsContent value="routine">
          <MyRoutine role="student" />
        </TabsContent>
        <TabsContent value="notices">
          <NoticesPanel />
        </TabsContent>
        <TabsContent value="resources">
          <ResourcesPanel />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsPanel />
        </TabsContent>
        <TabsContent value="results">
          <ResultsPanel />
        </TabsContent>
        <TabsContent value="fees">
          <MyFeesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoticesPanel() {
  const notices = useNotices();
  if (notices.isLoading) return <LoadingSkeleton rows={3} />;
  if (!notices.data?.items.length) return <EmptyState title="No notices yet" />;
  return (
    <div className="flex flex-col gap-3">
      {notices.data.items.map((n) => (
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
    </div>
  );
}

function ResourcesPanel() {
  const resources = useResources();
  if (resources.isLoading) return <LoadingSkeleton rows={3} />;
  if (!resources.data?.items.length) return <EmptyState title="No materials published yet" />;
  return (
    <div className="flex flex-col gap-3">
      {resources.data.items.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex items-center justify-between pt-5">
            <div>
              <p className="text-sm font-semibold text-slate-800">{r.title}</p>
              <p className="text-xs text-slate-400">{r.subjectName} · {r.kind.replace("_", " ")}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
<a href={r.url} target="_blank" rel="noreferrer">Open</a>
</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AssignmentsPanel() {
  const assignments = useAssignments();
  const [selected, setSelected] = React.useState<string | null>(null);

  if (assignments.isLoading) return <LoadingSkeleton rows={3} />;
  if (!assignments.data?.items.length) return <EmptyState title="No assignments yet" />;

  return (
    <div className="flex flex-col gap-3">
      {assignments.data.items.map((a) => (
        <Card key={a.id}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">{a.title}</p>
              <Badge variant="muted">Due {new Date(a.dueAt).toLocaleDateString()}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{a.subjectName}</p>
            <p className="mt-2 text-sm text-slate-600">{a.description}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSelected(selected === a.id ? null : a.id)}
            >
              {selected === a.id ? "Hide" : "Submit / view submission"}
            </Button>
            {selected === a.id && <SubmissionForm assignmentId={a.id} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SubmissionForm({ assignmentId }: { assignmentId: string }) {
  const { toast } = useToast();
  const submissions = useSubmissions(assignmentId);
  const submit = useSubmitAssignment(assignmentId);
  const [body, setBody] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");

  const mine = submissions.data?.items[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = submitAssignmentSchema.safeParse({
      body: body || undefined,
      fileUrl: fileUrl || undefined,
    });
    if (!parsed.success) {
      toast({ title: "Add an answer or a file link", variant: "error" });
      return;
    }
    try {
      await submit.mutateAsync(parsed.data);
      toast({ title: "Submitted", variant: "success" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not submit.";
      toast({ title: "Could not submit", description: message, variant: "error" });
    }
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 p-3">
      {mine && (
        <div className="mb-3 text-sm text-slate-600">
          <p>Last submitted {new Date(mine.submittedAt).toLocaleString()}.</p>
          {mine.gradePublishedAt ? (
            <p className="mt-1 font-medium text-emerald-700">Grade: {mine.grade}{mine.feedback ? ` — ${mine.feedback}` : ""}</p>
          ) : (
            <p className="mt-1 text-slate-400">Not graded yet.</p>
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sub-body-${assignmentId}`}>Written answer (optional)</Label>
          <Textarea id={`sub-body-${assignmentId}`} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sub-file-${assignmentId}`}>File link (optional)</Label>
          <Input id={`sub-file-${assignmentId}`} value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
        </div>
        <Button type="submit" size="sm" className="self-end" disabled={submit.isPending}>
          {submit.isPending ? "Submitting..." : "Submit"}
        </Button>
      </form>
    </div>
  );
}

function ResultsPanel() {
  return <MyResults />;
}

