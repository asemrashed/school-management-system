"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  PublicSite,
  SiteKey,
  GeneralSettings,
  HomeSettings,
  AdmissionSettings,
  WebsiteTeacher,
  UpdateWebsiteTeacherInput,
  GalleryImageDto,
  CreateGalleryImageInput,
  ContactMessageDto,
  ContactFormInput,
  AdmissionFormInput,
} from "@packages/shared-types";
import { apiClient } from "../api-client";

// --- Public (no login) -------------------------------------------------------

export function usePublicSite() {
  return useQuery({
    queryKey: ["public-site"],
    queryFn: () => apiClient<PublicSite>("/public/site"),
    staleTime: 60_000,
  });
}

export function usePublicGallery() {
  return useQuery({
    queryKey: ["public-gallery"],
    queryFn: () => apiClient<{ items: Array<{ id: string; url: string; caption: string | null; album: string | null }> }>("/public/gallery"),
  });
}

export function useSubmitContact() {
  return useMutation({
    mutationFn: (input: ContactFormInput) => apiClient("/public/contact", { method: "POST", body: input }),
  });
}

export function useSubmitAdmission() {
  return useMutation({
    mutationFn: (input: AdmissionFormInput) => apiClient("/public/admission", { method: "POST", body: input }),
  });
}

// --- Admin -------------------------------------------------------------------

type AllSettings = { general: GeneralSettings; home: HomeSettings; admission: AdmissionSettings };

export function useSiteSettings() {
  return useQuery({ queryKey: ["site-settings"], queryFn: () => apiClient<AllSettings>("/site/settings") });
}

export function useSaveSiteSetting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: SiteKey; value: unknown }) =>
      apiClient(`/site/settings/${key}`, { method: "PUT", body: value }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["site-settings"] });
      client.invalidateQueries({ queryKey: ["public-site"] });
    },
  });
}

export function useWebsiteTeachers() {
  return useQuery({ queryKey: ["site-teachers"], queryFn: () => apiClient<{ items: WebsiteTeacher[] }>("/site/teachers") });
}

export function useUpdateWebsiteTeacher() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateWebsiteTeacherInput) =>
      apiClient(`/site/teachers/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["site-teachers"] });
      client.invalidateQueries({ queryKey: ["public-site"] });
    },
  });
}

export function useAdminGallery() {
  return useQuery({ queryKey: ["site-gallery"], queryFn: () => apiClient<{ items: GalleryImageDto[] }>("/site/gallery") });
}

export function useAddGalleryImage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGalleryImageInput) => apiClient("/site/gallery", { method: "POST", body: input }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["site-gallery"] });
      client.invalidateQueries({ queryKey: ["public-site"] });
      client.invalidateQueries({ queryKey: ["public-gallery"] });
    },
  });
}

export function useDeleteGalleryImage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/site/gallery/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["site-gallery"] });
      client.invalidateQueries({ queryKey: ["public-site"] });
      client.invalidateQueries({ queryKey: ["public-gallery"] });
    },
  });
}

export function useContactMessages() {
  return useQuery({
    queryKey: ["contact-messages"],
    queryFn: () => apiClient<{ items: ContactMessageDto[] }>("/site/contact-messages"),
  });
}

export function useMarkContactRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/site/contact-messages/${id}/read`, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["contact-messages"] }),
  });
}
