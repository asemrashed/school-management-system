"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssignmentDto,
  CreateAssignmentInput,
  SubmissionDto,
  SubmitAssignmentInput,
  GradeSubmissionInput,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useAssignments(sectionId?: string) {
  return useQuery({
    queryKey: ["assignments", sectionId],
    queryFn: () =>
      apiClient<{ items: AssignmentDto[] }>(`/lms/assignments${sectionId ? `?sectionId=${sectionId}` : ""}`),
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) =>
      apiClient<{ assignment: AssignmentDto }>("/lms/assignments", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assignments"] }),
  });
}

export function useSubmissions(assignmentId: string) {
  return useQuery({
    queryKey: ["submissions", assignmentId],
    queryFn: () => apiClient<{ items: SubmissionDto[] }>(`/lms/assignments/${assignmentId}/submissions`),
    enabled: Boolean(assignmentId),
  });
}

export function useSubmitAssignment(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitAssignmentInput) =>
      apiClient<{ submission: SubmissionDto }>(`/lms/assignments/${assignmentId}/submissions`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submissions", assignmentId] }),
  });
}

export function useGradeSubmission(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GradeSubmissionInput & { submissionId: string }) =>
      apiClient<{ submission: SubmissionDto }>(`/lms/submissions/${input.submissionId}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["submissions", assignmentId] }),
  });
}
