"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NoticeDto,
  CreateNoticeInput,
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
      apiClient("/engagement/notices", { method: "POST", body: input }),
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
