"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A tab (or any "which view am I on" state) that lives in the URL query, so a
 * refresh, a shared link and the browser back button all keep the same page.
 *
 *   const [tab, setTab] = useUrlTab("tab", "users", TAB_VALUES);   // ?tab=students
 *
 * - `allowed` guards against hand-edited / stale URLs: anything not in the list
 *   falls back to `fallback` (and nothing from the URL is ever trusted as markup).
 * - Changing the main `tab` clears the nested `sub` key, so a stale sub-view of
 *   another tab can never leak across.
 * - Uses router.replace (no history spam on every click) and keeps scroll position.
 */
export function useUrlTab(key: string, fallback: string, allowed?: readonly string[]) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = params.get(key);
  const value = raw && (!allowed || allowed.includes(raw)) ? raw : fallback;

  const setValue = React.useCallback(
    (next: string) => {
      // Read the live query, not a stale closure, so two quick changes can't clobber each other.
      const q = new URLSearchParams(window.location.search);
      q.set(key, next);
      if (key === "tab") q.delete("sub");
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [key, pathname, router]
  );

  return [value, setValue] as const;
}
