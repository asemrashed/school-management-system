"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PageDto, CreatePageInput, UpdatePageInput } from "@packages/shared-types";
import { apiClient } from "../api-client";

export function usePages() {
  return useQuery({ queryKey: ["cms-pages"], queryFn: () => apiClient<{ items: PageDto[] }>("/cms/pages") });
}

export function useCreatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePageInput) => apiClient<{ page: PageDto }>("/cms/pages", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cms-pages"] }),
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePageInput & { id: string }) =>
      apiClient<{ page: PageDto }>(`/cms/pages/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cms-pages"] }),
  });
}
