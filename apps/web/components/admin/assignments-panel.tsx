"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Badge, Button, Checkbox, ConfirmDialog, DataTable, FormModal, Label, PageHeader, useToast,
  type DataTableColumn,
} from "@packages/ui";
import {
  WEEKDAY_LABELS, type ClassAssignmentDto, type RoutineSlotInput, type Weekday, type PeriodDto,
} from "@packages/shared-types";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { errorMessage } from "@/lib/errors";
import { periods as periodsApi, classes as classesApi } from "@/lib/hooks/use-setup";
import {
  useClassAssignments, useCreateClassAssignment, useDeleteClassAssignment, useUpdateClassAssignment,
} from "@/lib/hooks/use-academics";

const SCHOOL_DAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu"];
const slotKey = (d: Weekday, periodId: string) => `${d}:${periodId}`;

/** Day x period checkbox grid for one shift. Breaks are shown but disabled. */
function SchedulePicker({
  periods, selected, onChange,
}: { periods: PeriodDto[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  if (periods.length === 0) {
    return <p className="text-sm text-slate-500">This shift has no periods yet. Add them under Academic Setup → Bell Schedule.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-xs text-slate-500">
            <th className="px-2 py-1.5 text-left">Period</th>
            {SCHOOL_DAYS.map((d) => <th key={d} className="px-2 py-1.5">{WEEKDAY_LABELS[d].slice(0, 3)}</th>)}
          </tr>
        </thead>
        <tbody>
          {[...periods].sort((a, b) => a.sortOrder - b.sortOrder).map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-2 py-1.5">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">{p.startTime}–{p.endTime}</div>
              </td>
              {SCHOOL_DAYS.map((d) => (
                <td key={d} className="px-2 py-1.5 text-center">
                  {p.isBreak ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : (
                    <Checkbox
                      aria-label={`${WEEKDAY_LABELS[d]} ${p.name}`}
                      checked={selected.has(slotKey(d, p.id))}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(slotKey(d, p.id)); else next.delete(slotKey(d, p.id));
                        onChange(next);
                      }}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const toSlots = (selected: Set<string>): RoutineSlotInput[] =>
  Array.from(selected).map((k) => {
    const [dayOfWeek, periodId] = k.split(":");
    return { dayOfWeek: dayOfWeek as Weekday, periodId };
  });

/**
 * Create (no `editing`) or edit one assignment: who teaches what to which
 * section, in which room, when — plus whether they are the "first teacher"
 * who takes the section's daily attendance. Saving builds the routine.
 */
function AssignmentForm({ editing, onDone }: { editing?: ClassAssignmentDto; onDone: () => void }) {
  const { toast } = useToast();
  const create = useCreateClassAssignment();
  const update = useUpdateClassAssignment();
  const classList = classesApi.useList();

  const [classId, setClassId] = React.useState(editing?.classId ?? "");
  const [sectionId, setSectionId] = React.useState(editing?.sectionId ?? "");
  const [subjectId, setSubjectId] = React.useState(editing?.subjectId ?? "");
  const [teacherId, setTeacherId] = React.useState(editing?.teacherId ?? "");
  const [roomId, setRoomId] = React.useState(editing?.roomId ?? "");
  const [takesAttendance, setTakesAttendance] = React.useState(editing?.takesAttendance ?? false);
  const [selected, setSelected] = React.useState<Set<string>>(
    new Set((editing?.slots ?? []).map((s) => slotKey(s.dayOfWeek, s.periodId)))
  );

  const shiftId = editing?.shiftId ?? classList.data?.items.find((c) => c.id === classId)?.shiftId;
  const periodList = periodsApi.useList({ shiftId });
  const pending = create.isPending || update.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, teacherId, roomId: roomId || null, takesAttendance, slots: toSlots(selected) });
      } else {
        await create.mutateAsync({ sectionId, subjectId, teacherId, roomId: roomId || null, takesAttendance, slots: toSlots(selected) });
      }
      toast({ title: editing ? "Assignment updated" : "Assignment created — routine updated", variant: "success" });
      onDone();
    } catch (err) {
      // Schedule clashes come back as a readable 409 message naming the conflict.
      toast({ title: "Could not save assignment", description: errorMessage(err), variant: "error" });
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {editing ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {editing.className} — {editing.sectionName} · <strong>{editing.subjectName}</strong>
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>Class</Label>
            <LookupCombobox kind="classes" value={classId} onChange={(v) => { setClassId(v); setSectionId(""); setSubjectId(""); setSelected(new Set()); }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Section</Label>
              <LookupCombobox kind="sections" value={sectionId} onChange={setSectionId} filters={{ classId }} disabled={!classId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Subject</Label>
              <LookupCombobox kind="subjects" value={subjectId} onChange={setSubjectId} filters={{ classId }} disabled={!classId} />
            </div>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Teacher</Label>
          <LookupCombobox kind="teachers" value={teacherId} onChange={setTeacherId} initialLabel={editing?.teacherName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Classroom (optional)</Label>
          <LookupCombobox kind="rooms" value={roomId} onChange={setRoomId} clearable initialLabel={editing?.roomName ?? undefined} placeholder="Section's default room" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <Checkbox checked={takesAttendance} onChange={(e) => setTakesAttendance(e.target.checked)} className="mt-0.5" />
        <span>
          <strong>First teacher</strong> — takes the daily attendance for this section.
          <span className="block text-xs text-slate-500">Only one teacher per section; ticking this moves the role from whoever had it.</span>
        </span>
      </label>
      <div className="flex flex-col gap-1.5">
        <Label>Weekly class times</Label>
        {shiftId ? (
          <SchedulePicker periods={periodList.data?.items ?? []} selected={selected} onChange={setSelected} />
        ) : (
          <p className="text-sm text-slate-500">Choose a class to pick its class times.</p>
        )}
      </div>
      <Button type="submit" disabled={pending || !teacherId || (!editing && (!sectionId || !subjectId))}>
        {pending ? "Saving…" : editing ? "Save changes" : "Create assignment"}
      </Button>
    </form>
  );
}

export function AssignmentsPanel() {
  const { toast } = useToast();
  const assignments = useClassAssignments();
  const remove = useDeleteClassAssignment();
  const periodList = periodsApi.useList();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ClassAssignmentDto | null>(null);
  const [removing, setRemoving] = React.useState<ClassAssignmentDto | null>(null);

  const periodName = new Map((periodList.data?.items ?? []).map((p) => [p.id, p.name]));
  const describeSlots = (a: ClassAssignmentDto) =>
    a.slots.length === 0
      ? "Not scheduled"
      : a.slots
          .map((s) => `${WEEKDAY_LABELS[s.dayOfWeek].slice(0, 3)} ${periodName.get(s.periodId) ?? ""}`.trim())
          .join(", ");

  const columns: DataTableColumn<ClassAssignmentDto>[] = [
    { key: "class", header: "Class / Section", render: (a) => `${a.className} — ${a.sectionName}` },
    { key: "subject", header: "Subject", render: (a) => a.subjectName },
    { key: "teacher", header: "Teacher", render: (a) => (
        <span className="flex items-center gap-2">{a.teacherName}{a.takesAttendance && <Badge variant="success">Takes attendance</Badge>}</span>
    ) },
    { key: "room", header: "Room", render: (a) => a.roomName ?? "—" },
    { key: "when", header: "Class times", render: (a) => <span className="text-xs text-slate-600">{describeSlots(a)}</span> },
    { key: "actions", header: "", render: (a) => (
        <span className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(a)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => setRemoving(a)}>Remove</Button>
        </span>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Teacher assignments"
        description="Assign a teacher to a class, section and subject with weekly class times. The class routine builds itself from this."
        actions={
          <FormModal open={createOpen} onOpenChange={setCreateOpen} title="New assignment" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New assignment</Button>}>
            <AssignmentForm onDone={() => setCreateOpen(false)} />
          </FormModal>
        }
      />
      <DataTable
        columns={columns}
        data={assignments.data?.items ?? []}
        keyField={(a) => a.id}
        isLoading={assignments.isLoading}
        isError={assignments.isError}
        onRetry={() => assignments.refetch()}
        emptyTitle="No assignments yet"
        emptyDescription="Set up classes, sections, subjects and the bell schedule first, then assign teachers."
      />
      {editing && (
        <FormModal key={editing.id} open onOpenChange={(o) => !o && setEditing(null)} title="Edit assignment">
          <AssignmentForm editing={editing} onDone={() => setEditing(null)} />
        </FormModal>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this assignment?"
        description="The teacher is unassigned and its class times disappear from the routine."
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={async () => {
          try { await remove.mutateAsync(removing!.id); toast({ title: "Assignment removed", variant: "success" }); setRemoving(null); }
          catch (err) { toast({ title: "Could not remove", description: errorMessage(err), variant: "error" }); }
        }}
      />
    </div>
  );
}
