"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateExamSessionInput,
  ExamDto,
  ExamSessionDto,
  ExamSessionExamRow,
  MyResultDto,
  ResultSheetDto,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export interface SheetParams {
  sectionId?: string;
  q?: string;
  result?: "all" | "pass" | "fail";
  sort?: "roll" | "name" | "total" | "percent";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function sheetQuery(p: SheetParams) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== "" && v !== "all") u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : "";
}

export function useExamSessions() {
  return useQuery({
    queryKey: ["exam-sessions"],
    queryFn: () => apiClient<{ items: ExamSessionDto[] }>("/exam-sessions"),
  });
}

export function useSessionProgress(id: string | null) {
  return useQuery({
    queryKey: ["exam-sessions", id, "progress"],
    queryFn: () => apiClient<{ items: ExamSessionExamRow[] }>(`/exam-sessions/${id}/progress`),
    enabled: Boolean(id),
  });
}

export function useResultSheet(id: string | null, params: SheetParams) {
  return useQuery({
    queryKey: ["exam-sessions", id, "results", params],
    queryFn: () => apiClient<{ sheet: ResultSheetDto }>(`/exam-sessions/${id}/results${sheetQuery(params)}`),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
}

export function useMyResults() {
  return useQuery({
    queryKey: ["exam-sessions", "mine"],
    queryFn: () => apiClient<{ items: MyResultDto[] }>("/exam-sessions/mine"),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["exam-sessions"] });
    qc.invalidateQueries({ queryKey: ["exams"] });
  };
}

export function useCreateExamSession() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateExamSessionInput) => apiClient<{ session: ExamSessionDto }>("/exam-sessions", { method: "POST", body: input }),
    onSuccess: done,
  });
}

export function useDeleteExamSession() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiClient<void>(`/exam-sessions/${id}`, { method: "DELETE" }),
    onSuccess: done,
  });
}

export function useSubmitExam() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (examId: string) => apiClient<{ exam: ExamDto }>(`/exams/${examId}/submit`, { method: "POST" }),
    onSuccess: done,
  });
}

export function useApproveExam() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (examId: string) =>
      apiClient<{ exam: ExamDto; sessionPublished: boolean }>(`/exams/${examId}/approve`, { method: "POST" }),
    onSuccess: done,
  });
}

export function useRejectExam() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (input: { examId: string; note: string }) =>
      apiClient<{ exam: ExamDto }>(`/exams/${input.examId}/reject`, { method: "POST", body: { note: input.note } }),
    onSuccess: done,
  });
}
