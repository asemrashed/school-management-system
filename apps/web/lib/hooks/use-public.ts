"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api-client";

interface PublicPage {
  slug: string;
  title: string;
  bodyHtml: string;
  publishedAt: string | null;
}

interface PublicNotice {
  id: string;
  title: string;
  bodyHtml: string;
  publishedAt: string | null;
}

export function usePublicPage(slug: string) {
  return useQuery({
    queryKey: ["public-page", slug],
    queryFn: () => apiClient<{ page: PublicPage }>(`/public/pages/${slug}`),
    enabled: Boolean(slug),
    retry: false,
  });
}

export function usePublicNotices() {
  return useQuery({
    queryKey: ["public-notices"],
    queryFn: () => apiClient<{ items: PublicNotice[] }>("/public/notices"),
  });
}
