"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessagingFeatureToggleDto, MessageCategory } from "@packages/shared-types";
import { apiClient } from "../api-client";

const TOGGLES_KEY = ["messaging", "toggles"] as const;

interface TogglesResponse {
  smsGatewayEnabled: boolean;
  items: MessagingFeatureToggleDto[];
}

export function useMessagingToggles() {
  return useQuery({
    queryKey: TOGGLES_KEY,
    queryFn: () => apiClient<TogglesResponse>("/messaging/toggles"),
  });
}

export function useUpdateMessagingToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { category: MessageCategory; smsEnabled: boolean }) =>
      apiClient("/messaging/toggles", { method: "PATCH", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TOGGLES_KEY });
    },
  });
}
