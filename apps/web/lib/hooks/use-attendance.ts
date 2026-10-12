"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttendanceRecordDto, SubmitAttendanceInput } from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useAttendance(sectionId: string, date: string) {
  return useQuery({
    queryKey: ["attendance", sectionId, date],
    queryFn: () =>
      apiClient<{ items: AttendanceRecordDto[] }>(
        `/attendance?sectionId=${sectionId}&date=${date}`
      ),
    enabled: Boolean(sectionId && date),
  });
}

export function useSubmitAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitAttendanceInput) =>
      apiClient<void>("/attendance", { method: "POST", body: input }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attendance", variables.sectionId, variables.date] });
      queryClient.invalidateQueries({ queryKey: ["attendance-sections"] }); // refreshes the Today tab's "Taken" badge
    },
  });
}
