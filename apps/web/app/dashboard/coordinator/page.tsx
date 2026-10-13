"use client";

import * as React from "react";
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@packages/ui";
import { useSession } from "@/lib/hooks/use-auth";
import { ExamManagement } from "@/components/exams/exam-management";
import { ResultSheet } from "@/components/exams/result-sheet";
import { useUrlTab } from "@/lib/use-url-tab";

const TAB_VALUES = ["exams", "results"] as const;

/**
 * Coordinator = the school's academic quality owner: schedules exams,
 * approves teachers' marks, publishes results. (More tools are added here.)
 */
export default function CoordinatorDashboardPage() {
  const [tab, setTab] = useUrlTab("tab", "exams", TAB_VALUES);
  const session = useSession();
  const firstName = session.data?.user?.name?.split(" ")[0];
  return (
    <div>
      <PageHeader title={firstName ? `Welcome, ${firstName}` : "Academics"} description="Exams, mark approval and published results." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="exams">Exams &amp; Approval</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>
        <TabsContent value="exams"><ExamManagement /></TabsContent>
        <TabsContent value="results"><ResultSheet /></TabsContent>
      </Tabs>
    </div>
  );
}
