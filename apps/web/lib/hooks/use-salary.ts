"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SalaryDto, CreateSalaryInput } from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useSalaries(staffId?: string) {
  return useQuery({
    queryKey: ["salaries", staffId],
    queryFn: () => apiClient<{ items: SalaryDto[] }>(`/salary${staffId ? `?staffId=${staffId}` : ""}`),
  });
}

export function useCreateSalary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSalaryInput) =>
      apiClient<{ salary: SalaryDto }>("/salary", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["salaries"] }),
  });
}

export function useMarkSalaryPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (salaryId: string) => apiClient("/salary/paid", { method: "POST", body: { salaryId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["salaries"] }),
  });
}
