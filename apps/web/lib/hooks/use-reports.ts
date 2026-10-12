"use client";

import { useQuery } from "@tanstack/react-query";
import type { FeeCollectionReport, AttendanceReportRow, DefaulterRow } from "@packages/shared-types";
import { apiClient } from "../api-client";

export function useFeeCollectionReport() {
  return useQuery({
    queryKey: ["report", "fee-collection"],
    queryFn: () => apiClient<FeeCollectionReport>("/reports/fee-collection"),
  });
}

export function useAttendanceReport() {
  return useQuery({
    queryKey: ["report", "attendance"],
    queryFn: () => apiClient<{ items: AttendanceReportRow[] }>("/reports/attendance"),
  });
}

export function useDefaulterReport() {
  return useQuery({
    queryKey: ["report", "defaulters"],
    queryFn: () => apiClient<{ items: DefaulterRow[] }>("/reports/defaulters"),
  });
}
