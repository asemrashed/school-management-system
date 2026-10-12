"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@packages/shared-types";
import { apiClient } from "../api-client";

interface DeviceLimitRow {
  role: Role;
  maxSessions: number | null;
}

export function useDeviceLimits() {
  return useQuery({
    queryKey: ["device-limits"],
    queryFn: () => apiClient<{ deviceControlEnabled: boolean; items: DeviceLimitRow[] }>("/device/limits"),
  });
}

export function useSetDeviceLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { role: Role; maxSessions: number }) =>
      apiClient("/device/limits", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-limits"] }),
  });
}
