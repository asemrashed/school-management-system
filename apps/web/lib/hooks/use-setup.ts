"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type {
  ShiftDto,
  ClassDto,
  CreateClassInput,
  SectionDto,
  CreateSectionInput,
  BuildingDto,
  RoomDto,
  CreateRoomInput,
  PeriodDto,
  CreatePeriodInput,
  AcademicYearDto,
  CreateAcademicYearInput,
  LookupItem,
  LookupKind,
  RoutineDto,
  RoleAccountLimitRow,
  SetRoleAccountLimitInput,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

/** Builds a `?a=1&b=2` string, skipping empty values. */
function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : "";
}

/** One list query + create/update/delete mutations for a /setup/<path> resource. */
function makeResource<TDto, TCreate, TUpdate = Partial<TCreate>>(path: string, key: string, itemKey: string) {
  const useList = (params: Record<string, string | undefined> = {}) =>
    useQuery({
      queryKey: [key, params],
      queryFn: () => apiClient<{ items: TDto[] }>(`/setup/${path}${qs(params)}`),
    });
  const useCreate = () => {
    const client = useQueryClient();
    return useMutation({
      mutationFn: (input: TCreate) =>
        apiClient<Record<string, TDto>>(`/setup/${path}`, { method: "POST", body: input }).then((r) => r[itemKey]),
      onSuccess: () => client.invalidateQueries({ queryKey: [key] }),
    });
  };
  const useUpdate = () => {
    const client = useQueryClient();
    return useMutation({
      mutationFn: ({ id, ...input }: { id: string } & TUpdate) =>
        apiClient<Record<string, TDto>>(`/setup/${path}/${id}`, { method: "PATCH", body: input }).then((r) => r[itemKey]),
      onSuccess: () => client.invalidateQueries({ queryKey: [key] }),
    });
  };
  const useDelete = () => {
    const client = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => apiClient<void>(`/setup/${path}/${id}`, { method: "DELETE" }),
      // Deleting can change counts shown elsewhere (class -> sections, room -> sections).
      onSuccess: () => client.invalidateQueries(),
    });
  };
  return { useList, useCreate, useUpdate, useDelete };
}

export const shifts = makeResource<ShiftDto, { name: string }>("shifts", "setup-shifts", "shift");
export const classes = makeResource<ClassDto, CreateClassInput>("classes", "setup-classes", "class");
export const sections = makeResource<SectionDto, CreateSectionInput>("sections", "setup-sections", "section");
export const buildings = makeResource<BuildingDto, { name: string }>("buildings", "setup-buildings", "building");
export const rooms = makeResource<RoomDto, CreateRoomInput>("rooms", "setup-rooms", "room");
export const periods = makeResource<PeriodDto, CreatePeriodInput, CreatePeriodInput>("periods", "setup-periods", "period");

export function useAcademicYears() {
  return useQuery({
    queryKey: ["setup-years"],
    queryFn: () => apiClient<{ items: AcademicYearDto[] }>("/setup/academic-years"),
  });
}
export function useCreateAcademicYear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAcademicYearInput) =>
      apiClient("/setup/academic-years", { method: "POST", body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["setup-years"] }),
  });
}
export function useSetCurrentAcademicYear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/setup/academic-years/${id}/current`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["setup-years"] }),
  });
}
export function useDeleteAcademicYear() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<void>(`/setup/academic-years/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["setup-years"] }),
  });
}

// --- Subject edit/delete (create lives in use-academics) ---------------------

export function useUpdateSubject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiClient(`/academics/subjects/${id}`, { method: "PATCH", body: { name } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["subjects"] }),
  });
}
export function useDeleteSubject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<void>(`/academics/subjects/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

// --- Routine ---------------------------------------------------------------------

export function useRoutine(params: { sectionId?: string; teacherId?: string; mine?: boolean } = {}, enabled = true) {
  return useQuery({
    queryKey: ["routine", params],
    queryFn: () => apiClient<RoutineDto>(`/academics/routine${qs({ ...params, mine: params.mine ? "true" : undefined })}`),
    enabled,
  });
}

// --- Lookup (searchable dropdowns) -----------------------------------------------

/** Debounces a fast-changing value (search box keystrokes). */
export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function useLookup(
  kind: LookupKind,
  q: string,
  filters: { classId?: string; sectionId?: string; shiftId?: string } = {},
  enabled = true
) {
  return useQuery({
    queryKey: ["lookup", kind, q, filters],
    queryFn: () => apiClient<{ items: LookupItem[] }>(`/lookup/${kind}${qs({ q, ...filters })}`),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

// --- Role account limits (Super Admin) ---------------------------------------

export function useRoleAccountLimits() {
  return useQuery({
    queryKey: ["role-limits"],
    queryFn: () => apiClient<{ items: RoleAccountLimitRow[] }>("/role-limits"),
  });
}
export function useSetRoleAccountLimit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SetRoleAccountLimitInput) => apiClient("/role-limits", { method: "POST", body: input }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["role-limits"] }),
  });
}
