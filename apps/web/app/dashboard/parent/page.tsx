"use client";

import { PaymentReturnNotice } from "@/components/fees/payment-return-notice";
import * as React from "react";
import { Plus, Send } from "lucide-react";
import {
  PageHeader,
  DataTable,
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  FormModal,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
  useToast,
} from "@packages/ui";
import { createTicketSchema } from "@packages/shared-types";
import { MyFeesPanel } from "@/components/fees/my-fees-panel";
import { useNotices } from "@/lib/hooks/use-engagement";
import { useTickets, useCreateTicket, useAddTicketMessage } from "@/lib/hooks/use-engagement";
import { MyResults } from "@/components/exams/my-results";
import { ApiError } from "@/lib/api-client";
import { MyRoutine } from "@/components/routine/my-routine";
import { OverviewTiles, PerformanceView } from "@/components/performance/performance-view";
import { ChildPicker, useSelectedChild } from "@/components/performance/child-picker";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["overview", "performance", "routine", "fees", "results", "notices", "tickets"] as const;

export default function ParentDashboardPage() {
  const [tab, setTab] = useUrlTab("tab", "overview", TAB_VALUES);
  const child = useSelectedChild();
  return (
    <div>
      <PaymentReturnNotice />
      <PageHeader title="Parent dashboard" description="How your child is doing, fees, results, notices and support." />
      <ChildPicker items={child.items} value={child.studentId} onChange={child.setSelected} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="routine">Routine</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="tickets">Support tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTiles studentId={child.studentId} /></TabsContent>
        <TabsContent value="performance"><PerformanceView studentId={child.studentId} /></TabsContent>
        <TabsContent value="routine"><MyRoutine role="parent" /></TabsContent>
        <TabsContent value="fees"><MyFeesPanel /></TabsContent>
        <TabsContent value="results"><ResultsPanel /></TabsContent>
        <TabsContent value="notices"><NoticesPanel /></TabsContent>
        <TabsContent value="tickets"><TicketsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function ResultsPanel() {
  return <MyResults />;
}

function NoticesPanel() {
  const notices = useNotices();
  if (notices.isLoading) return null;
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
            <div
              className="prose prose-sm mt-2 max-w-none text-slate-600"
              dangerouslySetInnerHTML={{ __html: n.bodyHtml }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TicketsPanel() {
  const { toast } = useToast();
  const tickets = useTickets();
  const createTicket = useCreateTicket();
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createTicketSchema.safeParse({ subject, body });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      await createTicket.mutateAsync(parsed.data);
      toast({ title: "Ticket sent", variant: "success" });
      setOpen(false);
      setSubject("");
      setBody("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not send the ticket.";
      toast({ title: "Could not send", description: message, variant: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Support tickets"
        description="Send a question to the school office."
        actions={
          <FormModal
            open={open}
            onOpenChange={setOpen}
            title="New ticket"
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> New ticket
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ticket-subject">Subject</Label>
                <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ticket-body">Message</Label>
                <Textarea id="ticket-body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
              </div>
              <Button type="submit" disabled={createTicket.isPending} className="mt-2">
                {createTicket.isPending ? "Sending..." : "Send"}
              </Button>
            </form>
          </FormModal>
        }
      />
      <div className="flex flex-col gap-4">
        {(tickets.data?.items ?? []).map((t) => (
          <TicketThread key={t.id} ticketId={t.id} subject={t.subject} status={t.status} messages={t.messages} />
        ))}
        {tickets.data?.items.length === 0 && <EmptyState title="No tickets yet" />}
      </div>
    </div>
  );
}

function TicketThread({
  ticketId,
  subject,
  status,
  messages,
}: {
  ticketId: string;
  subject: string;
  status: string;
  messages: { id: string; senderName: string; body: string; createdAt: string }[];
}) {
  const { toast } = useToast();
  const addMessage = useAddTicketMessage(ticketId);
  const [reply, setReply] = React.useState("");

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    try {
      await addMessage.mutateAsync({ body: reply });
      setReply("");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not send the reply.";
      toast({ title: "Could not reply", description: message, variant: "error" });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle>{subject}</CardTitle>
        <Badge variant={status === "resolved" ? "success" : status === "in_progress" ? "warning" : "muted"}>
          {status.replace("_", " ")}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-md bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">{m.senderName}</p>
            <p className="mt-1 text-slate-600">{m.body}</p>
          </div>
        ))}
        <form onSubmit={handleReply} className="flex gap-2">
          <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply..." />
          <Button type="submit" size="sm" disabled={addMessage.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
