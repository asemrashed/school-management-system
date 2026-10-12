"use client";

import * as React from "react";
import { PageHeader, ErrorState } from "@packages/ui";
import { RoutineGrid } from "./routine-grid";
import { useRoutine } from "@/lib/hooks/use-setup";

/** The signed-in person's own routine: a teacher's periods, or a student's /
 * parent's children's classes. The API scopes the result; nothing is passed. */
export function MyRoutine({ role }: { role: "teacher" | "student" | "parent" }) {
  const routine = useRoutine({ mine: role === "teacher" });
  if (routine.isError) return <ErrorState onRetry={() => routine.refetch()} />;
  return (
    <div>
      <PageHeader
        title={role === "teacher" ? "My teaching routine" : "Class routine"}
        description={role === "parent" ? "Weekly timetable for your children." : "Your weekly timetable."}
      />
      <RoutineGrid
        periods={routine.data?.periods ?? []}
        entries={routine.data?.entries ?? []}
        show={role === "teacher" ? "class" : "teacher"}
        isLoading={routine.isLoading}
        emptyHint="Your routine will show here once the school schedules your classes."
      />
    </div>
  );
}
