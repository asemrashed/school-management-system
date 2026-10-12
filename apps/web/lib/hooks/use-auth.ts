"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LoginInput,
  RegisterInput,
  SessionUser,
  RequestPasswordResetInput,
  RequestPasswordResetResponse,
  ChooseOtpChannelInput,
  VerifyPasswordResetInput,
} from "@packages/shared-types";
import { apiClient, clearCsrfToken } from "../api-client";

const SESSION_KEY = ["auth", "session"] as const;

export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: () => apiClient<{ user: SessionUser | null }>("/auth/me"),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiClient<{ user: SessionUser }>("/auth/login", { method: "POST", body: input }),
    onSuccess: (data) => {
      clearCsrfToken();
      queryClient.setQueryData(SESSION_KEY, { user: data.user });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiClient<{ user: SessionUser }>("/auth/register", { method: "POST", body: input }),
    onSuccess: (data) => {
      clearCsrfToken();
      queryClient.setQueryData(SESSION_KEY, { user: data.user });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient<void>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      clearCsrfToken();
      queryClient.setQueryData(SESSION_KEY, { user: null });
      queryClient.invalidateQueries();
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (input: RequestPasswordResetInput) =>
      apiClient<RequestPasswordResetResponse>("/auth/password-reset/request", {
        method: "POST",
        body: input,
      }),
  });
}

export function useChooseOtpChannel() {
  return useMutation({
    mutationFn: (input: ChooseOtpChannelInput) =>
      apiClient<void>("/auth/password-reset/channel", { method: "POST", body: input }),
  });
}

export function useVerifyPasswordReset() {
  return useMutation({
    mutationFn: (input: VerifyPasswordResetInput) =>
      apiClient<void>("/auth/password-reset/verify", { method: "POST", body: input }),
  });
}
