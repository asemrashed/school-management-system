"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ResourceDto, CreateResourceInput } from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useResources(sectionId?: string) {
  return useQuery({
    queryKey: ["resources", sectionId],
    queryFn: () => apiClient<{ items: ResourceDto[] }>(`/lms/resources${sectionId ? `?sectionId=${sectionId}` : ""}`),
  });
}

export function useCreateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateResourceInput) =>
      apiClient<{ resource: ResourceDto }>("/lms/resources", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources"] }),
  });
}

export function usePublishResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/lms/resources/${id}/publish`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources"] }),
  });
}
