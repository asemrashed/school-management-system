"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExamDto, CreateExamInput, MarkDto, SubmitMarksInput } from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useExams(sectionId?: string) {
  return useQuery({
    queryKey: ["exams", sectionId],
    queryFn: () => apiClient<{ items: ExamDto[] }>(`/exams${sectionId ? `?sectionId=${sectionId}` : ""}`),
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExamInput) =>
      apiClient<{ exam: ExamDto }>("/exams", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });
}

export function useMarks(examId: string) {
  return useQuery({
    queryKey: ["marks", examId],
    queryFn: () => apiClient<{ items: MarkDto[] }>(`/exams/${examId}/marks`),
    enabled: Boolean(examId),
  });
}

export function useSubmitMarks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitMarksInput) => apiClient<void>("/exams/marks", { method: "POST", body: input }),
    onSuccess: (_d, variables) => queryClient.invalidateQueries({ queryKey: ["marks", variables.examId] }),
  });
}

export function usePublishExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => apiClient<{ exam: ExamDto }>("/exams/publish", { method: "POST", body: { examId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exams"] }),
  });
}
