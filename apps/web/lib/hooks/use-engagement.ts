"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NoticeDto,
  NoticeStatus,
  CreateNoticeInput,
  UpdateNoticeInput,
  EventDto,
  CreateEventInput,
  TicketDto,
  CreateTicketInput,
  AddTicketMessageInput,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useNotices() {
  return useQuery({
    queryKey: ["notices"],
    queryFn: () => apiClient<{ items: NoticeDto[] }>("/engagement/notices"),
  });
}

export function useCreateNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNoticeInput) =>
      apiClient<{ notice: { id: string; status: NoticeStatus } }>("/engagement/notices", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
  });
}

/** The signed-in author's own notices in every state (pending / rejected / ...). */
export function useMyNotices(enabled = true) {
  return useQuery({
    queryKey: ["notices", "mine"],
    queryFn: () => apiClient<{ items: NoticeDto[] }>("/engagement/notices/mine"),
    enabled,
  });
}

/** Admin approval queue. */
export function usePendingNotices(enabled = true) {
  return useQuery({
    queryKey: ["notices", "pending"],
    queryFn: () => apiClient<{ items: NoticeDto[] }>("/engagement/notices/pending"),
    enabled,
  });
}

export function useResubmitNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & UpdateNoticeInput) => {
      const { id, ...body } = input;
      return apiClient(`/engagement/notices/${id}`, { method: "PATCH", body });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export function useReviewNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: "approve" } | { id: string; action: "reject"; note: string }) =>
      apiClient(`/engagement/notices/${input.id}/${input.action}`, {
        method: "POST",
        body: input.action === "reject" ? { note: input.note } : {},
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => apiClient<{ items: EventDto[] }>("/engagement/events"),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      apiClient("/engagement/events", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useTickets() {
  return useQuery({
    queryKey: ["tickets"],
    queryFn: () => apiClient<{ items: TicketDto[] }>("/engagement/tickets"),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) =>
      apiClient<{ ticket: TicketDto }>("/engagement/tickets", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useAddTicketMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddTicketMessageInput) =>
      apiClient<{ ticket: TicketDto }>(`/engagement/tickets/${ticketId}/messages`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
  });
}
