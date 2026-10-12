"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  SubjectDto,
  ClassAssignmentDto,
  CreateClassAssignmentInput,
  UpdateClassAssignmentInput,
  RosterStudentDto,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useSectionRoster(sectionId: string) {
  return useQuery({
    queryKey: ["section-roster", sectionId],
    queryFn: () => apiClient<{ items: RosterStudentDto[] }>(`/academics/sections/${sectionId}/roster`),
    enabled: Boolean(sectionId),
  });
}

export function useSubjects(classId?: string) {
  return useQuery({
    queryKey: ["subjects", classId],
    queryFn: () =>
      apiClient<{ items: SubjectDto[] }>(`/academics/subjects${classId ? `?classId=${classId}` : ""}`),
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; classId: string }) =>
      apiClient<{ subject: SubjectDto }>("/academics/subjects", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useClassAssignments(params: { sectionId?: string; teacherId?: string; mine?: boolean } = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString();
  return useQuery({
    queryKey: ["class-assignments", params],
    queryFn: () =>
      apiClient<{ items: ClassAssignmentDto[] }>(`/academics/class-assignments${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateClassAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClassAssignmentInput) =>
      apiClient<{ assignment: ClassAssignmentDto }>("/academics/class-assignments", {
        method: "POST",
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["routine"] });
    },
  });
}

export function useDeleteClassAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<void>(`/academics/class-assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["routine"] });
    },
  });
}

export function useUpdateClassAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateClassAssignmentInput) =>
      apiClient<{ assignment: ClassAssignmentDto }>(`/academics/class-assignments/${id}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["routine"] });
    },
  });
}

/** Sections the signed-in teacher may take attendance for. */
export interface AttendanceSectionDuty {
  id: string;
  label: string;
  sectionName: string;
  className: string;
  studentCount: number;
  takenToday: boolean;
  presentCount: number;
  absentCount: number;
}
/** Sections this teacher takes attendance for; `date` (local YYYY-MM-DD) makes taken/not-taken correct for "today". */
export function useAttendanceSections(date?: string) {
  return useQuery({
    queryKey: ["attendance-sections", date],
    queryFn: () => apiClient<{ items: AttendanceSectionDuty[] }>(`/attendance/my-sections${date ? `?date=${date}` : ""}`),
  });
}
