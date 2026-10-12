"use client";

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type {
  StudentDto,
  AdmitStudentInput,
  AdmitStudentResult,
  UpdateStudentInput,
  AdmissionApplicationDto,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useStudents(params: { q?: string; sectionId?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.sectionId) search.set("sectionId", params.sectionId);
  search.set("page", String(params.page ?? 1));
  return useQuery({
    queryKey: ["students", params],
    queryFn: () => apiClient<{ items: StudentDto[]; total: number }>(`/students?${search}`),
    placeholderData: keepPreviousData,
  });
}

export function useAdmitStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AdmitStudentInput) =>
      apiClient<AdmitStudentResult>("/students/admit", { method: "POST", body: input }),
    onSuccess: () => {
      for (const key of ["students", "invoices", "applications", "lookup", "role-limits"]) {
        client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useUpdateStudent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateStudentInput) =>
      apiClient<{ student: StudentDto }>(`/students/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useApplications(status?: "new" | "approved" | "rejected") {
  return useQuery({
    queryKey: ["applications", status],
    queryFn: () => apiClient<{ items: AdmissionApplicationDto[] }>(`/site/applications${status ? `?status=${status}` : ""}`),
  });
}

export function useRejectApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNote }: { id: string; reviewNote?: string }) =>
      apiClient(`/site/applications/${id}/reject`, { method: "POST", body: { reviewNote } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["applications"] }),
  });
}
