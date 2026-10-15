"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Badge, Button, Card, CardContent, EmptyState, ErrorState, FormModal, Input, Label, LoadingSkeleton, PageHeader,
  RichTextEditor, Select, Textarea, useToast,
} from "@packages/ui";
import {
  NOTICE_AUTHOR_ROLES, NOTICE_AUDIENCES, createNoticeSchema, type NoticeAudience, type NoticeDto, type NoticeStatus,
} from "@packages/shared-types";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/lib/hooks/use-auth";
import {
  useCreateNotice, useMyNotices, useNotices, usePendingNotices, useResubmitNotice, useReviewNotice,
} from "@/lib/hooks/use-engagement";

const STATUS: Record<NoticeStatus, { label: string; variant: "muted" | "warning" | "success" | "danger" }> = {
  draft: { label: "Draft", variant: "muted" },
  pending: { label: "Waiting for admin approval", variant: "warning" },
  published: { label: "Published", variant: "success" },
  rejected: { label: "Sent back", variant: "danger" },
};

/**
 * One notice page for every staff role.
 *  - Everyone: the live notice board (what their role may read).
 *  - Coordinator / teacher / librarian: write a notice -> it waits for an admin; follow its status, fix and resubmit if sent back.
 *  - Admin / super admin: publish directly, and approve or send back others' notices.
 *  - Accountant: read-only.
 */
export function NoticesPanel() {
  const session = useSession();
  const role = session.data?.user?.role ?? "";
  const canAuthor = (NOTICE_AUTHOR_ROLES as readonly string[]).includes(role);
  const isAdmin = role === "admin" || role === "super_admin";

  const board = useNotices();
  const mine = useMyNotices(canAuthor && !isAdmin);
  const pending = usePendingNotices(isAdmin);
  const [editing, setEditing] = React.useState<NoticeDto | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Notices"
        description={
          isAdmin
            ? "Publishing emails everyone in the chosen audience. Notices from staff wait here for your approval."
            : canAuthor
              ? "Write a notice for the school. An admin reviews it before it goes live."
              : "Notices published for you."
        }
        actions={
          canAuthor && (
            <NoticeForm
              open={open}
              onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
              editing={editing}
              isAdmin={isAdmin}
              trigger={<Button size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New notice</Button>}
            />
          )
        }
      />

      {isAdmin && (
        <section aria-labelledby="pending-h" className="flex flex-col gap-3">
          <h2 id="pending-h" className="text-sm font-semibold text-slate-700">
            Waiting for approval {pending.data ? `(${pending.data.items.length})` : ""}
          </h2>
          {pending.isLoading ? <LoadingSkeleton rows={2} /> : pending.isError ? (
            <ErrorState onRetry={() => pending.refetch()} />
          ) : pending.data!.items.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing waiting. 🎉</p>
          ) : (
            pending.data!.items.map((n) => <PendingCard key={n.id} notice={n} />)
          )}
        </section>
      )}

      {canAuthor && !isAdmin && (
        <section aria-labelledby="mine-h" className="flex flex-col gap-3">
          <h2 id="mine-h" className="text-sm font-semibold text-slate-700">My notices</h2>
          {mine.isLoading ? <LoadingSkeleton rows={2} /> : mine.isError ? (
            <ErrorState onRetry={() => mine.refetch()} />
          ) : mine.data!.items.length === 0 ? (
            <p className="text-sm text-slate-400">You have not written a notice yet.</p>
          ) : (
            mine.data!.items.map((n) => (
              <NoticeCard key={n.id} notice={n} showStatus>
                {(n.status === "rejected" || n.status === "pending") && (
                  <Button size="sm" variant="outline" onClick={() => { setEditing(n); setOpen(true); }}>
                    {n.status === "rejected" ? "Edit & resubmit" : "Edit"}
                  </Button>
                )}
              </NoticeCard>
            ))
          )}
        </section>
      )}

      <section aria-labelledby="board-h" className="flex flex-col gap-3">
        <h2 id="board-h" className="text-sm font-semibold text-slate-700">Notice board</h2>
        {board.isLoading ? <LoadingSkeleton rows={3} /> : board.isError ? (
          <ErrorState onRetry={() => board.refetch()} />
        ) : board.data!.items.length === 0 ? (
          <EmptyState title="No notices yet" />
        ) : (
          board.data!.items.map((n) => <NoticeCard key={n.id} notice={n} />)
        )}
      </section>
    </div>
  );
}

function NoticeCard({ notice, showStatus, children }: { notice: NoticeDto; showStatus?: boolean; children?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">{notice.title}</p>
          <div className="flex flex-wrap items-center gap-2">
            {showStatus && <Badge variant={STATUS[notice.status].variant}>{STATUS[notice.status].label}</Badge>}
            <Badge variant="muted">{notice.audience}</Badge>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">By {notice.createdByName}</p>
        {notice.status === "rejected" && notice.rejectionNote && (
          <p className="mt-2 rounded-md bg-red-50 p-2 text-sm text-red-700">
            {notice.reviewedByName ? `${notice.reviewedByName}: ` : ""}{notice.rejectionNote}
          </p>
        )}
        {/* bodyHtml is sanitised on the server before it is stored. */}
        <div className="prose prose-sm mt-2 max-w-none text-slate-600" dangerouslySetInnerHTML={{ __html: notice.bodyHtml }} />
        {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
      </CardContent>
    </Card>
  );
}

function PendingCard({ notice }: { notice: NoticeDto }) {
  const { toast } = useToast();
  const review = useReviewNotice();
  const [rejecting, setRejecting] = React.useState(false);
  const [note, setNote] = React.useState("");

  async function run(action: "approve" | "reject") {
    try {
      await review.mutateAsync(action === "approve" ? { id: notice.id, action } : { id: notice.id, action, note });
      toast({ title: action === "approve" ? "Approved and published" : "Sent back to the author", variant: "success" });
      setRejecting(false); setNote("");
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <NoticeCard notice={notice}>
      <Button size="sm" onClick={() => run("approve")} disabled={review.isPending}>Approve &amp; publish</Button>
      <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={review.isPending}>Send back</Button>
      <FormModal open={rejecting} onOpenChange={setRejecting} title="Send back to the author" description="They can edit and resubmit.">
        <div className="flex flex-col gap-3">
          <Label htmlFor={`rej-${notice.id}`}>What should change?</Label>
          <Textarea id={`rej-${notice.id}`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => run("reject")} disabled={review.isPending || note.trim().length < 3}>Send back</Button>
        </div>
      </FormModal>
    </NoticeCard>
  );
}

function NoticeForm({
  open, onOpenChange, editing, isAdmin, trigger,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: NoticeDto | null; isAdmin: boolean; trigger: React.ReactNode;
}) {
  const { toast } = useToast();
  const create = useCreateNotice();
  const resubmit = useResubmitNotice();
  const [title, setTitle] = React.useState("");
  const [bodyHtml, setBodyHtml] = React.useState("");
  const [audience, setAudience] = React.useState<NoticeAudience>("all");
  const busy = create.isPending || resubmit.isPending;

  // Load the notice being edited (or reset) every time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setBodyHtml(editing?.bodyHtml ?? "");
    setAudience(editing?.audience ?? "all");
  }, [open, editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createNoticeSchema.safeParse({ title, bodyHtml, audience, publishNow: true });
    if (!parsed.success) {
      toast({ title: "Check the form", description: parsed.error.issues[0]?.message, variant: "error" });
      return;
    }
    try {
      if (editing) {
        await resubmit.mutateAsync({ id: editing.id, title, bodyHtml, audience });
        toast({ title: "Resubmitted for approval", variant: "success" });
      } else {
        const r = await create.mutateAsync(parsed.data);
        toast({
          title: r.notice.status === "published" ? "Notice published" : "Submitted for approval",
          description: r.notice.status === "published" ? undefined : "An admin will review it before it goes live.",
          variant: "success",
        });
      }
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Could not save the notice", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <FormModal open={open} onOpenChange={onOpenChange} title={editing ? "Edit notice" : "New notice"} trigger={trigger}>
      <form onSubmit={submit} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notice-title">Title</Label>
          <Input id="notice-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notice-audience">Audience</Label>
          <Select id="notice-audience" value={audience} onChange={(e) => setAudience(e.target.value as NoticeAudience)}>
            {NOTICE_AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Body</Label>
          <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : isAdmin ? "Publish now" : editing ? "Resubmit for approval" : "Submit for approval"}
        </Button>
      </form>
    </FormModal>
  );
}
