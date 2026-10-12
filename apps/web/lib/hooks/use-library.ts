"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BookDto,
  CreateBookInput,
  BookIssueDto,
  IssueBookInput,
  BookSaleDto,
  CreateBookSaleInput,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useBooks() {
  return useQuery({ queryKey: ["books"], queryFn: () => apiClient<{ items: BookDto[] }>("/library/books") });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) =>
      apiClient<{ book: BookDto }>("/library/books", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
  });
}

export function useBookIssues(activeOnly = false) {
  return useQuery({
    queryKey: ["book-issues", activeOnly],
    queryFn: () => apiClient<{ items: BookIssueDto[] }>(`/library/issues${activeOnly ? "?active=true" : ""}`),
  });
}

export function useIssueBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueBookInput) =>
      apiClient<{ issue: BookIssueDto }>("/library/issues", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-issues"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useReturnBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) =>
      apiClient<{ issue: BookIssueDto }>("/library/issues/return", { method: "POST", body: { issueId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-issues"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}

export function useBookSales() {
  return useQuery({ queryKey: ["book-sales"], queryFn: () => apiClient<{ items: BookSaleDto[] }>("/library/sales") });
}

export function useCreateBookSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookSaleInput) =>
      apiClient<{ sale: BookSaleDto }>("/library/sales", { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["book-sales"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });
}
