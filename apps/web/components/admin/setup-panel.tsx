"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  Button, ConfirmDialog, DataTable, FormModal, Input, Label, Switch, Tabs, TabsContent, TabsList, TabsTrigger,
  Select, Badge, useToast, type DataTableColumn,
} from "@packages/ui";
import type { ClassDto, SectionDto, RoomDto, PeriodDto, SubjectDto, AcademicYearDto } from "@packages/shared-types";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { errorMessage } from "@/lib/errors";
import * as setup from "@/lib/hooks/use-setup";
import { useSubjects, useCreateSubject } from "@/lib/hooks/use-academics";

/** Runs a mutation and reports success/failure with a toast. Returns true on success. */
function useRunner() {
  const { toast } = useToast();
  return React.useCallback(
    async (fn: () => Promise<unknown>, ok: string, failTitle: string) => {
      try {
        await fn();
        toast({ title: ok, variant: "success" });
        return true;
      } catch (err) {
        toast({ title: failTitle, description: errorMessage(err), variant: "error" });
        return false;
      }
    },
    [toast]
  );
}

const Field = ({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

function DeleteButton({ onConfirm, what, pending }: { onConfirm: () => Promise<boolean>; what: string; pending?: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Delete</Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${what}?`}
        description="This cannot be undone. You'll be told if something still depends on it."
        confirmLabel="Delete"
        loading={pending}
        onConfirm={async () => { if (await onConfirm()) setOpen(false); }}
      />
    </>
  );
}

export function SetupPanel() {
  return (
    <Tabs defaultValue="classes">
      <TabsList className="flex-wrap">
        <TabsTrigger value="classes">Classes & Sections</TabsTrigger>
        <TabsTrigger value="subjects">Subjects</TabsTrigger>
        <TabsTrigger value="rooms">Rooms & Buildings</TabsTrigger>
        <TabsTrigger value="periods">Bell Schedule</TabsTrigger>
        <TabsTrigger value="shifts">Shifts</TabsTrigger>
        <TabsTrigger value="years">Academic Years</TabsTrigger>
      </TabsList>
      <TabsContent value="classes"><ClassesAndSections /></TabsContent>
      <TabsContent value="subjects"><SubjectsSection /></TabsContent>
      <TabsContent value="rooms"><RoomsAndBuildings /></TabsContent>
      <TabsContent value="periods"><PeriodsSection /></TabsContent>
      <TabsContent value="shifts"><ShiftsSection /></TabsContent>
      <TabsContent value="years"><YearsSection /></TabsContent>
    </Tabs>
  );
}

// --- Shifts ------------------------------------------------------------------

function ShiftsSection() {
  const run = useRunner();
  const list = setup.shifts.useList();
  const create = setup.shifts.useCreate();
  const remove = setup.shifts.useDelete();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  return (
    <Section
      title="Shifts"
      hint="e.g. Morning, Day. Every class runs in one shift, and each shift has its own bell schedule."
      action={
        <FormModal open={open} onOpenChange={setOpen} title="New shift" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New shift</Button>}>
          <form className="flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => create.mutateAsync({ name }), "Shift created", "Could not create shift")) { setOpen(false); setName(""); }
          }}>
            <Field label="Name" htmlFor="shift-name"><Input id="shift-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning" /></Field>
            <Button type="submit" disabled={create.isPending}>Create shift</Button>
          </form>
        </FormModal>
      }
    >
      <DataTable
        columns={[
          { key: "name", header: "Name", render: (s) => s.name },
          { key: "a", header: "", render: (s) => <DeleteButton what="shift" pending={remove.isPending} onConfirm={() => run(() => remove.mutateAsync(s.id), "Shift deleted", "Could not delete shift")} /> },
        ]}
        data={list.data?.items ?? []}
        keyField={(s) => s.id}
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => list.refetch()}
        emptyTitle="No shifts yet"
        emptyDescription="Create a shift (e.g. Morning) before adding classes."
      />
    </Section>
  );
}

// --- Classes & sections ----------------------------------------------------------

function ClassesAndSections() {
  const run = useRunner();
  const classList = setup.classes.useList();
  const sectionList = setup.sections.useList();
  const createClass = setup.classes.useCreate();
  const createSection = setup.sections.useCreate();
  const removeClass = setup.classes.useDelete();
  const removeSection = setup.sections.useDelete();

  const [classOpen, setClassOpen] = React.useState(false);
  const [className, setClassName] = React.useState("");
  const [shiftId, setShiftId] = React.useState("");

  const [secOpen, setSecOpen] = React.useState(false);
  const [secName, setSecName] = React.useState("");
  const [secClassId, setSecClassId] = React.useState("");
  const [roomId, setRoomId] = React.useState("");

  const classCols: DataTableColumn<ClassDto>[] = [
    { key: "name", header: "Class", render: (c) => c.name },
    { key: "shift", header: "Shift", render: (c) => c.shiftName },
    { key: "n", header: "Sections", render: (c) => c.sectionCount },
    { key: "a", header: "", render: (c) => <DeleteButton what="class" pending={removeClass.isPending} onConfirm={() => run(() => removeClass.mutateAsync(c.id), "Class deleted", "Could not delete class")} /> },
  ];
  const secCols: DataTableColumn<SectionDto>[] = [
    { key: "name", header: "Section", render: (s) => `${s.className} — ${s.name}` },
    { key: "room", header: "Default room", render: (s) => s.roomName ?? "—" },
    { key: "n", header: "Students", render: (s) => s.studentCount },
    { key: "a", header: "", render: (s) => <DeleteButton what="section" pending={removeSection.isPending} onConfirm={() => run(() => removeSection.mutateAsync(s.id), "Section deleted", "Could not delete section")} /> },
  ];

  return (
    <div className="flex flex-col gap-10">
      <Section
        title="Classes"
        action={
          <FormModal open={classOpen} onOpenChange={setClassOpen} title="New class" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New class</Button>}>
            <form className="flex flex-col gap-4" onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => createClass.mutateAsync({ name: className, shiftId }), "Class created", "Could not create class")) { setClassOpen(false); setClassName(""); }
            }}>
              <Field label="Class name" htmlFor="class-name"><Input id="class-name" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="Class 6" /></Field>
              <Field label="Shift"><LookupCombobox kind="shifts" value={shiftId} onChange={setShiftId} /></Field>
              <Button type="submit" disabled={createClass.isPending}>Create class</Button>
            </form>
          </FormModal>
        }
      >
        <DataTable columns={classCols} data={classList.data?.items ?? []} keyField={(c) => c.id} isLoading={classList.isLoading} isError={classList.isError} onRetry={() => classList.refetch()} emptyTitle="No classes yet" emptyDescription="Add a shift first, then your classes." />
      </Section>

      <Section
        title="Sections"
        action={
          <FormModal open={secOpen} onOpenChange={setSecOpen} title="New section" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New section</Button>}>
            <form className="flex flex-col gap-4" onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => createSection.mutateAsync({ name: secName, classId: secClassId, roomId: roomId || null }), "Section created", "Could not create section")) { setSecOpen(false); setSecName(""); setRoomId(""); }
            }}>
              <Field label="Class"><LookupCombobox kind="classes" value={secClassId} onChange={setSecClassId} /></Field>
              <Field label="Section name" htmlFor="sec-name"><Input id="sec-name" value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="A" /></Field>
              <Field label="Default room (optional)"><LookupCombobox kind="rooms" value={roomId} onChange={setRoomId} clearable /></Field>
              <Button type="submit" disabled={createSection.isPending}>Create section</Button>
            </form>
          </FormModal>
        }
      >
        <DataTable columns={secCols} data={sectionList.data?.items ?? []} keyField={(s) => s.id} isLoading={sectionList.isLoading} isError={sectionList.isError} onRetry={() => sectionList.refetch()} emptyTitle="No sections yet" emptyDescription="Add a class first." />
      </Section>
    </div>
  );
}

// --- Subjects ----------------------------------------------------------------

function SubjectsSection() {
  const run = useRunner();
  const list = useSubjects();
  const classList = setup.classes.useList();
  const create = useCreateSubject();
  const remove = setup.useDeleteSubject();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [classId, setClassId] = React.useState("");
  const classNames = new Map((classList.data?.items ?? []).map((c) => [c.id, c.name]));
  const cols: DataTableColumn<SubjectDto>[] = [
    { key: "name", header: "Subject", render: (s) => s.name },
    { key: "class", header: "Class", render: (s) => classNames.get(s.classId) ?? "—" },
    { key: "a", header: "", render: (s) => <DeleteButton what="subject" pending={remove.isPending} onConfirm={() => run(() => remove.mutateAsync(s.id), "Subject deleted", "Could not delete subject")} /> },
  ];
  return (
    <Section
      title="Subjects"
      hint="Subjects belong to a class (e.g. Mathematics for Class 6)."
      action={
        <FormModal open={open} onOpenChange={setOpen} title="New subject" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New subject</Button>}>
          <form className="flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => create.mutateAsync({ name, classId }), "Subject created", "Could not create subject")) { setOpen(false); setName(""); }
          }}>
            <Field label="Class"><LookupCombobox kind="classes" value={classId} onChange={setClassId} /></Field>
            <Field label="Subject name" htmlFor="subj-name"><Input id="subj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mathematics" /></Field>
            <Button type="submit" disabled={create.isPending || !classId}>Create subject</Button>
          </form>
        </FormModal>
      }
    >
      <DataTable columns={cols} data={list.data?.items ?? []} keyField={(s) => s.id} isLoading={list.isLoading} isError={list.isError} onRetry={() => list.refetch()} emptyTitle="No subjects yet" />
    </Section>
  );
}

// --- Rooms & buildings (buildings optional) ---------------------------------------

function RoomsAndBuildings() {
  const run = useRunner();
  const roomList = setup.rooms.useList();
  const buildingList = setup.buildings.useList();
  const createRoom = setup.rooms.useCreate();
  const createBuilding = setup.buildings.useCreate();
  const removeRoom = setup.rooms.useDelete();
  const removeBuilding = setup.buildings.useDelete();

  const [roomOpen, setRoomOpen] = React.useState(false);
  const [roomName, setRoomName] = React.useState("");
  const [capacity, setCapacity] = React.useState("");
  const [buildingId, setBuildingId] = React.useState("");
  const [bOpen, setBOpen] = React.useState(false);
  const [bName, setBName] = React.useState("");

  const roomCols: DataTableColumn<RoomDto>[] = [
    { key: "name", header: "Room", render: (r) => r.name },
    { key: "b", header: "Building", render: (r) => r.buildingName ?? "—" },
    { key: "c", header: "Capacity", render: (r) => r.capacity ?? "—" },
    { key: "a", header: "", render: (r) => <DeleteButton what="room" pending={removeRoom.isPending} onConfirm={() => run(() => removeRoom.mutateAsync(r.id), "Room deleted", "Could not delete room")} /> },
  ];

  return (
    <div className="flex flex-col gap-10">
      <Section
        title="Rooms"
        hint="Rooms are optional. Add buildings only if your school has more than one."
        action={
          <FormModal open={roomOpen} onOpenChange={setRoomOpen} title="New room" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New room</Button>}>
            <form className="flex flex-col gap-4" onSubmit={async (e) => {
              e.preventDefault();
              const cap = capacity.trim() ? Number(capacity) : null;
              if (await run(() => createRoom.mutateAsync({ name: roomName, capacity: cap, buildingId: buildingId || null }), "Room created", "Could not create room")) {
                setRoomOpen(false); setRoomName(""); setCapacity(""); setBuildingId("");
              }
            }}>
              <Field label="Room name / number" htmlFor="room-name"><Input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="101" /></Field>
              <Field label="Capacity (optional)" htmlFor="room-cap"><Input id="room-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
              <Field label="Building (optional)"><LookupCombobox kind="buildings" value={buildingId} onChange={setBuildingId} clearable /></Field>
              <Button type="submit" disabled={createRoom.isPending}>Create room</Button>
            </form>
          </FormModal>
        }
      >
        <DataTable columns={roomCols} data={roomList.data?.items ?? []} keyField={(r) => r.id} isLoading={roomList.isLoading} isError={roomList.isError} onRetry={() => roomList.refetch()} emptyTitle="No rooms yet" />
      </Section>

      <Section
        title="Buildings (optional)"
        action={
          <FormModal open={bOpen} onOpenChange={setBOpen} title="New building" trigger={<Button size="sm" variant="outline"><Plus className="h-4 w-4" /> New building</Button>}>
            <form className="flex flex-col gap-4" onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => createBuilding.mutateAsync({ name: bName }), "Building created", "Could not create building")) { setBOpen(false); setBName(""); }
            }}>
              <Field label="Building name" htmlFor="b-name"><Input id="b-name" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Science Block" /></Field>
              <Button type="submit" disabled={createBuilding.isPending}>Create building</Button>
            </form>
          </FormModal>
        }
      >
        <DataTable
          columns={[
            { key: "n", header: "Building", render: (b) => b.name },
            { key: "r", header: "Rooms", render: (b) => b.roomCount },
            { key: "a", header: "", render: (b) => <DeleteButton what="building" pending={removeBuilding.isPending} onConfirm={() => run(() => removeBuilding.mutateAsync(b.id), "Building deleted", "Could not delete building")} /> },
          ]}
          data={buildingList.data?.items ?? []}
          keyField={(b) => b.id}
          isLoading={buildingList.isLoading}
          isError={buildingList.isError}
          onRetry={() => buildingList.refetch()}
          emptyTitle="No buildings"
          emptyDescription="That's fine — buildings are optional."
        />
      </Section>
    </div>
  );
}

// --- Bell schedule (periods) ---------------------------------------------------------

function PeriodsSection() {
  const run = useRunner();
  const [shiftId, setShiftId] = React.useState("");
  const list = setup.periods.useList({ shiftId: shiftId || undefined });
  const create = setup.periods.useCreate();
  const remove = setup.periods.useDelete();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", startTime: "08:00", endTime: "08:45", isBreak: false });

  const cols: DataTableColumn<PeriodDto>[] = [
    { key: "o", header: "#", render: (p) => p.sortOrder },
    { key: "n", header: "Period", render: (p) => p.name },
    { key: "t", header: "Time", render: (p) => `${p.startTime}–${p.endTime}` },
    { key: "b", header: "", render: (p) => (p.isBreak ? <Badge variant="muted">Break</Badge> : null) },
    { key: "a", header: "", render: (p) => <DeleteButton what="period" pending={remove.isPending} onConfirm={() => run(() => remove.mutateAsync(p.id), "Period deleted", "Could not delete period")} /> },
  ];

  return (
    <Section
      title="Bell schedule"
      hint="The periods of a school day. Class routines are built on these, per shift."
      action={
        <div className="flex items-center gap-2">
          <div className="w-48"><LookupCombobox kind="shifts" value={shiftId} onChange={setShiftId} clearable placeholder="All shifts" /></div>
          <FormModal open={open} onOpenChange={setOpen} title="New period" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New period</Button>}>
            <form className="flex flex-col gap-4" onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => create.mutateAsync({ ...form, shiftId }), "Period created", "Could not create period")) setOpen(false);
            }}>
              {!shiftId && <p className="text-sm text-amber-700">Choose a shift in the filter above first.</p>}
              <Field label="Name" htmlFor="p-name"><Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Period 1" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts" htmlFor="p-start"><Input id="p-start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
                <Field label="Ends" htmlFor="p-end"><Input id="p-end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-3 text-sm text-slate-700"><Switch checked={form.isBreak} onChange={(e) => setForm({ ...form, isBreak: e.target.checked })} /> This is a break (no classes)</label>
              <Button type="submit" disabled={create.isPending || !shiftId}>Create period</Button>
            </form>
          </FormModal>
        </div>
      }
    >
      <DataTable columns={cols} data={list.data?.items ?? []} keyField={(p) => p.id} isLoading={list.isLoading} isError={list.isError} onRetry={() => list.refetch()} emptyTitle="No periods yet" emptyDescription="Pick a shift and add its periods (and breaks)." />
    </Section>
  );
}

// --- Academic years ----------------------------------------------------------------------

function YearsSection() {
  const run = useRunner();
  const list = setup.useAcademicYears();
  const create = setup.useCreateAcademicYear();
  const makeCurrent = setup.useSetCurrentAcademicYear();
  const remove = setup.useDeleteAcademicYear();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", startDate: "", endDate: "", isCurrent: true });
  const cols: DataTableColumn<AcademicYearDto>[] = [
    { key: "n", header: "Year", render: (y) => y.name },
    { key: "d", header: "Dates", render: (y) => `${y.startDate} → ${y.endDate}` },
    { key: "c", header: "", render: (y) => (y.isCurrent ? <Badge variant="success">Current</Badge> : <Button variant="ghost" size="sm" onClick={() => run(() => makeCurrent.mutateAsync(y.id), "Current year updated", "Could not update")}>Make current</Button>) },
    { key: "a", header: "", render: (y) => <DeleteButton what="academic year" pending={remove.isPending} onConfirm={() => run(() => remove.mutateAsync(y.id), "Year deleted", "Could not delete year")} /> },
  ];
  return (
    <Section
      title="Academic years"
      action={
        <FormModal open={open} onOpenChange={setOpen} title="New academic year" trigger={<Button size="sm"><Plus className="h-4 w-4" /> New year</Button>}>
          <form className="flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => create.mutateAsync(form), "Academic year created", "Could not create year")) setOpen(false);
          }}>
            <Field label="Name" htmlFor="y-name"><Input id="y-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="2026" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="y-start"><Input id="y-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
              <Field label="Ends" htmlFor="y-end"><Input id="y-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-700"><Switch checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} /> Make this the current year</label>
            <Button type="submit" disabled={create.isPending}>Create year</Button>
          </form>
        </FormModal>
      }
    >
      <DataTable columns={cols} data={list.data?.items ?? []} keyField={(y) => y.id} isLoading={list.isLoading} isError={list.isError} onRetry={() => list.refetch()} emptyTitle="No academic years yet" />
    </Section>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {hint && <p className="text-sm text-slate-500">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
