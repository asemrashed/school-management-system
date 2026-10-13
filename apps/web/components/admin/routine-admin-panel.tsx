"use client";

import * as React from "react";
import { PageHeader, Label, Tabs, TabsList, TabsTrigger, TabsContent } from "@packages/ui";
import { RoutineGrid } from "@/components/routine/routine-grid";
import { LookupCombobox } from "@/components/forms/lookup-combobox";
import { useRoutine } from "@/lib/hooks/use-setup";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["section", "teacher"] as const;

/** Admin view of the generated routine, by section or by teacher. */
export function RoutineAdminPanel() {
  const [tab, setTab] = useUrlTab("sub", "section", TAB_VALUES);
  const [sectionId, setSectionId] = React.useState("");
  const [teacherId, setTeacherId] = React.useState("");
  const bySection = useRoutine({ sectionId }, Boolean(sectionId));
  const byTeacher = useRoutine({ teacherId }, Boolean(teacherId));

  return (
    <div>
      <PageHeader title="Class routine" description="Generated from teacher assignments. Change times under Teacher Assignments." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="section">By section</TabsTrigger>
          <TabsTrigger value="teacher">By teacher</TabsTrigger>
        </TabsList>
        <TabsContent value="section" className="flex flex-col gap-4">
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label>Section</Label>
            <LookupCombobox kind="sections" value={sectionId} onChange={setSectionId} />
          </div>
          {sectionId ? (
            <RoutineGrid periods={bySection.data?.periods ?? []} entries={bySection.data?.entries ?? []} show="teacher" isLoading={bySection.isLoading} />
          ) : (
            <p className="text-sm text-slate-500">Choose a section to see its weekly routine.</p>
          )}
        </TabsContent>
        <TabsContent value="teacher" className="flex flex-col gap-4">
          <div className="flex max-w-sm flex-col gap-1.5">
            <Label>Teacher</Label>
            <LookupCombobox kind="teachers" value={teacherId} onChange={setTeacherId} />
          </div>
          {teacherId ? (
            <RoutineGrid periods={byTeacher.data?.periods ?? []} entries={byTeacher.data?.entries ?? []} show="class" isLoading={byTeacher.isLoading} emptyHint="This teacher has no scheduled classes yet." />
          ) : (
            <p className="text-sm text-slate-500">Choose a teacher to see their weekly routine.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
