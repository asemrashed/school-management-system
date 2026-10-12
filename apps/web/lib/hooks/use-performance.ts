"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChildSummaryDto, PerformanceDto } from "@packages/shared-types";
import { apiClient } from "../api-client";

/** Parent: their children. Student: just themselves. */
export function useMyChildren() {
  return useQuery({
    queryKey: ["students", "mine"],
    queryFn: () => apiClient<{ items: ChildSummaryDto[] }>("/students/mine"),
  });
}

export function usePerformance(studentId: string | undefined) {
  return useQuery({
    queryKey: ["performance", studentId],
    queryFn: () => apiClient<{ performance: PerformanceDto }>(`/students/${studentId}/performance`),
    enabled: !!studentId,
  });
}
