"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  UserDto,
  CreateUserInput,
  OffsetPaginationQuery,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

const USERS_KEY = ["users"] as const;

interface PaginatedUsers {
  items: UserDto[];
  total?: number;
}

export function useUsers(params: Partial<OffsetPaginationQuery> = {}) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  return useQuery({
    queryKey: [...USERS_KEY, page, limit],
    queryFn: () => apiClient<PaginatedUsers>(`/users?page=${page}&limit=${limit}`),
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) =>
      apiClient<{ user: UserDto }>("/users", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}
