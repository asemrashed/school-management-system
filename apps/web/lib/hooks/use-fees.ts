"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  FeeStructureDto,
  CreateFeeStructureInput,
  InvoiceDto,
  CreateInvoiceInput,
  RecordPaymentInput,
  UpdateFeeStructureInput,
  GenerateInvoicesInput,
  GenerateInvoicesResult,
  PaymentOptions,
  PaymentDto,
  OnlinePaymentSession,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useFeeStructures() {
  return useQuery({
    queryKey: ["fee-structures"],
    queryFn: () => apiClient<{ items: FeeStructureDto[] }>("/fees/structures"),
  });
}

export function useCreateFeeStructure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFeeStructureInput) =>
      apiClient<{ feeStructure: FeeStructureDto }>("/fees/structures", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fee-structures"] }),
  });
}

export function useInvoices(studentId?: string) {
  return useQuery({
    queryKey: ["invoices", studentId],
    queryFn: () =>
      apiClient<{ items: InvoiceDto[] }>(`/fees/invoices${studentId ? `?studentId=${studentId}` : ""}`),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      apiClient<{ invoice: InvoiceDto }>("/fees/invoices", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordPaymentInput) =>
      apiClient("/fees/payments", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function useUpdateFeeStructure() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateFeeStructureInput) =>
      apiClient(`/fees/structures/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["fee-structures"] }),
  });
}

export function useDeleteFeeStructure() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/fees/structures/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["fee-structures"] }),
  });
}

/** Monthly (or any) bulk billing. Safe to re-run: already-billed students are skipped. */
export function useGenerateInvoices() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateInvoicesInput) =>
      apiClient<GenerateInvoicesResult>("/fees/invoices/generate", { method: "POST", body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

export function usePaymentOptions() {
  return useQuery({
    queryKey: ["payment-options"],
    queryFn: () => apiClient<PaymentOptions>("/fees/payments/options"),
    staleTime: 5 * 60_000,
  });
}

export function useInitiateOnlinePayment() {
  return useMutation({
    mutationFn: (input: { invoiceId: string; method: "bkash" | "nagad" | "sslcommerz" }) =>
      apiClient<OnlinePaymentSession>("/fees/payments/initiate", { method: "POST", body: input }),
  });
}

export function useInvoicePayments(invoiceId: string | null) {
  return useQuery({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: () => apiClient<{ items: PaymentDto[] }>(`/fees/invoices/${invoiceId}/payments`),
    enabled: Boolean(invoiceId),
  });
}

export interface ReceiptDto {
  receiptNo: string;
  schoolName: string;
  studentName: string;
  studentCode: string | null;
  feeName: string;
  term: string;
  amount: number;
  method: string;
  transactionRef: string | null;
  paidAt: string;
  balanceAfter: number;
}
export function useReceipt(paymentId: string | null) {
  return useQuery({
    queryKey: ["receipt", paymentId],
    queryFn: () => apiClient<{ receipt: ReceiptDto }>(`/fees/payments/${paymentId}/receipt`),
    enabled: Boolean(paymentId),
  });
}

/** Sandbox-only: finish a fake checkout. Real gateways confirm server-to-server instead. */
export function useCompleteSandboxPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ session, outcome }: { session: string; outcome: "success" | "fail" }) =>
      apiClient<{ status: "succeeded" | "failed"; alreadyProcessed?: boolean }>(
        `/fees/payments/sandbox/${session}/complete`,
        { method: "POST", body: { outcome } }
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
